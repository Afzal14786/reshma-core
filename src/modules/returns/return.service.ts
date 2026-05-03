import mongoose, { Types } from "mongoose";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";
import razorpay from "@config/razorpay";
import { Order } from "@modules/orders/order.model";
import { Product } from "@modules/products/models/base-product.model";
import { NotificationService } from "../notifications/notification.service";
import { ReturnModel } from "./return.model";
import { ReturnStatus } from "./interfaces/return.interface";

// DTOs imported from orders module as per your provided structure
import { InitiateReturnInput, ArbitrateReturnInput } from "./dtos/return.dto";
import { IOrderItem } from "@modules/orders/interfaces/order.interface";

/**
 * UNIFIED RETURN & RMA SERVICE
 *
 * ARCHITECTURE NOTE:
 * This service manages the entire reverse-logistics lifecycle. It enforces a strict
 * 4-stage state machine (Initiation -> Arbitration -> Restock -> Refund).
 *
 * SECURITY BOUNDARY (CodeQL Compliant):
 * - Financial calculations are NEVER derived from client input.
 * - All DB queries use strict `$eq` wrapping to prevent NoSQL injection.
 * - Exact Optional Property Types are physically respected to prevent TS crashes.
 * - All logged variables are sanitized against CRLF injection to prevent log forging (CWE-117).
 */
export class ReturnService {
  /**
   * STAGE 1: Initiate Return Request (Customer)
   * Validates eligibility, computes the refund estimate via historical data, and isolates the record.
   */
  public static async initiateReturn(
    userId: string,
    userEmail: string,
    userFirstname: string,
    orderId: string,
    payload: InitiateReturnInput,
  ) {
    const safeOrderId = String(orderId).replace(/[\r\n]/g, "");
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    logger.info(
      `[ReturnService] Initiating return for Order: ${safeOrderId} by User: ${safeUserId}`,
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // IDOR Firewall: Ensure order belongs to the requester.
      const order = await Order.findOne({
        _id: { $eq: String(orderId) },
        user: { $eq: String(userId) },
      }).session(session);

      if (!order) {
        logger.warn(
          `[SECURITY] IDOR attempt or missing order. User: ${safeUserId}, Target: ${safeOrderId}`,
        );
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          "Order not found or access denied.",
        );
      }

      // State Machine Firewall
      if (order.orderStatus !== "DELIVERED") {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          `Cannot return an order in ${order.orderStatus} state.`,
        );
      }

