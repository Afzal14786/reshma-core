import mongoose, { Schema } from "mongoose";
import {
  ICoupon,
  DiscountType,
  PaymentRestriction,
} from "./interfaces/coupon.interface";

/**
 * COUPON & PROMOTION SCHEMA
 * ARCHITECTURE NOTE:
 * This schema acts as the master configuration for dynamic discounts.
 * It is heavily indexed on the `code` field because `CartService` will query
 * this collection frequently as users type in promo codes.
 */
const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true, // PERFORMANCE: Essential for fast cart application queries
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: [true, "Discount type must be FLAT or PERCENTAGE"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, "Max discount amount cannot be negative"],
      default: null, // Used strictly as a ceiling for PERCENTAGE discounts
    },
    minCartValue: {
      type: Number,
      required: true,
      default: 0, // Enforces profitability margins (e.g., No 500 off on a 200 cart)
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    usageLimit: {
      type: Number,
      required: true,
      min: [1, "Usage limit must be at least 1"],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true, // Admin kill-switch for compromised codes
      index: true,
    },
    isFirstOrderOnly: {
      type: Boolean,
      default: false, // Acquisition hook logic
    },
    paymentMethodRestriction: {
      type: String,
      enum: Object.values(PaymentRestriction),
      default: PaymentRestriction.ANY, // RTO mitigation hook
    },
  },
  {
    timestamps: true,
  },
);

// COMPOUND INDEX: Optimizes the exact query the Cart Service will run
// e.g., db.coupons.findOne({ code: 'DIWALI20', isActive: true })
couponSchema.index({ code: 1, isActive: 1 });

export const CouponModel = mongoose.model<ICoupon>("Coupon", couponSchema);
