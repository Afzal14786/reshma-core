import mongoose from "mongoose";
import { Order } from "./order.model";
import { Cart } from "../cart/cart.model";
import { Product } from "../products/models/base-product.model";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { CheckoutInput } from "./dtos/order.dto";
import razorpay from "@config/razorpay";
import { verifyRazorpaySignature } from "./payment.utils";
import logger from "@config/logger";
import { IOrderItem, IOrder, IRazorpayWebhookBody } from "./interfaces/order.interface";
import { verifyWebhookEvent } from './payment.utils';

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
            `Item out of stock or insufficient quantity: Product ID ${item.product}`,
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

        // TypeScript Fix: Map strictly to Record<string, string> to satisfy Mongoose Map types
        if (
          item.selectedAttributes &&
          Object.keys(item.selectedAttributes).length > 0
        ) {
          const formattedAttributes: Record<string, string> = {};
          for (const [key, value] of Object.entries(item.selectedAttributes)) {
            formattedAttributes[key] = String(value);
          }
          historyItem.selectedAttributes = formattedAttributes;
        }

        historicalItems.push(historyItem);
      }

      // Pricing Math (Flat ₹50 shipping if subtotal < ₹2000)
      const shippingCost = subTotal > 2000 ? 0 : 50;
      const taxAmount = subTotal * 0.18; // 18% GST implementation
      const totalAmount = subTotal + shippingCost + taxAmount;

      const orderPayload: Partial<IOrder> = {
        user: new mongoose.Types.ObjectId(userId),
        items: historicalItems,
        shippingAddress: payload.shippingAddress,
        pricing: {
          subTotal,
          shippingCost,
          taxAmount,
          totalAmount,
        },
        paymentMethod: payload.paymentMethod,
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
      };

      const orderDocuments = await Order.create([orderPayload], { session });
      const order = orderDocuments[0] as IOrder;

      // Gateway Handshake
      if (payload.paymentMethod === "RAZORPAY") {
        // SAFETY NET: Convert INR to exact Paise to avoid floating-point math truncation bugs
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: order.orderNumber,
          notes: { userId: String(userId) },
        });

        order.gatewayOrderId = rzpOrder.id;
        await order.save({ session });
      } else {
        order.orderStatus = "PROCESSING";
        await order.save({ session });
      }

      // Clear Cart Post-Checkout
      await Cart.findOneAndUpdate(
        { user: { $eq: String(userId) } },
        { $set: { items: [] } },
        { session },
      );

      // COMMIT: Database changes locked in
      await session.commitTransaction();
      logger.info(`Checkout successful`, { orderId: order._id, userId });

      return order;
    } catch (error) {
      // ROLLBACK: Instantly restore any deducted stock to the catalog
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Frontend Cryptographic Handshake
   * Verifies the payment immediately after the user closes the modal to enable instant UI updates.
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

    // Idempotency: Ignore duplicate success pings to prevent double-processing
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
        "Payment verification failed. Invalid signature.",
      );
    }

    // Apply financial state
    order.paymentStatus = "PAID";
    order.orderStatus = "PROCESSING";
    order.gatewayPaymentId = gatewayPaymentId;
    order.gatewaySignature = gatewaySignature;

    await order.save();

    logger.info(`Order Paid via Frontend Handshake`, {
      orderNumber: order.orderNumber,
    });
    return order;
  }

  /**
     * Server-to-Server Webhook Processing
     * * ARCHITECTURE NOTE:
     * Catches asynchronous pings from Razorpay. Essential for users who pay successfully
     * but drop connection before the frontend redirects.
     */

  public static async processWebhook(body: IRazorpayWebhookBody, signature: string) {
        // 1. Cryptographic Handshake
        // error : Cannot find name 'verifyWebhookEvent'.
        const isValid = verifyWebhookEvent(JSON.stringify(body), signature);
        if (!isValid) {
            logger.error(`[Webhook] Critical: Invalid Razorpay Signature Detected`);
            throw new AppError(HTTP_STATUS.BAD_REQUEST, "Invalid webhook signature");
        }

        const event = body.event;
        
        // 2. Event Routing
        if (event === 'order.paid') {
            const paymentEntity = body.payload.payment.entity;
            const rzpOrderId = paymentEntity.order_id;

            const order = await Order.findOne({ gatewayOrderId: { $eq: String(rzpOrderId) } });
            
            if (!order) return; 

            // 3. Idempotency Wall
            if (order.paymentStatus === 'PAID') {
                logger.info(`[Webhook] Order ${order.orderNumber} already PAID. Ignoring idempotent ping.`);
                return; 
            }

            // 4. Apply Financial State
            order.paymentStatus = 'PAID';
            order.orderStatus = 'PROCESSING';
            order.gatewayPaymentId = paymentEntity.id;
            await order.save();
            
            logger.info(`[Webhook] Order ${order.orderNumber} successfully marked as PAID via background ping.`);
        }
    }

    /**
     * Abandoned Order Recovery (Inventory Defragmentation)
     * * ARCHITECTURE NOTE:
     * Finds PENDING orders older than 30 minutes. Iterates through them and uses
     * ACID transactions to atomically restore reserved stock back to the catalog.
     */
    public static async recoverAbandonedOrders() {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        // Find orders stuck in PENDING
        const abandonedOrders = await Order.find({
            orderStatus: 'PENDING',
            createdAt: { $lt: thirtyMinutesAgo }
        });

        if (abandonedOrders.length === 0) return;

        logger.info(`[Cron] Found ${abandonedOrders.length} abandoned orders. Beginning inventory restoration.`);

        for (const order of abandonedOrders) {
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                // 1. Mark order as CANCELLED so it isn't picked up again
                order.orderStatus = 'CANCELLED';
                
                // 2. Atomically restore stock for every item in the cart
                for (const item of order.items) {
                    await Product.findOneAndUpdate(
                        { _id: item.product },
                        { $inc: { currentStock: item.quantity } }, // Add the stock back!
                        { session }
                    );
                }
                
                await order.save({ session });
                await session.commitTransaction();
                logger.info(`[Cron] Restored inventory for abandoned order: ${order.orderNumber}`);
                
            } catch (error) {
                // If anything fails, rollback this specific order and continue to the next one
                await session.abortTransaction();
                logger.error(`[Cron] Failed to restore order ${order.orderNumber}:`, error);
            } finally {
                session.endSession();
            }
        }
    }
}
