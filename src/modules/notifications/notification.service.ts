import { dispatchEmailJob } from "@shared/queues/email.queue";
import { EmailJobPayload } from "./interface/email.interface";
import { Notification } from "./notification.model";
import { Types } from "mongoose";
import logger from "@config/logger";

// Template Imports
import { otpVerificationTemplate } from "./templates/otp-verification";
import { welcomeEmailTemplate } from "./templates/welcome";
import { passwordResetTemplate } from "./templates/password-reset";

/**
 * Unified Notification Service
 * * ARCHITECTURE NOTE:
 * This acts as the central Nervous System for the application. Controllers
 * should never format emails or DB notifications directly; they hand the data
 * to this Facade layer, which handles routing the message to the proper queue or DB.
 */
export class NotificationService {
  // 1. System Triggers

  public static async sendOtpEmail(
    to: string,
    firstname: string,
    otp: string,
  ): Promise<void> {
    await dispatchEmailJob({
      type: "OTP_VERIFICATION",
      to,
      data: { firstname, otp },
    });
    logger.info(`[Notification] OTP email job queued for ${to}`);
  }

  public static async triggerWelcome(
    userId: Types.ObjectId,
    email: string,
    firstname: string,
  ): Promise<void> {
    // 1. Queue the HTML Email
    await dispatchEmailJob({
      type: "WELCOME_EMAIL",
      to: email,
      data: { firstname },
    });

    // 2. Push a permanent In-App Notification to their DB dashboard
    await Notification.create({
      recipientId: userId,
      type: "SYSTEM",
      title: "Welcome to Reshma Bangles!",
      message:
        "Your account is fully activated. Enjoy exploring our collections.",
      link: "/shop",
    });

    logger.info(
      `[Notification] Welcome sequence triggered for User ID: ${userId}`,
    );
  }

  public static async sendPasswordReset(
    to: string,
    firstname: string,
    resetToken: string,
  ): Promise<void> {
    await dispatchEmailJob({
      type: "PASSWORD_RESET",
      to,
      data: { firstname, resetToken },
    });
    logger.info(`[Notification] Password reset job queued for ${to}`);
  }

  // 2. In-App Notification Management

  /**
   * Fetches paginated unread notifications for a specific user.
   */
  public static async getUserNotifications(
    userId: Types.ObjectId,
    limit = 10,
    skip = 0,
  ) {
    return await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);
  }

  /**
   * Marks a specific notification as read, ensuring it belongs to the requesting user.
   */
  public static async markAsRead(
    notificationId: string,
    userId: Types.ObjectId,
  ) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { isRead: true },
      { new: true },
    );
  }

  // 3. Queue Compiler (Used ONLY by email.worker.ts)

  /**
   * Resolves the HTML template and Subject based on the Discriminator Type.
   * Guaranteed safe by TypeScript exhaustive checks.
   */
  public static compileEmailTemplate(payload: EmailJobPayload): {
    subject: string;
    html: string;
  } {
    switch (payload.type) {
      case "OTP_VERIFICATION":
        return {
          subject: "Verify Your Email - Reshma Bangles",
          html: otpVerificationTemplate(
            payload.data.firstname,
            payload.data.otp,
          ),
        };
      case "WELCOME_EMAIL":
        return {
          subject: "Welcome to Reshma Bangles!",
          html: welcomeEmailTemplate(payload.data.firstname),
        };
      case "PASSWORD_RESET":
        return {
          subject: "Password Reset Instructions",
          html: passwordResetTemplate(
            payload.data.firstname,
            payload.data.resetToken,
          ),
        };
      case "PROFILE_UPDATE":
        return {
          subject: "Security Alert: Profile Updated",
          html: "<p>Profile updated.</p>",
        };
      case "ORDER_CONFIRMATION":
        return {
          subject: `Order Confirmation #${payload.data.orderId}`,
          html: "<p>Order Confirmed.</p>",
        };
      case "ORDER_CANCELLED":
        return {
          subject: `Order Cancelled #${payload.data.orderId}`,
          html: "<p>Order Cancelled.</p>",
        };

      case "ORDER_SHIPPED": // FIX: Properly integrated into the switch
        return {
          subject: `Your Reshma Bangles Order ${payload.data.orderNumber} has shipped!`,
          html: `
              <h2>Hey, ${payload.data.firstname}!</h2>
              <p>Your order <strong>${payload.data.orderNumber}</strong> has been handed over to <strong>${payload.data.courierName}</strong>.</p>
              <p>Your Tracking Number is: <strong>${payload.data.trackingNumber}</strong></p>
          `,
        };
      default:
        // We stringify the raw payload to capture the bug in server logs.
        const _exhaustiveCheck: never = payload;
        throw new Error(
          `Unhandled email type. Payload: ${JSON.stringify(payload)}`,
        );
    }
  }

  /**
   * Dispatches the "Order Shipped" transactional email via BullMQ
   * Also creates an In-App database notification.
   */
  public static async sendOrderShippedNotification(
    userId: Types.ObjectId, // Added so we can send an in-app notification too!
    email: string,
    firstname: string,
    orderNumber: string,
    trackingNumber: string,
    courierName: string,
  ): Promise<void> {
    // Dispatch Async Email via Redis Worker
    await dispatchEmailJob({
      type: "ORDER_SHIPPED",
      to: email,
      data: { firstname, orderNumber, trackingNumber, courierName },
    });

    // Dispatch Synchronous In-App Notification
    await Notification.create({
      recipientId: userId,
      type: "ORDER",
      title: `Order Shipped: ${orderNumber}`,
      message: `Your package is on the way via ${courierName}. Tracking: ${trackingNumber}`,
      link: `/orders/${orderNumber}`,
    });

    logger.info(
      `[Notification] Shipping alerts queued and saved for User: ${userId}`,
    );
  }
}
