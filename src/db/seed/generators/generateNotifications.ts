import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import { Order } from "@modules/orders/order.model";
import { ReturnModel } from "@modules/returns/return.model";
import { User } from "@modules/users/user.model";
import { INotificationInput } from "../types";

/**
 * Safely create a notification object – `link` is omitted if undefined to satisfy exactOptionalPropertyTypes.
 */
const createNotification = (
  recipientId: Types.ObjectId,
  type: INotificationInput["type"],
  title: string,
  message: string,
  link: string | undefined,
  createdAt: Date,
  isRead: boolean = false,
): INotificationInput => {
  const base = {
    recipientId,
    type,
    title,
    message,
    isRead,
    createdAt,
    updatedAt: createdAt,
  };
  if (link) {
    return { ...base, link };
  }
  return base;
};

/**
 * Main generator: fetches orders, returns, and creates notifications.
 */
export const generateNotifications = async (): Promise<
  INotificationInput[]
> => {
  const notifications: INotificationInput[] = [];

  // ---- Fetch orders with populated user ----
  const orders = await Order.find().populate("user", "_id").lean();

  if (orders.length > 0) {
    for (const order of orders) {
      // Safely extract user ID – order.user is populated as an object with _id
      const userId = (order.user as unknown as { _id: Types.ObjectId })._id;
      const orderNumber = order.orderNumber || "N/A";
      const createdAt = order.createdAt || new Date();

      // 1. Order placed notification (always)
      notifications.push(
        createNotification(
          userId,
          "ORDER",
          `Order Confirmed: ${orderNumber}`,
          `Your order #${orderNumber} has been successfully placed.`,
          `/orders/${orderNumber}`,
          createdAt,
          Math.random() > 0.3, // 70% read, 30% unread
        ),
      );

      // 2. Order shipped
      if (order.orderStatus === "SHIPPED") {
        const shippedAt =
          order.updatedAt ||
          new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);
        notifications.push(
          createNotification(
            userId,
            "ORDER",
            `Order Shipped: ${orderNumber}`,
            `Your order #${orderNumber} is on the way!`,
            `/orders/${orderNumber}`,
            shippedAt,
            Math.random() > 0.2,
          ),
        );
      }

      // 3. Order delivered – use updatedAt as a proxy (deliveredAt is not in the schema)
      if (order.orderStatus === "DELIVERED") {
        const deliveredAt =
          order.updatedAt ||
          new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000);
        notifications.push(
          createNotification(
            userId,
            "ORDER",
            `Order Delivered: ${orderNumber}`,
            `Your order #${orderNumber} has been delivered. Enjoy your purchase!`,
            `/orders/${orderNumber}`,
            deliveredAt,
            Math.random() > 0.1,
          ),
        );
      }

      // 4. Order cancelled – use updatedAt as proxy
      if (order.orderStatus === "CANCELLED") {
        const cancelledAt =
          order.updatedAt ||
          new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
        notifications.push(
          createNotification(
            userId,
            "ORDER",
            `Order Cancelled: ${orderNumber}`,
            `Your order #${orderNumber} has been cancelled.`,
            `/orders/${orderNumber}`,
            cancelledAt,
            true,
          ),
        );
      }
    }
  }

  // ---- Fetch returns with populated order ----
  const returns = await ReturnModel.find()
    .populate("order", "orderNumber")
    .lean();

  if (returns.length > 0) {
    for (const ret of returns) {
      const userId = ret.user;
      // Safely extract orderNumber from populated order
      const orderNumber =
        (ret.order as unknown as { orderNumber?: string })?.orderNumber ||
        "N/A";
      // Use type assertion for fields not in the public interface (they exist in the document)
      const returnNumber = (ret as any).returnNumber || "N/A";
      const createdAt = ret.createdAt || new Date();

      // 5. Return requested
      notifications.push(
        createNotification(
          userId,
          "SYSTEM",
          `Return Requested: ${returnNumber}`,
          `Your return request for order ${orderNumber} has been received.`,
          `/returns/${returnNumber}`,
          createdAt,
          Math.random() > 0.3,
        ),
      );

      // 6. Return approved – compare status as string
      const status = ret.status as string;
      if (status === "APPROVED") {
        const approvedAt =
          ret.updatedAt ||
          new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
        notifications.push(
          createNotification(
            userId,
            "SYSTEM",
            `Return Approved: ${returnNumber}`,
            `Your return for order ${orderNumber} has been approved.`,
            `/returns/${returnNumber}`,
            approvedAt,
            Math.random() > 0.2,
          ),
        );
      }

      // 7. Return rejected
      if (status === "REJECTED") {
        const rejectedAt =
          ret.updatedAt ||
          new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
        notifications.push(
          createNotification(
            userId,
            "SYSTEM",
            `Return Declined: ${returnNumber}`,
            `Your return for order ${orderNumber} was not approved. Please contact support.`,
            `/returns/${returnNumber}`,
            rejectedAt,
            Math.random() > 0.1,
          ),
        );
      }

      // 8. Return refunded (completed)
      if (status === "COMPLETED") {
        const refundedAt =
          ret.updatedAt ||
          new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);
        // refundAmount may not be on the interface; use type assertion
        const refundAmount = (ret as any).refundAmount || 0;
        notifications.push(
          createNotification(
            userId,
            "SYSTEM",
            `Refund Processed: ${returnNumber}`,
            `A refund of ₹${refundAmount.toFixed(2)} has been processed for order ${orderNumber}.`,
            `/returns/${returnNumber}`,
            refundedAt,
            Math.random() > 0.1,
          ),
        );
      }
    }
  }

  // ---- Add some random security notifications for a few users ----
  const users = await User.find().limit(10).select("_id").lean();
  if (users.length > 0) {
    for (const user of users) {
      if (Math.random() > 0.3) continue;
      notifications.push(
        createNotification(
          user._id,
          "SECURITY",
          "Password Updated",
          "Your account password was successfully changed.",
          "/profile/security",
          faker.date.recent({ days: 30 }),
          Math.random() > 0.3,
        ),
      );
      if (Math.random() > 0.5) {
        notifications.push(
          createNotification(
            user._id,
            "SECURITY",
            "New Login Detected",
            "A new login to your account was detected from a new device.",
            "/profile/security",
            faker.date.recent({ days: 15 }),
            Math.random() > 0.2,
          ),
        );
      }
    }
  }

  // ---- Add some promotional notifications (random) ----
  const promoUsers = await User.find().limit(20).select("_id").lean();
  if (promoUsers.length > 0) {
    for (const user of promoUsers) {
      if (Math.random() > 0.2) continue;
      notifications.push(
        createNotification(
          user._id,
          "PROMOTION",
          "Festival Sale!",
          "Get up to 50% off on selected items. Use code FESTIVE50.",
          "/shop",
          faker.date.recent({ days: 10 }),
          Math.random() > 0.5,
        ),
      );
    }
  }

  return notifications;
};
