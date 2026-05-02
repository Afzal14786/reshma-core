import mongoose from "mongoose";
import { Order } from "./order.model";
import { Cart } from "../cart/cart.model";
import { Product } from "../products/models/base-product.model";
import { User } from "../users/user.model"; // Added for Notification data
import { NotificationService } from "../notifications/notification.service"; // Added Notification Engine
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { CheckoutInput } from "./dtos/order.dto";
import razorpay from "@config/razorpay";
import logger from "@config/logger";
import {
  IOrderItem,
  IOrder,
  IRazorpayWebhookBody,
} from "./interfaces/order.interface";
import { verifyRazorpaySignature, verifyWebhookEvent } from "./payment.utils";

export class OrderService {
  /**
   * Atomic Checkout Engine
   * * ARCHITECTURE NOTE:
   * Uses MongoDB ACID Transactions. If stock deduction fails on the 5th item, the previous 4
   * item deductions are mathematically rolled back. We never leave the DB in a corrupted state.
   */
  public static async initializeCheckout(
    userId: string,
    payload: CheckoutInput,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    let savedOrder: IOrder;

    try {
      // SECURITY: Strict CodeQL $eq wrapping to prevent query injection
      const cart = await Cart.findOne({
        user: { $eq: String(userId) },
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Your cart is empty.");
      }

      let subTotal = 0;
      const historicalItems: IOrderItem[] = [];

      // Atomic Stock Reservation Loop
      for (const item of cart.items) {
        // FIREWALL: Find and decrement stock in the exact same atomic query.
        // This eliminates Race Conditions (overselling) during high-traffic flash sales.
        const product = await Product.findOneAndUpdate(
          {
            _id: { $eq: String(item.product) },
            currentStock: { $gte: Number(item.quantity) },
            isActive: true,
          },
          {
            $inc: { currentStock: -Number(item.quantity) },
          },
          { session, new: true, lean: true },
        );

        if (!product) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            `Item out of stock or insufficient quantity.`,
          );
        }

        const activePrice =
          product.basePrice - product.basePrice * (product.discount / 100);
        subTotal += activePrice * item.quantity;

        const historyItem: IOrderItem = {
          product: item.product as mongoose.Types.ObjectId,
          name: product.name,
          sku: product.sku,
          quantity: item.quantity,
          priceAtPurchase: activePrice,
          imageSnapshot: product.images[0] || "",
        };

        if (item.selectedAttributes && item.selectedAttributes instanceof Map) {
          const formattedAttributes: Record<string, string> = {};
          for (const [key, value] of item.selectedAttributes.entries()) {
            formattedAttributes[key] = String(value);
          }
          historyItem.selectedAttributes = formattedAttributes;
        }

        historicalItems.push(historyItem);
      }

      const shippingCost = subTotal > 2000 ? 0 : 50;
      const taxAmount = subTotal * 0.18;
      const totalAmount = subTotal + shippingCost + taxAmount;

      // SECURITY FIX: Explicit Object Mapping to sever Taint Analysis chain.
      const safeShippingAddress = {
        fullName: String(payload.shippingAddress.fullName),
        phone: String(payload.shippingAddress.phone),
        streetAddress: String(payload.shippingAddress.streetAddress),
        city: String(payload.shippingAddress.city),
        state: String(payload.shippingAddress.state),
        postalCode: String(payload.shippingAddress.postalCode),
        country: String(payload.shippingAddress.country || "India"),
      };

      const orderPayload: Partial<IOrder> = {
        user: new mongoose.Types.ObjectId(userId),
        items: historicalItems,
        shippingAddress: safeShippingAddress,
        pricing: { subTotal, shippingCost, taxAmount, totalAmount },
        paymentMethod: payload.paymentMethod === "COD" ? "COD" : "RAZORPAY",
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
      };

      const orderDocuments = await Order.create([orderPayload], { session });
      savedOrder = orderDocuments[0] as IOrder;

      if (orderPayload.paymentMethod === "RAZORPAY") {
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: savedOrder.orderNumber,
          notes: { userId: String(userId) },
        });

