import mongoose from "mongoose";
import { Order } from "./order.model";
import { Cart } from "../cart/cart.model";
import { Product } from "../products/models";
import { User } from "../users/user.model";
import { NotificationService } from "../notifications/notification.service";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { CheckoutInput } from "./dtos/order.dto";
import razorpay from "@config/razorpay";
import logger from "@config/logger";
import { CouponModel } from "@modules/coupons/coupon.model";
import { CouponService } from "@modules/coupons/coupon.service";
import { TaxEngine, TaxProfile } from "./tax.utils";
import { InvoiceQueueManager } from "@shared/queues/invoice.queue";
import {
  IOrderItem,
  IOrder,
  IRazorpayWebhookBody,
} from "./interfaces/order.interface";
import { verifyRazorpaySignature, verifyWebhookEvent } from "./payment.utils";

export class OrderService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Cleans strings of control characters before logging.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

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
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    try {
      const cart = await Cart.findOne({
        user: { $eq: safeUserId },
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Your cart is empty.");
      }

      let subTotal = 0;
      const deductedItems = [];

      // PASS 1: Atomic Stock Reservation & Subtotal
      for (const item of cart.items) {
        // Find and decrement stock in the exact same atomic query
        // Returning lean() gives us the hsnCode and taxProfile needed for Pass 2
        const product: any = await Product.findOneAndUpdate(
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
            `Item out of stock or insufficient quantity. Checkout halted.`,
          );
        }

        const activePrice =
          product.basePrice - product.basePrice * (product.discount / 100);
        const preCouponTotal = activePrice * item.quantity;
        subTotal += preCouponTotal;

        deductedItems.push({
          item,
          product,
          activePrice,
          preCouponTotal,
        });
      }

      // COUPON VALIDATION & DYNAMIC RE-CALCULATION
      let discountAmount = 0;
      const appliedCoupon = cart.appliedCoupon || null;

      if (appliedCoupon) {
        const couponCheck = await CouponModel.findById(appliedCoupon)
          .session(session)
          .lean();

        if (
          !couponCheck ||
          !couponCheck.isActive ||
          new Date() > couponCheck.expiryDate ||
          couponCheck.usedCount >= couponCheck.usageLimit
        ) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            "The promotional code applied has expired or reached its limit. Please refresh your cart.",
          );
        }

        // CRITICAL TOCTOU FIX: We MUST recalculate the discount against the LIVE subTotal
        // to prevent users from keeping discounts if an admin changed the product price.
        try {
          const recalculation =
            await CouponService.validateAndCalculateDiscount(
              couponCheck.code,
              subTotal,
              safeUserId,
              payload.paymentMethod, // Passed to enforce COD/Prepaid restrictions during checkout
            );
          discountAmount = recalculation.discountAmount;
        } catch (err: unknown) {
          const errMsg =
            err instanceof AppError
              ? err.message
              : "Cart no longer meets coupon requirements.";
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            `Coupon Invalidated: ${errMsg} Please refresh your cart.`,
          );
        }
      }

      // PASS 2: Proportional Discounting & Legal Tax Split
      const historicalItems: IOrderItem[] = [];
      let totalTax = 0,
        totalCgst = 0,
        totalSgst = 0,
        totalIgst = 0;

      for (const d of deductedItems) {
        // Proportional Discount Math
        const itemWeightInCart = subTotal > 0 ? d.preCouponTotal / subTotal : 0;
        const itemDiscount = discountAmount * itemWeightInCart;
        const postCouponTotal = d.preCouponTotal - itemDiscount;
        const discountedPricePerUnit = postCouponTotal / d.item.quantity;

        // Line-Item Tax Bracket Resolution
        const taxResult = TaxEngine.calculateLineItemTax(
          d.product.taxProfile as TaxProfile,
          discountedPricePerUnit,
          d.item.quantity,
        );

        // State Arbitration (CGST/SGST vs IGST)
        const taxSplit = TaxEngine.splitTaxByState(
          taxResult.totalTax,
          payload.shippingAddress.state,
        );

        totalTax += taxResult.totalTax;
        totalCgst += taxSplit.cgst;
        totalSgst += taxSplit.sgst;
        totalIgst += taxSplit.igst;

        // Construct Immutable Tax Snapshot
        const historyItem: IOrderItem = {
          product: d.item.product as mongoose.Types.ObjectId,
          name: d.product.name,
          sku: d.product.sku,
          quantity: d.item.quantity,
          priceAtPurchase: d.activePrice,
          imageSnapshot: d.product.images[0] || "",

          hsnCode: d.product.hsnCode,
          taxableValue: taxResult.taxableValue,
          gstRate: taxResult.gstRate,
          cgst: taxSplit.cgst,
          sgst: taxSplit.sgst,
          igst: taxSplit.igst,
        };

        if (
          d.item.selectedAttributes &&
          d.item.selectedAttributes instanceof Map
        ) {
          const formattedAttributes: Record<string, string> = {};
          for (const [key, value] of d.item.selectedAttributes.entries()) {
            formattedAttributes[key] = String(value);
          }
          historyItem.selectedAttributes = formattedAttributes;
        }

        historicalItems.push(historyItem);
      }

      // PASS 3: Shipping Tax & Final Assembly
      const totalAfterDiscount = subTotal - discountAmount;
      const shippingCost = totalAfterDiscount > 2000 ? 0 : 100; // Aligned with CartService free shipping rule

      // 18% Logistics Tax Isolation
      const shipTaxResult = TaxEngine.calculateShippingTax(shippingCost);
      const shipTaxSplit = TaxEngine.splitTaxByState(
        shipTaxResult.totalTax,
        payload.shippingAddress.state,
      );

      totalTax += shipTaxResult.totalTax;
      totalCgst += shipTaxSplit.cgst;
      totalSgst += shipTaxSplit.sgst;
      totalIgst += shipTaxSplit.igst;

      const totalAmount = totalAfterDiscount + totalTax + shippingCost;

      if (totalAmount < 0) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Total amount cannot be negative.",
        );
      }

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
        user: new mongoose.Types.ObjectId(safeUserId),
        items: historicalItems,
        shippingAddress: safeShippingAddress,
        pricing: {
          subTotal: Number(subTotal.toFixed(2)),
          discountAmount: Number(discountAmount.toFixed(2)),
          appliedCoupon,
          totalTax: Number(totalTax.toFixed(2)),
          totalCgst: Number(totalCgst.toFixed(2)),
          totalSgst: Number(totalSgst.toFixed(2)),
          totalIgst: Number(totalIgst.toFixed(2)),
          shippingCost: Number(shippingCost.toFixed(2)),
          shippingTax: Number(shipTaxResult.totalTax.toFixed(2)),
          totalAmount: Number(totalAmount.toFixed(2)),
        },
        paymentMethod: payload.paymentMethod === "COD" ? "COD" : "RAZORPAY",
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
      };

      const orderDocuments = await Order.create([orderPayload], { session });
      savedOrder = orderDocuments[0] as IOrder;

      if (!savedOrder)
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "Order creation failed.",
        );

      if (orderPayload.paymentMethod === "RAZORPAY") {
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: savedOrder.orderNumber,
          notes: { userId: safeUserId },
        });

        savedOrder.gatewayOrderId = rzpOrder.id;
        await savedOrder.save({ session });
      } else {
        savedOrder.orderStatus = "PROCESSING";
        await savedOrder.save({ session });

        if (appliedCoupon) {
          await CouponModel.findOneAndUpdate(
            { _id: { $eq: appliedCoupon } },
            { $inc: { usedCount: 1 } },
            { session },
          );
        }
      }

      await Cart.findOneAndUpdate(
        { user: { $eq: safeUserId } },
        {
          $set: {
            items: [],
            appliedCoupon: null,
            discountAmount: 0,
            totalAfterDiscount: 0,
          },
        },
        { session },
      );

      await session.commitTransaction();
      logger.info(
        this.safeLog(
          `Checkout successful for order ${savedOrder._id} and user ${safeUserId}`,
        ),
      );
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        this.safeLog(
          `[OrderService.initializeCheckout] Transaction Aborted: ${error instanceof Error ? error.message : "Unknown"}`,
        ),
      );
      throw error;
    } finally {
      await session.endSession();
    }

    // --- ASYNC NOTIFICATION & INVOICE ENGINE TRIGGER ---
    if (savedOrder.paymentMethod === "COD") {
      // FIRE AND FORGET: Drop invoice job into BullMQ (Non-blocking)
      await InvoiceQueueManager.enqueueInvoiceGeneration(
        savedOrder._id.toString(),
      );

      try {
        const userDoc = await User.findOne({ _id: { $eq: safeUserId } })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderConfirmationNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            savedOrder.orderNumber,
            savedOrder.pricing.totalAmount,
            savedOrder.items,
            savedOrder.shippingAddress,
          );
        }
      } catch (notifyErr) {
        logger.error(
          this.safeLog(
            `Failed to dispatch COD confirmation for ${savedOrder.orderNumber}`,
          ),
        );
      }
    }

    return savedOrder;
  }

  /**
   * Frontend Cryptographic Handshake
   * ARCHITECTURE NOTE: Uses Atomic Transitions to prevent Webhook Race Conditions.
   */
  public static async verifyFrontendPayment(
    userId: string,
    gatewayOrderId: string,
    gatewayPaymentId: string,
    gatewaySignature: string,
  ) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const safeGatewayOrderId = String(gatewayOrderId).replace(/[\r\n]/g, "");

    const order = await Order.findOne({
      gatewayOrderId: { $eq: safeGatewayOrderId },
      user: { $eq: safeUserId },
    });

    if (!order) throw new AppError(HTTP_STATUS.NOT_FOUND, "Order not found.");

    if (order.paymentStatus === "PAID") return order;

    const isValid = verifyRazorpaySignature(
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
    );

    if (!isValid) {
      logger.error(
        this.safeLog(`Cryptographic signature mismatch for order ${order._id}`),
      );
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Payment verification failed.",
      );
    }

    // ATOMIC TRANSITION
    // We only update if the status is strictly STILL pending at this exact millisecond.
    const lockedOrder = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: "PENDING" },
      {
        $set: {
          paymentStatus: "PAID",
          orderStatus: "PROCESSING",
          gatewayPaymentId: gatewayPaymentId,
          gatewaySignature: gatewaySignature,
        },
      },
      { new: true },
    );

    // If lockedOrder is null, the Webhook processed it milliseconds before the frontend redirect. Safely abort.
    if (!lockedOrder) return Order.findById(order._id);

    logger.info(
      this.safeLog(
        `Order Paid via Frontend Handshake: ${lockedOrder.orderNumber}`,
      ),
    );

    // ATOMIC SCARCITY: Increment usage
    if (lockedOrder.pricing && lockedOrder.pricing.appliedCoupon) {
      try {
        await CouponModel.findOneAndUpdate(
          { _id: { $eq: lockedOrder.pricing.appliedCoupon } },
          { $inc: { usedCount: 1 } },
        );
      } catch (err) {
        logger.error(
          this.safeLog(
            `Failed to increment coupon usage for order ${lockedOrder.orderNumber}`,
          ),
        );
      }
    }

    // --- ASYNC NOTIFICATION & INVOICE ENGINE TRIGGER ---
    await InvoiceQueueManager.enqueueInvoiceGeneration(
      lockedOrder._id.toString(),
    );

    try {
      const userDoc = await User.findOne({ _id: { $eq: safeUserId } })
        .select("firstname email")
        .lean();

      if (userDoc) {
        await NotificationService.sendOrderConfirmationNotification(
          userDoc._id as mongoose.Types.ObjectId,
          userDoc.email,
          userDoc.firstname,
          lockedOrder.orderNumber,
          lockedOrder.pricing.totalAmount,
          lockedOrder.items,
          lockedOrder.shippingAddress,
        );
      }
    } catch (notifyErr) {
      logger.error(
        this.safeLog(
          `Failed to dispatch Razorpay confirmation for ${lockedOrder.orderNumber}`,
        ),
      );
    }

    return lockedOrder;
  }

  /**
   * Server-to-Server Webhook Processing
   * ARCHITECTURE NOTE: Uses Atomic Transitions to guarantee Idempotency.
   */
  public static async processWebhook(
    rawBody: string,
    parsedBody: IRazorpayWebhookBody,
    signature: string,
  ) {
    const isValid = verifyWebhookEvent(rawBody, signature);
    if (!isValid) {
      logger.error(
        this.safeLog(`[Webhook] Critical: Invalid Razorpay Signature Detected`),
      );
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "Invalid webhook signature");
    }

    const event = parsedBody.event;

    if (event === "order.paid") {
      const paymentEntity = parsedBody.payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;

      // ATOMIC TRANSITION
      const lockedOrder = await Order.findOneAndUpdate(
        { gatewayOrderId: String(rzpOrderId), paymentStatus: "PENDING" },
        {
          $set: {
            paymentStatus: "PAID",
            orderStatus: "PROCESSING",
            gatewayPaymentId: paymentEntity.id,
          },
        },
        { new: true },
      );

      // If null, the Frontend Handshake already processed it. Safely abort.
      if (!lockedOrder) {
        logger.info(
          this.safeLog(
            `[Webhook] Order already PAID or not found. Ignoring idempotent ping.`,
          ),
        );
        return;
      }

      logger.info(
        this.safeLog(
          `[Webhook] Order ${lockedOrder.orderNumber} marked as PAID via background ping.`,
        ),
      );

      // ---> ATOMIC SCARCITY: Increment usage when Razorpay confirms money is in the bank
      if (lockedOrder.pricing && lockedOrder.pricing.appliedCoupon) {
        try {
          await CouponModel.findOneAndUpdate(
            { _id: { $eq: lockedOrder.pricing.appliedCoupon } },
            { $inc: { usedCount: 1 } },
          );
          logger.info(
            this.safeLog(
              `[Webhook] Incremented usage count for coupon on order ${lockedOrder.orderNumber}`,
            ),
          );
        } catch (couponErr) {
          logger.error(
            this.safeLog(
              `[Webhook] Failed to increment coupon usage for order ${lockedOrder.orderNumber}`,
            ),
          );
        }
      }

      // --- ASYNC NOTIFICATION & INVOICE ENGINE TRIGGER ---
      await InvoiceQueueManager.enqueueInvoiceGeneration(
        lockedOrder._id.toString(),
      );

      try {
        const userDoc = await User.findOne({
          _id: { $eq: String(lockedOrder.user) },
        })
          .select("firstname email")
          .lean();

        if (userDoc) {
          await NotificationService.sendOrderConfirmationNotification(
            userDoc._id as mongoose.Types.ObjectId,
            userDoc.email,
            userDoc.firstname,
            lockedOrder.orderNumber,
            lockedOrder.pricing.totalAmount,
            lockedOrder.items,
            lockedOrder.shippingAddress,
          );
        }
      } catch (notifyErr) {
        logger.error(
          this.safeLog(
            `Failed to dispatch Webhook confirmation for ${lockedOrder.orderNumber}`,
          ),
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
      this.safeLog(
        `[Cron] Found ${abandonedOrders.length} abandoned orders. Beginning inventory restoration.`,
      ),
    );

    for (const order of abandonedOrders) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Check if order is still pending (race condition safety)
        const stillPending = await Order.exists({
          _id: order._id,
          orderStatus: "PENDING",
        }).session(session);

        if (!stillPending) {
          await session.abortTransaction();
          continue;
        }

        // Atomically update to CANCELLED
        const lockedOrder = await Order.findOneAndUpdate(
          { _id: order._id, orderStatus: "PENDING" },
          { $set: { orderStatus: "CANCELLED" } },
          { session, returnDocument: "after" }, // updated
        );

        if (!lockedOrder) {
          await session.abortTransaction();
          continue;
        }

        // Restore inventory for each item
        for (const item of lockedOrder.items) {
          await Product.findOneAndUpdate(
            { _id: { $eq: String(item.product) } },
            { $inc: { currentStock: item.quantity } },
            { session },
          );
        }

        await session.commitTransaction();
        logger.info(
          this.safeLog(
            `[Cron] Restored inventory for abandoned order: ${lockedOrder.orderNumber}`,
          ),
        );

        // Send notification (outside transaction)
        try {
          const userDoc = await User.findOne({
            _id: { $eq: String(lockedOrder.user) },
          })
            .select("firstname email")
            .lean();

          if (userDoc) {
            await NotificationService.sendOrderCancelledNotification(
              userDoc._id as mongoose.Types.ObjectId,
              userDoc.email,
              userDoc.firstname,
              lockedOrder.orderNumber,
              "Payment timeout. Your order was abandoned at checkout.",
            );
          }
        } catch (notifyErr) {
          logger.error(
            this.safeLog(
              `Failed to dispatch cancellation notification for ${lockedOrder.orderNumber}`,
            ),
          );
        }
      } catch (error) {
        await session.abortTransaction();
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(
          this.safeLog(
            `[Cron] Failed to restore order ${order.orderNumber}: ${errMsg}`,
          ),
        );
        continue;
      } finally {
        await session.endSession();
      }
    }
  }

  /**
   * DPDP / GDPR Legal Engine: The Order Scrambler
   * * ARCHITECTURE NOTE:
   * When a user requests account deletion, we CANNOT delete their past orders because
   * it would permanently corrupt the company's financial accounting and tax reporting.
   * Instead, we perform an irreversible cryptographic scramble of their PII
   * (Personally Identifiable Information) on all past orders, preserving only the math.
   */
  public static async anonymizeUserOrders(
    userId: string,
    session: mongoose.ClientSession,
  ) {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    const result = await Order.updateMany(
      { user: { $eq: safeUserId } },
      {
        $set: {
          "shippingAddress.fullName": "Deleted User",
          "shippingAddress.phone": "0000000000",
          "shippingAddress.streetAddress": "Redacted for Privacy (DPDP/GDPR)",
          "shippingAddress.city": "Anonymized",
          "shippingAddress.state": "Anonymized",
          "shippingAddress.postalCode": "000000",
          "shippingAddress.country": "Anonymized",
        },
      },
      { session },
    );

    logger.info(
      this.safeLog(
        `[Privacy Engine] Anonymized ${result.modifiedCount} orders for deleted user ${safeUserId}`,
      ),
    );

    return result;
  }
}
