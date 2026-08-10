import { Router } from "express";
import { ReturnPublicController } from "./return.public.controller";
import { ReturnAdminController } from "./return.admin.controller";

// Global Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
// import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// Validation Firewalls
import {
  InitiateReturnSchema,
  ArbitrateReturnSchema,
  ProcessReturnSchema,
} from "./dtos/return.dto";

const router = Router();

/**
 * PUBLIC ROUTES: CUSTOR BOUNDARY
 * Requires a verified JWT. Protected by the standard rate limiter to prevent bot spam.
 */
// router.use(standardLimiter);  // already used in app.ts
router.use(protect); // Applies to ALL routes below this point

// POST /api/v1/returns/:orderId/initiate
router.post(
  "/:orderId/initiate",
  validate(InitiateReturnSchema), // Drops NoSQL injection and mass-assignprofilent payloads
  ReturnPublicController.initiateReturn,
);

// GET /api/v1/returns/me
// (Changed from /profile to /me to match standard REST API conventions for fetching own data)
router.get("/me", ReturnPublicController.getMyReturns);

/**
 * ADMIN ROUTES: LOGISTICS & FINANCIAL BOUNDARY
 * Hard-blocks any user who does not have the 'ADMIN' role in their JWT.
 */
router.use("/admin", restrictTo("ADMIN"));

// GET /api/v1/returns/admin
router.get("/admin", ReturnAdminController.getAllReturns);

// PATCH /api/v1/returns/admin/:returnId/arbitrate
router.patch(
  "/admin/:returnId/arbitrate",
  validate(ArbitrateReturnSchema), // Forces admin to provide a reason if rejecting
  ReturnAdminController.arbitrateReturn,
);

// POST /api/v1/returns/admin/:returnId/process
router.post(
  "/admin/:returnId/process",
  validate(ProcessReturnSchema), // Validates the Hex ID params
  ReturnAdminController.processRefund,
);

export const ReturnRoutes = router;