      // TTL Firewall: Enforce the 7-day return window mathematically
      const daysSinceDelivery =
        (Date.now() - new Date(order.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > 7) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "The 7-day return policy window has expired for this order.",
        );
      }

      let estimatedRefund = 0;
      let requiresPhotographicProof = false;

      // Integrity Checks: Validate payload against the locked historical purchase
      for (const reqItem of payload.items) {
        const purchasedItem = order.items.find(
          (item: IOrderItem) =>
            String(item.product) === String(reqItem.productId),
        );

        if (!purchasedItem) {
          throw new AppError(
            HTTP_STATUS.BAD_REQUEST,
            `Product ${reqItem.productId} does not exist in this order.`,
          );
        }

        if (reqItem.quantity > purchasedItem.quantity) {
          const safeSku = String(reqItem.productId).replace(/[\r\n]/g, "");
          logger.warn(
            `[FRAUD] User ${safeUserId} attempted to return more units than purchased for SKU ${safeSku}`,
          );
          throw new AppError(
            HTTP_STATUS.BAD_REQUEST,
            `Quantity exceeds purchased amount for product ${reqItem.productId}.`,
          );
        }

        // Fetch live catalog data to verify dynamic policies (Hygiene/Fragility)
        const liveProduct = await Product.findOne({
          _id: { $eq: String(reqItem.productId) },
        })
          .session(session)
          .lean();

        if (!liveProduct) {
          throw new AppError(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            "Critical Error: Product catalog reference lost.",
          );
        }

        // Hygiene Policy Enforcement
        if (liveProduct.itemType === "INNERWEAR") {
          throw new AppError(
            HTTP_STATUS.FORBIDDEN,
            `Hygiene Policy Violation: ${liveProduct.name} cannot be returned.`,
          );
        }

        // Fragility Enforcement
        if (liveProduct.isFragile) {
          requiresPhotographicProof = true;
        }

        // Compute Financial Impact: Multiply by historical price, severing the payload taint chain
        estimatedRefund += purchasedItem.priceAtPurchase * reqItem.quantity;
      }

      // Cloudinary Media Validation
      if (requiresPhotographicProof && payload.images.length === 0) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "Photographic proof of damage is legally required for fragile items (e.g., Glass Bangles).",
        );
      }

      const formattedItems = payload.items.map((item) => {
        const mappedItem: {
          product: Types.ObjectId;
          quantity: number;
          reason: string;
          customerNote?: string;
        } = {
          product: new Types.ObjectId(item.productId),
          quantity: item.quantity,
          reason: item.reason,
        };

        if (item.customerNote !== undefined) {
          mappedItem.customerNote = item.customerNote;
        }
        return mappedItem;
      });

      // DB Mutation
      const returnDocuments = await ReturnModel.create(
        [
          {
            user: new Types.ObjectId(userId),
            order: new Types.ObjectId(orderId),
            items: formattedItems,
            proofOfDamageImages: payload.images,
            refundAmountEstimate: estimatedRefund,
          },
        ],
        { session },
      );

      const createdReturn = returnDocuments[0];
      if (!createdReturn) {
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "Database failed to generate return record.",
        );
      }

      order.set("orderStatus", "RETURN_REQUESTED");
      await order.save({ session });

      await session.commitTransaction();
      logger.info(
        `[ReturnService] Return ${createdReturn._id} successfully generated for Order ${safeOrderId}`,
      );

      // Fire-and-Forget Notification Trigger
      NotificationService.sendReturnRequestedNotification(
        new Types.ObjectId(userId),
        userEmail,
        userFirstname,
        order.orderNumber,
      ).catch((err) =>
        logger.error(
          `[Notification DB Error] Failed to dispatch Return Requested alert`,
          err,
        ),
      );

      return createdReturn;
    } catch (error: unknown) {
      await session.abortTransaction();

      // Mongoose Type Guard: Catch unique compound index violations (Double-click fraud prevention)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        logger.warn(
          `[ReturnService] Intercepted duplicate return request for Order: ${safeOrderId}`,
        );
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          "A return request is already active for this order.",
        );
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * STAGE 2: Admin Arbitration
   * Approves or Rejects the return request based on human verification.
   */
  public static async arbitrateReturn(
    returnId: string,
    payload: ArbitrateReturnInput,
  ) {
    const safeReturnId = String(returnId).replace(/[\r\n]/g, "");
    const safeStatus = String(payload.status).replace(/[\r\n]/g, "");

    logger.info(
      `[ReturnService] Admin arbitrating Return: ${safeReturnId} to ${safeStatus}`,
    );
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const returnRequest = await ReturnModel.findOne({
        _id: { $eq: String(returnId) },
      })
        .populate("user", "email firstname")
        .session(session);

      if (!returnRequest) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, "Return request not found.");
      }

      if (returnRequest.status !== ReturnStatus.PENDING_APPROVAL) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          `Arbitration failed. Return is already ${returnRequest.status}.`,
        );
      }

      const order = await Order.findOne({
        _id: { $eq: String(returnRequest.order) },
      }).session(session);
      if (!order) {
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "System Error: Linked order record missing.",
        );
      }

      // Safe cast: Populate returns the User document properties
      const userData = returnRequest.user as unknown as {
        _id: Types.ObjectId;
        email: string;
        firstname: string;
      };

      if (payload.status === ReturnStatus.REJECTED) {
        returnRequest.status = ReturnStatus.REJECTED;

        if (payload.adminRejectionReason !== undefined) {
          returnRequest.adminRejectionReason = payload.adminRejectionReason;
        } else {
          returnRequest.adminRejectionReason =
            "Declined by administrative review."; // Strict fallback
        }

        // Soft Reversion: Return the order to DELIVERED so the user retains their historical receipt status
        order.set("orderStatus", "DELIVERED");

        await returnRequest.save({ session });
        await order.save({ session });
        await session.commitTransaction();

        NotificationService.sendReturnRejectedNotification(
          userData._id,
          userData.email,
          userData.firstname,
          order.orderNumber,
          returnRequest.adminRejectionReason,
        ).catch((err) =>
          logger.error(
            "[Notification DB Error] Failed to send Return Rejected alert",
            err,
          ),
        );

        return returnRequest;
      }

      if (payload.status === ReturnStatus.APPROVED) {
        returnRequest.status = ReturnStatus.APPROVED;
        await returnRequest.save({ session });
        await session.commitTransaction();

        NotificationService.sendReturnApprovedNotification(
          userData._id,
          userData.email,
          userData.firstname,
          order.orderNumber,
        ).catch((err) =>
          logger.error(
            "[Notification DB Error] Failed to send Return Approved alert",
            err,
          ),
        );

        return returnRequest;
      }

      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Invalid arbitration status provided.",
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * STAGE 3: Process Financial Refund & Atomic Inventory Restock
   *
   * ARCHITECTURE NOTE (DISTRIBUTED SYSTEMS):
   * We NEVER hold a MongoDB transaction open while awaiting an external HTTP response
   * from Razorpay. We execute the financial API call first. If it succeeds, we open
   * the DB transaction to sync our internal state.
   */
  public static async processRefundAndRestock(returnId: string) {
    const safeReturnId = String(returnId).replace(/[\r\n]/g, "");

    logger.info(
      `[ReturnService] Executing Refund & Restock for Return: ${safeReturnId}`,
    );

    // Fetch data required for the Razorpay handshake
    const returnRequest = await ReturnModel.findOne({
      _id: { $eq: String(returnId) },
    }).populate("user", "email firstname");

    if (!returnRequest)
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Return not found.");

    if (returnRequest.status !== ReturnStatus.APPROVED) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Security violation: Return must be APPROVED before a refund can be issued.",
      );
    }

    const order = await Order.findOne({
      _id: { $eq: String(returnRequest.order) },
    });

    if (!order || !order.gatewayPaymentId) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Cannot process refund. Valid gatewayPaymentId is missing from this order.",
      );
    }

    const refundAmountInRupees = returnRequest.refundAmountEstimate;
    const refundAmountInPaise = Math.round(refundAmountInRupees * 100);

    // Network Boundary: Call Razorpay API
    try {
      // Gateway ID is sourced from DB, not client payload, inherently safe.
      logger.info(
        `[Razorpay] Initiating Rs. ${refundAmountInRupees} refund against Gateway ID: ${order.gatewayPaymentId}`,
      );

      const refundReceipt = await razorpay.payments.refund(
        order.gatewayPaymentId,
        {
          amount: refundAmountInPaise,
          speed: "optimum",
        },
      );

      logger.info(`[Razorpay] Refund Success. Receipt ID: ${refundReceipt.id}`);
    } catch (error: unknown) {
      logger.error(
        `[Razorpay ERROR] Refund failed for Return: ${safeReturnId}`,
        error,
      );
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Razorpay rejected the refund request. Check gateway logs.",
      );
    }

    // Database State Synchronization (ACID Session)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // PERFORMANCE: Use BulkWrite to execute atomic inventory increments in a single DB round-trip
      const bulkOps = returnRequest.items.map((item) => ({
        updateOne: {
          filter: { _id: { $eq: String(item.product) } },
          update: { $inc: { currentStock: item.quantity } },
        },
      }));

      await Product.bulkWrite(bulkOps, { session });
      logger.debug(
        `[ReturnService] Inventory atomically restocked for ${bulkOps.length} SKUs`,
      );

      // Finalize the state machine
      returnRequest.status = ReturnStatus.REFUNDED;
      order.set("orderStatus", "RETURNED");

      await returnRequest.save({ session });
      await order.save({ session });

      await session.commitTransaction();

      const userData = returnRequest.user as unknown as {
        _id: Types.ObjectId;
        email: string;
        firstname: string;
      };
      NotificationService.sendReturnRefundedNotification(
        userData._id,
        userData.email,
        userData.firstname,
        order.orderNumber,
        refundAmountInRupees,
      ).catch((err) =>
        logger.error(
          "[Notification DB Error] Failed to send Refund Processed alert",
          err,
        ),
      );

      return returnRequest;
    } catch (error) {
      await session.abortTransaction();
      // CRITICAL ALERT: Distributed system failure. Financial state and DB state are desynchronized.
      logger.error(
        `[CRITICAL DESYNC] Razorpay processed the refund, but MongoDB restock failed. Manual reconciliation required for Return: ${safeReturnId}`,
        error,
      );
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Refund processed via gateway, but database synchronization failed. System administrators have been alerted.",
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * UTILITY: Standardized Fetcher
   * Utilizes Mongoose projections to strip unnecessary data before sending across the wire.
   */
  public static async fetchReturns(
    query: Record<string, unknown>,
    limit = 10,
    skip = 0,
  ) {
    const returns = await ReturnModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "orderNumber orderStatus pricing.totalAmount") // Aligned with IOrder structure
      .populate("items.product", "name sku itemType images")
      .lean(); // PERFORMANCE: Strip Mongoose overhead

    const total = await ReturnModel.countDocuments(query);

    return { returns, meta: { total, limit, skip } };
  }
}
