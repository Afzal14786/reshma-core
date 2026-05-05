import { Router } from "express";
import { DashboardController } from "./dashboard.controller";

// Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";

// Zod Firewalls
import { DateRangeQuerySchema } from "./dtos/date-range.dto";

const router = Router();

/**
 * DASHBOARD ROUTE CONFIGURATION
 *
 * SECURITY BOUNDARY:
 * 1. standardLimiter: Throttles requests to prevent DoS via heavy aggregations.
 * 2. protect: Guarantees a cryptographically verified JWT session exists.
 * 3. restrictTo("ADMIN"): Drops requests from standard users immediately.
 */
router.use(standardLimiter);
router.use(protect);
router.use(restrictTo("ADMIN"));

// GET /api/v1/dashboard/metrics
router.get(
  "/metrics",
  validate(DateRangeQuerySchema), // Neutralizes NoSQL date-injection
  DashboardController.getMetrics,
);

export const DashboardRoutes = router;
