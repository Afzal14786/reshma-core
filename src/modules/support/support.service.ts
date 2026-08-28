import mongoose, { Types } from "mongoose";
import { Ticket } from "./support.model";
import { User } from "../users/user.model";
import { Order } from "../orders/order.model";
import { Product } from "../products/models/base-product.model";
import { ReturnModel } from "../returns/return.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";

// audit imports
import { AuditLogService } from "@modules/audit-logs/audit-log.service";
import {
  AuditAction,
  AuditModule,
} from "@modules/audit-logs/audit-log.interface";
import { IAuditContext } from "@shared/utils/audit.utils";

import logger from "@config/logger";
import { NotificationService } from "../notifications/notification.service";

import {
  CreateTicketInput,
  ReplyTicketInput,
  UpdateTicketStateInput,
} from "./dtos/support.dto";

import {
  TicketStatus,
  MessageSenderRole,
  LinkedEntityType,
  ITicket,
} from "./interfaces/support.interface";

/**
 * CUSTOMER SUPPORT TICKETING ENGINE
 * @description Manages state transitions, threaded conversations, and polymorphic
 * relationship validations for all customer inquiries.
 */
export class SupportService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * Prevents log injection by removing carriage returns and line feeds.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * VERIFICATION ENGINE: Validates Polymorphic Links
   * Prevents Broken Access Control (IDOR) by ensuring the user actually owns the
   * entity they are trying to complain about.
   */
  private static async verifyLinkedEntity(
    userId: string,
    entityType: LinkedEntityType,
    entityId: string,
  ): Promise<void> {
    let exists = false;

    switch (entityType) {
      case LinkedEntityType.ORDER:
        exists = !!(await Order.exists({
          _id: { $eq: entityId },
          user: { $eq: userId },
        }));
        break;
      case LinkedEntityType.RETURN:
        exists = !!(await ReturnModel.exists({
          _id: { $eq: entityId },
          user: { $eq: userId },
        }));
        break;
      case LinkedEntityType.PRODUCT:
        // Products are public, just ensure it exists in the catalog
        exists = !!(await Product.exists({ _id: { $eq: entityId } }));
        break;
    }

    if (!exists) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        `The specified ${entityType.toLowerCase()} could not be found or does not belong to you.`,
      );
    }
  }

  /**
   * ACTION: Create a new Support Ticket
   */
  public static async createTicket(
    userId: string,
    payload: CreateTicketInput,
    attachmentUrls: string[] = [], // URLs provided by Cloudinary upload middleware
  ): Promise<ITicket> {
    const safeUserId = this.safeLog(userId);

    // 1. Cross-Module Verification
    if (payload.linkedEntity) {
      await this.verifyLinkedEntity(
        userId,
        payload.linkedEntity.entityType,
        payload.linkedEntity.entityId,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Build the payload safely without explicit undefined keys
      const newTicketPayload = {
        user: new Types.ObjectId(userId),
        subject: payload.subject,
        category: payload.category,
        messages: [
          {
            senderRole: MessageSenderRole.USER,
            senderId: new Types.ObjectId(userId),
            message: payload.message,
            attachments: attachmentUrls,
            isRead: false,
          },
        ],
        // Safely spread linkedEntity only if it exists
        ...(payload.linkedEntity && {
          linkedEntity: {
            entityType: payload.linkedEntity.entityType,
            entityId: new Types.ObjectId(payload.linkedEntity.entityId),
          },
        }),
      };

      // Data Assembly (Strict Mapping)
      const ticketDocs = await Ticket.create([newTicketPayload], { session });

      const createdTicket = ticketDocs[0] as ITicket | undefined;

      // STRICT NULL CHECK: Guarantees createdTicket is never undefined
      if (!createdTicket) {
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "Database failed to generate the support ticket document.",
        );
      }

      await session.commitTransaction();

      logger.info(
        `[SupportEngine] Ticket ${createdTicket.ticketId} created by User ${safeUserId}`,
      );

      // Fire-and-Forget Notification Dispatch
      const user = await User.findById(userId).select("email firstname").lean();

      if (user) {
        setImmediate(() => {
          NotificationService.sendTicketCreatedNotification(
            new Types.ObjectId(userId),
            user.email,
            user.firstname,
            createdTicket.ticketId,
            createdTicket.subject,
          ).catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error(
              `[Queue Error] Ticket Creation Alert failed: ${errMsg}`,
            );
          });
        });
      }

      return createdTicket;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * ACTION: Add a Reply to the Conversation Thread
   * Automatically shifts the State Machine based on the Sender Role.
   */
  public static async replyToTicket(
    ticketId: string,
    senderId: string,
    senderRole: MessageSenderRole,
    payload: ReplyTicketInput,
    attachmentUrls: string[] = [],
    auditContext?: IAuditContext,
  ): Promise<ITicket> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Use $eq to prevent NoSQL injection (CWE-943)
      const ticket = await Ticket.findOne({
        ticketId: { $eq: ticketId },
      }).session(session);

      if (!ticket) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, "Support ticket not found.");
      }

      // STATE MACHINE LOCK: Prevent reviving dead tickets
      if (ticket.status === TicketStatus.CLOSED) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          "This ticket has been closed. Please open a new ticket for further assistance.",
        );
      }

      // Append new message
      ticket.messages.push({
        senderRole,
        senderId: new Types.ObjectId(senderId),
        message: payload.message,
        attachments: attachmentUrls,
        isRead: false,
      });

      // AUTO-SHIFT STATE MACHINE
      if (senderRole === MessageSenderRole.ADMIN) {
        ticket.status = TicketStatus.WAITING_ON_CUSTOMER;
      } else if (senderRole === MessageSenderRole.USER) {
        // If it was waiting on the customer, and they replied, ping it back to Admin
        if (ticket.status === TicketStatus.WAITING_ON_CUSTOMER) {
          ticket.status = TicketStatus.IN_PROGRESS;
        }
      }

      await ticket.save({ session });
      await session.commitTransaction();

      // audit log
      if (auditContext && senderRole === MessageSenderRole.ADMIN) {
        await AuditLogService.log({
          adminId: auditContext.adminId,
          adminEmail: auditContext.adminEmail,
          adminName: auditContext.adminName,
          action: AuditAction.UPDATE,
          module: AuditModule.SUPPORT,
          targetId: ticket._id.toString(),
          targetName: ticket.ticketId,
          changes: {
            before: { status: ticket.status },
            after: { status: ticket.status }, // State machine shifted
          },
          payload: { message: payload.message },
          ...(auditContext.ipAddress
            ? { ipAddress: auditContext.ipAddress }
            : {}),
          ...(auditContext.userAgent
            ? { userAgent: auditContext.userAgent }
            : {}),
        });
      }

      // FIRE-AND-FORGET NOTIFICATION: If Admin replies, notify the Customer
      if (senderRole === MessageSenderRole.ADMIN && ticket.user) {
        const userDoc = await User.findById(ticket.user)
          .select("email firstname")
          .lean();

        if (userDoc) {
          setImmediate(() => {
            NotificationService.sendTicketReplyNotification(
              new Types.ObjectId(ticket.user!.toString()),
              userDoc.email,
              userDoc.firstname,
              ticket.ticketId,
              payload.message,
            ).catch((err: unknown) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.error(
                `[Queue Error] Ticket Reply Alert failed: ${errMsg}`,
              );
            });
          });
        }
      }

      return ticket;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * ACTION: Admin State Override
   * Used by staff to escalate priority or close tickets.
   */
  public static async updateTicketState(
    ticketId: string,
    payload: UpdateTicketStateInput,
    auditContext?: IAuditContext,
  ): Promise<ITicket> {
    // capture "before" state for audit logging
    let beforeTicket: ITicket | null = null;
    if (auditContext) {
      beforeTicket = (await Ticket.findOne({
        ticketId: { $eq: ticketId },
      }).lean()) as ITicket | null;
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: { $eq: ticketId } },
      { $set: payload },
      { new: true, runValidators: true },
    );

    if (!ticket) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Support ticket not found.");
    }

    // audit log
    if (auditContext && beforeTicket) {
      await AuditLogService.log({
        adminId: auditContext.adminId,
        adminEmail: auditContext.adminEmail,
        adminName: auditContext.adminName,
        action: AuditAction.UPDATE,
        module: AuditModule.SUPPORT,
        targetId: ticket._id.toString(),
        targetName: ticket.ticketId,
        changes: {
          before: beforeTicket as unknown as Record<string, unknown>,
          after: ticket.toObject() as unknown as Record<string, unknown>,
        },
        payload: payload,
        ...(auditContext.ipAddress
          ? { ipAddress: auditContext.ipAddress }
          : {}),
        ...(auditContext.userAgent
          ? { userAgent: auditContext.userAgent }
          : {}),
      });
    }

    logger.info(`[SupportEngine] Admin updated State for Ticket ${ticketId}`);
    return ticket;
  }

  /**
   * UTILITY: Standardized Paginated Fetcher
   * Utilizes native TS Record to avoid strict Mongoose version mismatches.
   */
  public static async fetchTickets(
    query: Record<string, unknown>,
    limit = 20,
    skip = 0,
  ) {
    const tickets = await Ticket.find(query)
      .sort({ priority: -1, createdAt: -1 }) // Compound index match
      .skip(skip)
      .limit(limit)
      .populate("user", "firstname lastname email avatar")
      .populate("assignedAdmin", "firstname lastname")
      .lean();

    const total = await Ticket.countDocuments(query);
    return { tickets, meta: { total, limit, skip } };
  }

  /**
   * DPDP / GDPR LEGAL ENGINE: Scrub Ticket PII
   * @description Called during the Master Account Deletion Saga.
   * Deletes user references and scrubs their message content, but keeps the
   * ticket history for administrative QA and analytics.
   */
  public static async anonymizeUserTickets(
    userId: string,
    session: mongoose.ClientSession,
  ): Promise<void> {
    const safeUserId = this.safeLog(userId);

    // Find all tickets initiated by this user
    const tickets = await Ticket.find({ user: { $eq: safeUserId } }).session(
      session,
    );

    for (const ticket of tickets) {
      ticket.user = null; // Sever the identity tie

      // Scrub only the messages sent by the user (Admin messages are safe)
      ticket.messages.forEach((msg) => {
        if (
          msg.senderRole === MessageSenderRole.USER &&
          String(msg.senderId) === safeUserId
        ) {
          msg.message = "[Redacted via DPDP/GDPR Right to be Forgotten]";
          msg.attachments = []; // Destroy photographic PII
        }
      });

      await ticket.save({ session });
    }

    logger.info(
      `[Privacy Engine] Anonymized Support Tickets for User: ${safeUserId}`,
    );
  }
}
