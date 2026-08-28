import { Request, Response, NextFunction } from "express";
import { SupportService } from "./support.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { MessageSenderRole } from "./interfaces/support.interface";
import { ReplyTicketInput, UpdateTicketStateInput } from "./dtos/support.dto";
import { getAuditContext } from "@shared/utils/audit.utils";

/**
 * ADMIN SUPPORT CONTROLLER (Staff Dashboard)
 * @description Exposes global read/write privileges for staff to arbitrate tickets.
 * MUST be protected by `restrictTo("ADMIN")` middleware at the route level.
 */
export class SupportAdminController {
  /**
   * @route   GET /api/v1/support/admin/tickets
   * @desc    View all support tickets across the platform with filtering
   * @access  Private (Admin Only)
   */
  public static async getAllTickets(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Dynamic Filtering (Safe $eq mapping)
      const query: Record<string, unknown> = {};
      if (req.query.status) query.status = { $eq: String(req.query.status) };
      if (req.query.priority)
        query.priority = { $eq: String(req.query.priority) };
      if (req.query.category)
        query.category = { $eq: String(req.query.category) };

      const { tickets, meta } = await SupportService.fetchTickets(
        query,
        limit,
        skip,
      );

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Platform support queue fetched successfully.",
        { tickets, meta },
      ).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/v1/support/admin/tickets/:ticketId/reply
   * @desc    Admin replies to a customer's ticket
   * @access  Private (Admin Only)
   */
  public static async replyToTicket(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const adminId = String(req.user!._id);
      const ticketId = String(req.params.ticketId);
      const payload = req.body as ReplyTicketInput;

      const auditContext = getAuditContext(req);

      // Extract Cloudinary attachments (if Admin needs to send a screenshot/document)
      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file: Express.Multer.File) => {
          if (file.path) attachmentUrls.push(file.path);
        });
      }

      const ticket = await SupportService.replyToTicket(
        ticketId,
        adminId,
        MessageSenderRole.ADMIN, // Force ADMIN state shift
        payload,
        attachmentUrls,
        auditContext,
      );

      new ApiResponse(res, HTTP_STATUS.OK, "Admin reply posted successfully.", {
        ticket,
      }).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/support/admin/tickets/:ticketId/state
   * @desc    Update ticket status, priority, or assign it to an Admin
   * @access  Private (Admin Only)
   */
  public static async updateTicketState(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const ticketId = String(req.params.ticketId);
      const payload = req.body as UpdateTicketStateInput;

      const auditContext = getAuditContext(req);

      const ticket = await SupportService.updateTicketState(
        ticketId,
        payload,
        auditContext,
      );

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Ticket state updated successfully.",
        { ticket },
      ).send();
    } catch (error) {
      next(error);
    }
  }
}
