import { z } from "zod";
import {
  DiscountType,
  PaymentRestriction,
} from "../interfaces/coupon.interface";

/**
 * COUPON VALIDATION LAYER (Zod)
 * ARCHITECTURE NOTE:
 * We decouple the base schema from the `.superRefine` effects so we can safely
 * use `.partial()` for the update schema without triggering Zod compiler errors.
 */

// 1. The Base Object (No refinements yet)
const couponBaseSchema = z.object({
  code: z
    .string()
    .min(3, "Coupon code must be at least 3 characters")
    .max(20, "Coupon code cannot exceed 20 characters")
    .regex(
      /^[A-Z0-9]+$/,
      "Coupon code can only contain uppercase letters and numbers",
    ),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z
    .number()
    .positive("Discount value must be greater than zero"),
  maxDiscountAmount: z.number().positive().optional(),
  minCartValue: z
    .number()
    .nonnegative("Minimum cart value cannot be negative")
    .default(0),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  usageLimit: z
    .number()
    .int()
    .positive("Usage limit must be a positive integer"),
  isActive: z.boolean().default(true),
  isFirstOrderOnly: z.boolean().default(false),
  paymentMethodRestriction: z
    .nativeEnum(PaymentRestriction)
    .default(PaymentRestriction.ANY),
});

// 2. Admin Creation Payload (Applies strict logic firewalls)
export const createCouponSchema = z.object({
  body: couponBaseSchema.strict().superRefine((data, ctx) => {
    // Rule 1: Percentage discounts MUST have a strict ceiling to prevent massive margin loss
    if (data.discountType === DiscountType.PERCENTAGE) {
      if (data.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percentage discount cannot exceed 100%",
          path: ["discountValue"],
        });
      }
      if (!data.maxDiscountAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A maximum discount amount is required for PERCENTAGE coupons to protect business margins.",
          path: ["maxDiscountAmount"],
        });
      }
    }

    // Rule 2: Expiry date must be mathematically after the Start date
    if (data.expiryDate <= data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiry date must be later than the start date.",
        path: ["expiryDate"],
      });
    }

    // Rule 3: Start date cannot be in the past (allowing a 5-minute buffer for network latency)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    if (data.startDate < fiveMinutesAgo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date cannot be in the past.",
        path: ["startDate"],
      });
    }
  }),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>["body"];

// 3. Admin Update Payload (Safely applies partial fields and contextual logic)
export const updateCouponSchema = z.object({
  body: couponBaseSchema
    .partial()
    .strict()
    .superRefine((data, ctx) => {
      // If they are updating the dates, we must re-verify the chronological logic
      if (
        data.startDate &&
        data.expiryDate &&
        data.expiryDate <= data.startDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expiry date must be later than the start date.",
          path: ["expiryDate"],
        });
      }

      // If they switch to PERCENTAGE, they must provide a max cap
      if (
        data.discountType === DiscountType.PERCENTAGE &&
        !data.maxDiscountAmount
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A maximum discount amount is required for PERCENTAGE coupons.",
          path: ["maxDiscountAmount"],
        });
      }
    }),
});

export type UpdateCouponInput = z.infer<typeof updateCouponSchema>["body"];

// 4. Public Application Payload (Cart Module Hook)
export const applyCouponSchema = z.object({
  body: z
    .object({
      code: z
        .string({ message: "Coupon code is required" })
        .trim()
        .toUpperCase(),
    })
    .strict(),
});

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>["body"];