        savedOrder.gatewayOrderId = rzpOrder.id;
        await savedOrder.save({ session });
      } else {
        // COD Orders proceed directly to processing
        savedOrder.orderStatus = "PROCESSING";
        await savedOrder.save({ session });
      }

      await Cart.findOneAndUpdate(
        { user: { $eq: String(userId) } },
        { $set: { items: [] } },
        { session },
      );

      // COMMIT: Database changes locked in
      await session.commitTransaction();
      logger.info(`Checkout successful`, { orderId: savedOrder._id, userId });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // --- ASYNC NOTIFICATION ENGINE TRIGGER ---
    // Safely executed outside the transaction to prevent blocking
    if (savedOrder.paymentMethod === "COD") {
      try {
        const userDoc = await User.findOne({ _id: { $eq: String(userId) } })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderConfirmationNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            savedOrder.orderNumber,
            savedOrder.pricing.totalAmount,
          );
        }
      } catch (notifyErr) {
        logger.error(
          `Failed to dispatch COD confirmation for ${savedOrder.orderNumber}`,
          notifyErr,
        );
      }
    }

    return savedOrder;
  }

  /**
   * Frontend Cryptographic Handshake
   */
  public static async verifyFrontendPayment(
    userId: string,
    gatewayOrderId: string,
    gatewayPaymentId: string,
    gatewaySignature: string,
  ) {
    const order = await Order.findOne({
      gatewayOrderId: { $eq: String(gatewayOrderId) },
      user: { $eq: String(userId) },
    });

    if (!order) throw new AppError(HTTP_STATUS.NOT_FOUND, "Order not found.");

    if (order.paymentStatus === "PAID") return order;

    const isValid = verifyRazorpaySignature(
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
    );

    if (!isValid) {
      logger.error(`Cryptographic signature mismatch`, { orderId: order._id });
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Payment verification failed.",
      );
    }

    order.paymentStatus = "PAID";
    order.orderStatus = "PROCESSING";
    order.gatewayPaymentId = gatewayPaymentId;
    order.gatewaySignature = gatewaySignature;

    await order.save();
    logger.info(`Order Paid via Frontend Handshake`, {
      orderNumber: order.orderNumber,
    });

    // --- ASYNC NOTIFICATION ENGINE TRIGGER ---
    try {
      const userDoc = await User.findOne({ _id: { $eq: String(userId) } })
        .select("firstname email")
        .lean();

      if (userDoc) {
        await NotificationService.sendOrderConfirmationNotification(
          userDoc._id as mongoose.Types.ObjectId,
          userDoc.email,
          userDoc.firstname,
          order.orderNumber,
          order.pricing.totalAmount,
        );
      }
    } catch (notifyErr) {
      logger.error(
        `Failed to dispatch Razorpay confirmation for ${order.orderNumber}`,
        notifyErr,
      );
    }

    return order;
  }

  /**
   * Server-to-Server Webhook Processing
   */
  public static async processWebhook(
    rawBody: string,
    parsedBody: IRazorpayWebhookBody,
    signature: string,
  ) {
    const isValid = verifyWebhookEvent(rawBody, signature);
    if (!isValid) {
      logger.error(`[Webhook] Critical: Invalid Razorpay Signature Detected`);
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "Invalid webhook signature");
    }

    const event = parsedBody.event;

    if (event === "order.paid") {
      const paymentEntity = parsedBody.payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;

      const order = await Order.findOne({
        gatewayOrderId: { $eq: String(rzpOrderId) },
      });

      if (!order) return;

      if (order.paymentStatus === "PAID") {
        logger.info(
          `[Webhook] Order ${order.orderNumber} already PAID. Ignoring idempotent ping.`,
        );
        return;
      }

      order.paymentStatus = "PAID";
      order.orderStatus = "PROCESSING";
      order.gatewayPaymentId = paymentEntity.id;
      await order.save();

      logger.info(
        `[Webhook] Order ${order.orderNumber} marked as PAID via background ping.`,
      );

      // --- ASYNC NOTIFICATION ENGINE TRIGGER ---
      try {
        const userDoc = await User.findOne({ _id: { $eq: String(order.user) } })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderConfirmationNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            order.orderNumber,
            order.pricing.totalAmount,
          );
        }
      } catch (notifyErr) {
        logger.error(
          `Failed to dispatch Webhook confirmation for ${order.orderNumber}`,
          notifyErr,
        );
      }
    }
  }

  /**
   * Abandoned Order Recovery (Inventory Defragmentation)
   */
  public static async recoverAbandonedOrders() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const abandonedOrders = await Order.find({
      orderStatus: "PENDING",
      createdAt: { $lt: thirtyMinutesAgo },
    });

    if (abandonedOrders.length === 0) return;

    logger.info(
      `[Cron] Found ${abandonedOrders.length} abandoned orders. Beginning inventory restoration.`,
    );

    for (const order of abandonedOrders) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        order.orderStatus = "CANCELLED";

        for (const item of order.items) {
          await Product.findOneAndUpdate(
            { _id: { $eq: String(item.product) } },
            { $inc: { currentStock: item.quantity } },
            { session },
          );
        }

        await order.save({ session });
        await session.commitTransaction();
        logger.info(
          `[Cron] Restored inventory for abandoned order: ${order.orderNumber}`,
        );
      } catch (error) {
        await session.abortTransaction();
        logger.error(
          `[Cron] Failed to restore order ${order.orderNumber}:`,
          error,
        );
        continue; // Skip notification on failure
      } finally {
        session.endSession();
      }

      // Executed outside the transaction, and only if the commit succeeded
      try {
        const userDoc = await User.findOne({ _id: { $eq: String(order.user) } })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderCancelledNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            order.orderNumber,
            "Payment timeout. Your order was abandoned at checkout.",
          );
        }
      } catch (notifyErr) {
        logger.error(
          `Failed to dispatch cancellation notification for ${order.orderNumber}`,
          notifyErr,
        );
      }
    }
  }
}
