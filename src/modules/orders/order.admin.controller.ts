import { Request, Response } from "express";
import { Order } from "./order.model";
import { User } from "../users/user.model"; // FIX: Imported User Model for Logistics Hook
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { UpdateOrderStatusInput } from "./dtos/order.dto";
import { NotificationService } from "../notifications/notification.service";
import logger from "@config/logger";

export class OrderAdminController {
  /**
   * @route   GET /api/v1/orders/admin
   * @desc    View all orders across the platform for fulfillment
   * @access  Private (Admin Only - Protected by RBAC Middleware)
   */
  public static async getAllOrders(req: Request, res: Response) {
    const orders = await Order.find()
      .sort("-createdAt")
      .populate("user", "firstname lastname email")
      .lean();

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Platform orders fetched successfully",
      { orders },
    ).send();
  }

  /**
   * @route   PATCH /api/v1/orders/admin/:id/status
   * @desc    Progress the order through its lifecycle (PROCESSING -> SHIPPED -> DELIVERED)
   * @access  Private (Admin Only)
   */
  public static async updateOrderStatus(req: Request, res: Response) {
    const { id } = req.params;
    const payload = req.body as UpdateOrderStatusInput;

    // SECURITY: Object.create(null) ensures prototype chain is dead, mitigating Prototype Pollution
    const sanitizedPayload = Object.create(null);
    if (payload.orderStatus) sanitizedPayload.orderStatus = payload.orderStatus;
    if (payload.trackingNumber)
      sanitizedPayload.trackingNumber = payload.trackingNumber;
    if (payload.courierName) sanitizedPayload.courierName = payload.courierName;

    const order = await Order.findOneAndUpdate(
      { _id: { $eq: String(id) } },
      { $set: sanitizedPayload },
      { new: true, runValidators: true },
    );

    if (!order) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Order not found");
    }

    // AUTOMATED SHIPPING LOGISTICS HOOK
    if (order.orderStatus === "SHIPPED") {
      try {
        // Fetch the user data needed for email routing
        const user = await User.findById(order.user)
          .select("email firstname")
          .lean();

        if (user) {
          // Fire-and-forget: Route through the Notification Facade (BullMQ Async)
          await NotificationService.sendOrderShippedNotification(
            user._id as any,
            user.email,
            user.firstname,
            order.orderNumber,
            order.trackingNumber || "Pending",
            order.courierName || "Standard Delivery",
          );
        }
      } catch (error) {
        // Non-blocking catch: If Redis fails, the DB state update still succeeds.
        logger.error(
          `Failed to queue shipping notification: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      `Order status updated to ${order.orderStatus}`,
      { order },
    ).send();
  }
}
