import { Request, Response } from "express";
import { Order } from "./order.model";
import { User } from "../users/user.model"; // Logistics Hook Dependency
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { UpdateOrderStatusInput } from "./dtos/order.dto";
import { NotificationService } from "../notifications/notification.service";
import { ShiprocketService } from "./shiprocket.service";
import { DispatchOrderInput } from "./dtos/order.dto";

// audit imports
import { AuditLogService } from "@modules/audit-logs/audit-log.service";
import {
  AuditAction,
  AuditModule,
} from "@modules/audit-logs/audit-log.interface";
import { getAuditContext } from "@shared/utils/audit.utils";
import { IOrder } from "./interfaces/order.interface";

import logger from "@config/logger";
import mongoose from "mongoose";

export class OrderAdminController {
  /**
   * @route   GET /api/v1/orders/admin
   * @desc    View all orders across the platform for fulfillment
   * @access  Private (Admin Only - Protected by RBAC Middleware)
   */
  public static async getAllOrders(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { status, q } = req.query;

    const query: Record<string, unknown> = {};

    if (status) {
      query.orderStatus = { $eq: String(status) };
    }

    if (q) {
      const searchRegex = { $regex: String(q), $options: "i" };
      const matchingUsers = await User.find({
        $or: [
          { email: searchRegex },
          { firstname: searchRegex },
          { lastname: searchRegex },
        ],
      })
        .select("_id")
        .lean();

      query.$or = [
        { orderNumber: searchRegex },
        { user: { $in: matchingUsers.map((u) => u._id) } },
      ];
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate("user", "firstname lastname email")
        .lean(),
      Order.countDocuments(query),
    ]);

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Platform orders fetched successfully",
      {
        orders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    ).send();
  }

  /**
   * @route   GET /api/v1/orders/admin/:id
   * @desc    Fetch a single order's full detail for the admin fulfillment view
   * @access  Private (Admin Only)
   */
  public static async getOrderById(req: Request, res: Response) {
    const id = String(req.params.id);

    const order = await Order.findOne({ _id: { $eq: id } })
      .populate("user", "firstname lastname email")
      .lean();

    if (!order) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Order not found");
    }

    return new ApiResponse(res, HTTP_STATUS.OK, "Order fetched successfully", {
      order,
    }).send();
  }

  /**
   * @route   PATCH /api/v1/orders/admin/:id/status
   * @desc    Progress the order through its lifecycle (PROCESSING -> SHIPPED -> DELIVERED)
   * @access  Private (Admin Only)
   */
  public static async updateOrderStatus(req: Request, res: Response) {
    const id = String(req.params.id);
    const payload = req.body as UpdateOrderStatusInput;

    // capture admin context for audit
    const auditContext = getAuditContext(req);
    let beforeOrder: IOrder | null = null;

    if (auditContext) {
      beforeOrder = (await Order.findOne({
        _id: { $eq: id },
      }).lean()) as IOrder | null;
    }

    // SECURITY: Object.create(null) ensures prototype chain is dead, mitigating Prototype Pollution
    const sanitizedPayload = Object.create(null);
    if (payload.orderStatus) sanitizedPayload.orderStatus = payload.orderStatus;
    if (payload.trackingNumber)
      sanitizedPayload.trackingNumber = payload.trackingNumber;
    if (payload.courierName) sanitizedPayload.courierName = payload.courierName;

    const order = await Order.findOneAndUpdate(
      { _id: { $eq: id } },
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
            user._id as unknown as mongoose.Types.ObjectId,
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

    // audit log -- update order status
    if (auditContext) {
      await AuditLogService.log({
        adminId: auditContext.adminId,
        adminEmail: auditContext.adminEmail,
        adminName: auditContext.adminName,
        action: AuditAction.UPDATE,
        module: AuditModule.ORDER,
        targetId: id,
        targetName: order.orderNumber,
        changes: {
          before: beforeOrder as unknown as Record<string, unknown>,
          after: order.toObject() as unknown as Record<string, unknown>,
        },
        ...(auditContext.ipAddress
          ? { ipAddress: auditContext.ipAddress }
          : {}),
        ...(auditContext.userAgent
          ? { userAgent: auditContext.userAgent }
          : {}),
      });
    }

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      `Order status updated to ${order.orderStatus}`,
      { order },
    ).send();
  }

  /**
   * @route   POST /api/v1/orders/admin/:id/dispatch
   * @desc    Physical Fulfillment Engine. Triggers Shiprocket to generate an AWB and schedule a courier.
   * @access  Private (Admin Only)
   */
  public static async dispatchOrder(req: Request, res: Response) {
    const orderId = String(req.params.id);

    // capture admin context for audit
    const auditContext = getAuditContext(req);
    let beforeOrder: IOrder | null = null;

    if (auditContext) {
      beforeOrder = (await Order.findOne({
        _id: { $eq: orderId },
      }).lean()) as IOrder | null;
    }

    // SECURITY FIREWALL (CodeQL Mitigation)
    // CodeQL flags `req.body.length` as a Type Confusion vulnerability because an attacker
    // could pass a JSON Array where `.length` evaluates to an integer.
    // While our Zod middleware intercepts this, this explicit guard provides static proof to CodeQL.
    if (!req.body || Array.isArray(req.body) || typeof req.body !== "object") {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Invalid payload format. Expected a strict JSON object.",
      );
    }

    const dimensions = req.body as DispatchOrderInput;

    // This service handles the 3-step Shiprocket handshake and atomic MongoDB updates
    await ShiprocketService.dispatchOrder(orderId, dimensions);

    // Fetch the freshly updated order to return to the frontend
    const updatedOrder = await Order.findById(orderId).lean();

    // audit logs
    if (auditContext) {
      await AuditLogService.log({
        adminId: auditContext.adminId,
        adminEmail: auditContext.adminEmail,
        adminName: auditContext.adminName,
        action: AuditAction.UPDATE,
        module: AuditModule.ORDER,
        targetId: orderId,
        targetName: updatedOrder?.orderNumber || "Unknown Order",
        changes: {
          before: beforeOrder as unknown as Record<string, unknown>,
          after: updatedOrder as unknown as Record<string, unknown>,
        },
        payload: dimensions,
        ...(auditContext.ipAddress
          ? { ipAddress: auditContext.ipAddress }
          : {}),
        ...(auditContext.userAgent
          ? { userAgent: auditContext.userAgent }
          : {}),
      });
    }

    return new ApiResponse(
      res,
      HTTP_STATUS.OK,
      "Order successfully dispatched via Shiprocket. AWB Generated.",
      { order: updatedOrder },
    ).send();
  }
}
