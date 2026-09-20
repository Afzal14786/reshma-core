// ──────────────────────────────────────────────
// Coupon factory for unit tests
// ──────────────────────────────────────────────

import { Types } from "mongoose";
import {
  DiscountType,
  PaymentRestriction,
} from "@modules/coupons/interfaces/coupon.interface";

export interface CouponOverrides {
  _id?: Types.ObjectId;
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minCartValue?: number;
  startDate?: Date;
  expiryDate?: Date;
  usageLimit?: number;
  usedCount?: number;
  isActive?: boolean;
  isFirstOrderOnly?: boolean;
  paymentMethodRestriction?: PaymentRestriction;
}

export function buildCoupon(overrides: CouponOverrides = {}) {
  const now = Date.now();
  return {
    _id: overrides._id ?? new Types.ObjectId(),
    code: overrides.code ?? "TEST10",
    discountType: overrides.discountType ?? DiscountType.FLAT,
    discountValue: overrides.discountValue ?? 100,
    maxDiscountAmount:
      overrides.maxDiscountAmount !== undefined
        ? overrides.maxDiscountAmount
        : null,
    minCartValue: overrides.minCartValue ?? 0,
    startDate: overrides.startDate ?? new Date(now - 24 * 60 * 60 * 1000),
    expiryDate: overrides.expiryDate ?? new Date(now + 24 * 60 * 60 * 1000),
    usageLimit: overrides.usageLimit ?? 100,
    usedCount: overrides.usedCount ?? 0,
    isActive: overrides.isActive ?? true,
    isFirstOrderOnly: overrides.isFirstOrderOnly ?? false,
    paymentMethodRestriction:
      overrides.paymentMethodRestriction ?? PaymentRestriction.ANY,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
