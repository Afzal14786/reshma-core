import { Types } from "mongoose";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";
import { CouponModel } from "./coupon.model";
import { Order } from "@modules/orders/order.model";
import {
  DiscountType,
  PaymentRestriction,
} from "./interfaces/coupon.interface";
import { CreateCouponInput, UpdateCouponInput } from "./dtos/coupon.dto";

/**
 *
 * PROMOTIONS & DISCOUNT ENGINE (SERVICE LAYER)
 *
 * ARCHITECTURE NOTE:
 * This service operates as the centralized Math and Validation Engine.
 * External modules (Cart, Order) MUST NOT calculate discounts themselves. They
 * must call `validateAndCalculateDiscount` to receive the cryptographically
 * safe discount value.
 *
 * SECURITY BOUNDARY (CodeQL Compliant):
 * - Sanitize all user-provided codes before logging (CWE-117).
 * - Queries use strict `$eq` wrapping to prevent NoSQL injection (CWE-943).
 * - Math constraints physically prevent discounts from exceeding the subtotal.
 */
export class CouponService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * @description Cleans strings of control characters before logging to prevent Log Injection.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   *
   * PUBLIC API: FETCH AVAILABLE COUPONS (Discovery Engine)
   *
   * @description Returns active coupons that have not expired.
   * If cartValue is provided, it dynamically filters out coupons the user
   * does not meet the minimum threshold for.
   */
  public static async getAvailableCoupons(cartValue?: number) {
    const now = new Date();

    // Base query: Must be active, started, and not expired
    const query: Record<string, unknown> = {
      isActive: { $eq: true },
      startDate: { $lte: now },
      expiryDate: { $gt: now },
      // MongoDB allows comparing fields within the document: usedCount must be less than usageLimit
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    };

    // If the frontend sends the cart value, only show coupons they actually qualify for
    if (cartValue !== undefined && cartValue >= 0) {
      query.minCartValue = { $lte: cartValue };
    }

    // Select only the safe fields to send to the frontend (hide internal stats like usedCount)
    const coupons = await CouponModel.find(query)
      .select(
        "code discountType discountValue minCartValue maxDiscountAmount expiryDate isFirstOrderOnly paymentMethodRestriction",
      )
      .sort({ expiryDate: 1 }) // Show coupons expiring soonest first
      .lean();

    return coupons;
  }

  /**
   *
   * ADMIN: CREATE COUPON
   *
   */
  public static async createCoupon(payload: CreateCouponInput) {
    const safeCode = String(payload.code)
      .replace(/[\r\n]/g, "")
      .toUpperCase();

    logger.info(
      this.safeLog(
        `[CouponService] Admin creating new promotional code: ${safeCode}`,
      ),
    );

    // Ensure code uniqueness at the database level
    const existingCoupon = await CouponModel.findOne({
      code: { $eq: safeCode },
    }).lean();

    if (existingCoupon) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Coupon code ${safeCode} already exists.`,
      );
    }

    // Dynamically strips explicitly 'undefined' fields from the payload so Mongoose
    // receives a clean object, satisfying strict TS compilation rules.
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined),
    );

    const coupon = await CouponModel.create({
      ...cleanPayload,
      code: safeCode, // Overrides the cleanPayload code to enforce uppercase sanitization
    });

    return coupon;
  }

  /**
   *
   * ADMIN: UPDATE COUPON (Kill-Switch & Modifications)
   *
   */
  public static async updateCoupon(
    couponId: string,
    payload: UpdateCouponInput,
  ) {
    // SECURITY (CWE-117): Neutralize Log Injection vectors
    const safeId = String(couponId).replace(/[\r\n]/g, "");
    logger.info(
      this.safeLog(`[CouponService] Admin updating coupon ID: ${safeId}`),
    );

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined),
    );

    const coupon = await CouponModel.findOneAndUpdate(
      { _id: { $eq: safeId } },
      { $set: cleanPayload },
      { new: true, runValidators: true },
    );

    if (!coupon) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Coupon not found.");
    }

    return coupon;
  }

  /**
   *
   * CORE MATH ENGINE: VALIDATE & CALCULATE
   *
   * @description Fetches the coupon, runs 5 strict business-logic firewalls,
   * and calculates the exact rupee discount.
   */
  public static async validateAndCalculateDiscount(
    code: string,
    subtotal: number,
    userId: string,
    requestedPaymentMethod?: string, // Passed during actual checkout
  ): Promise<{ couponId: Types.ObjectId; discountAmount: number }> {
    const safeCode = String(code)
      .replace(/[\r\n]/g, "")
      .toUpperCase();
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    // Fetch & Verify Existence
    const coupon = await CouponModel.findOne({
      code: { $eq: safeCode },
      isActive: { $eq: true },
    });

    if (!coupon) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        "Invalid or inactive promotional code.",
      );
    }

    const now = new Date();

    // Temporal Firewall (Time bounds)
    if (coupon.startDate > now) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `This coupon is not valid until ${coupon.startDate.toDateString()}.`,
      );
    }
    if (coupon.expiryDate < now) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "This promotional code has expired.",
      );
    }

    // Scarcity Firewall (Usage limits)
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "This coupon has reached its maximum usage limit.",
      );
    }

    // Margin Firewall (Minimum Cart Value)
    if (subtotal < coupon.minCartValue) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `Your cart total must be at least ₹${coupon.minCartValue} to apply this code.`,
      );
    }

    // Acquisition Firewall (First-Order Only Check)
    if (coupon.isFirstOrderOnly) {
      // Check if the user has ANY historical orders
      const previousOrders = await Order.countDocuments({
        user: { $eq: safeUserId },
      });
      if (previousOrders > 0) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "This promotional code is exclusively for new customers on their first order.",
        );
      }
    }

    // Logistics Firewall (RTO Prevention / Payment Restriction)
    if (
      requestedPaymentMethod &&
      coupon.paymentMethodRestriction !== PaymentRestriction.ANY
    ) {
      if (requestedPaymentMethod !== coupon.paymentMethodRestriction) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          `This coupon is strictly valid for ${coupon.paymentMethodRestriction} orders only.`,
        );
      }
    }

    //
    // MATHEMATICAL COMPUTATION
    //
    let calculatedDiscount = 0;

    if (coupon.discountType === DiscountType.FLAT) {
      calculatedDiscount = coupon.discountValue;
    } else if (coupon.discountType === DiscountType.PERCENTAGE) {
      // Calculate raw percentage
      const rawDiscount = subtotal * (coupon.discountValue / 100);

      // Enforce the Hard Ceiling to protect premium margins
      calculatedDiscount = coupon.maxDiscountAmount
        ? Math.min(rawDiscount, coupon.maxDiscountAmount)
        : rawDiscount;
    }

    // Final Sanity Check: Ensure we never discount more than the cart's worth
    // If subtotal is ₹150 and Flat discount is ₹200, discount becomes ₹150.
    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    // Round to 2 decimal places to prevent floating-point gateway errors
    calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;

    logger.debug(
      this.safeLog(
        `[CouponEngine] Applied ${safeCode} for User ${safeUserId}. Discount: ₹${calculatedDiscount}`,
      ),
    );

    return {
      couponId: coupon._id as Types.ObjectId,
      discountAmount: calculatedDiscount,
    };
  }

  /**
   *
   * UTILITY: FETCH COUPONS (Admin Pagination)
   *
   */
  public static async fetchCoupons(
    query: Record<string, unknown>,
    limit = 10,
    skip = 0,
  ) {
    const coupons = await CouponModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await CouponModel.countDocuments(query);
    return { coupons, meta: { total, limit, skip } };
  }
}
