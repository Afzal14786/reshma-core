import { dispatchEmailJob } from "../../shared/queues/email.queue";
import { EmailJobPayload } from "./interface/email.interface";
import { Notification } from "./notification.model";
import { Types } from "mongoose";
import logger from "../../config/logger";

// Template Imports
import { otpVerificationTemplate } from "./templates/otp-verification";
import { welcomeEmailTemplate } from "./templates/welcome";
import { passwordResetTemplate } from "./templates/password-reset";
import { passwordUpdateTemplate } from "./templates/password-update";

/**
 * UNIFIED NOTIFICATION SERVICE
 * * ARCHITECTURE NOTE:
 * This acts as the central Nervous System for the application. Controllers
 * should never format emails or DB notifications directly.
 *
 * * PERFORMANCE OPTIMIZATION (FIRE-AND-FORGET):
 * Email dispatching utilizes Redis (BullMQ), which is sub-millisecond. However,
 * writing In-App notifications to MongoDB can cause latency spikes. Therefore,
 * all `Notification.create()` calls drop the `await` keyword. They are offloaded
 * to the Node.js background event loop with a `.catch()` block to log errors silently,
 * ensuring the HTTP response returns to the client instantly.
 */
export class NotificationService {
  // SYSTEM TRIGGERS

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
    // Queue the HTML Email (Fast Redis operation)
    await dispatchEmailJob({
      type: "WELCOME_EMAIL",
      to: email,
      data: { firstname },
    });

    // Fire-and-Forget In-App Notification (Non-blocking DB write)
    Notification.create({
      recipientId: userId,
      type: "SYSTEM",
      title: "Welcome to Reshma Bangles!",
      message:
        "Your account is fully activated. Enjoy exploring our collections.",
      link: "/shop",
    }).catch((err) => {
      logger.error(
        `[Notification DB Error] Welcome alert failed for ${userId}`,
        err,
      );
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

  /**
   * Dispatches the 6-digit OTP specifically for logged-in users attempting a password change.
   */
  public static async sendPasswordUpdateOtp(
    to: string,
    firstname: string,
    otp: string,
  ): Promise<void> {
    await dispatchEmailJob({
      type: "OTP_VERIFICATION",
      to,
      data: { firstname, otp },
    });
    logger.info(`[Notification] Password Update OTP queued for ${to}`);
  }

  /**
   * Dispatches an alert confirming a successful password change.
   * Leverages the strict IProfileUpdateJob typing.
   */
  public static async sendPasswordUpdateConfirmation(
    userId: Types.ObjectId,
    email: string,
    firstname: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    // Queue Email Payload (Strictly matches IProfileUpdateJob)
    await dispatchEmailJob({
      type: "PROFILE_UPDATE",
      to: email,
      data: {
        firstname,
        changedField: "Account Password",
        time: timestamp,
      },
    });

    // Fire-and-Forget In-App Notification (Non-blocking DB write)
    Notification.create({
      recipientId: userId,
      type: "SECURITY",
      title: "Password Updated Successfully",
      message:
        "Your account password was changed. If this wasn't you, contact support immediately.",
      link: "/profile/security",
    }).catch((err) => {
      logger.error(
        `[Notification DB Error] Security alert failed for ${userId}`,
        err,
      );
    });

    logger.info(
      `[Notification] Password Update alerts dispatched for User: ${userId}`,
    );
  }

  /**
   * Dispatches the "Order Shipped" transactional email via BullMQ
   * Also creates an In-App database notification.
   */
  public static async sendOrderShippedNotification(
    userId: Types.ObjectId,
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

    // Fire-and-Forget In-App Notification (Non-blocking DB write)
    Notification.create({
      recipientId: userId,
      type: "ORDER",
      title: `Order Shipped: ${orderNumber}`,
      message: `Your package is on the way via ${courierName}. Tracking: ${trackingNumber}`,
      link: `/orders/${orderNumber}`,
    }).catch((err) => {
      logger.error(
        `[Notification DB Error] Shipping alert failed for ${userId}`,
        err,
      );
    });

    logger.info(
      `[Notification] Shipping alerts dispatched for User: ${userId}`,
    );
  }

  // IN-APP NOTIFICATION MANAGEMENT

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

  // QUEUE COMPILER (Used ONLY by email.worker.ts)

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
          subject: `Security Alert: ${payload.data.changedField} Updated`,
          html: passwordUpdateTemplate(
            payload.data.firstname,
            payload.data.changedField,
            payload.data.time,
          ),
        };
      case "ORDER_CONFIRMATION":
        return {
          subject: `Order Confirmation #${payload.data.orderId}`,
          html: "<p>Order Confirmed.</p>", // We'll update this template later
        };
      case "ORDER_CANCELLED":
        return {
          subject: `Order Cancelled #${payload.data.orderId}`,
          html: "<p>Order Cancelled.</p>", // We'll update this template later
        };
      case "ORDER_SHIPPED":
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
}
