import { Router } from "express";
import { CouponController } from "./coupon.controller";

// Security & Validation Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// DTO Schemas
import { createCouponSchema, updateCouponSchema } from "./dtos/coupon.dto";

const router = Router();

/**
 *
 * GLOBAL SECURITY FIREWALL
 *
 * Rate Limiting (CWE-770): Prevents brute-force API enumeration and DoS.
 * Authentication (CWE-285): Cryptographically verifies the user's JWT.
 */
router.use(protect);

/**
 *
 * PUBLIC API (CUSTOMER FACING)
 *
 * ARCHITECTURE NOTE: This route MUST be declared before `restrictTo("ADMIN")`
 * to allow standard authenticated users to view active promotions.
 */
router.get("/available", standardLimiter, CouponController.getAvailableCoupons);

/**
 *
 * ADMIN API (INTERNAL OPERATIONS)
 *
 * Escalates the Access Control List (ACL). Any standard user attempting to hit
 * the endpoints below will be instantly dropped with a 403 Forbidden.
 */
router.use(restrictTo("ADMIN"));

/**
 * @route   POST /api/v1/coupons
 * @desc    Generate a new promotional code
 * @security Zod validation physically drops malformed payloads (CWE-20)
 */
router.post(
  "/",
  standardLimiter,
  validate(createCouponSchema),
  CouponController.createCoupon,
);

/**
 * @route   PATCH /api/v1/coupons/:id
 * @desc    Update coupon parameters or toggle isActive kill-switch
 */
router.patch(
  "/:id",
  standardLimiter,
  validate(updateCouponSchema),
  CouponController.updateCoupon,
);

/**
 * @route   GET /api/v1/coupons
 * @desc    Fetch all coupons with pagination and filtering
 */
router.get("/", standardLimiter, CouponController.getCoupons);

export const CouponRoutes = router;
