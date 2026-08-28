import { Router } from "express";
import { AuditLogController } from "./audit-log.controller";

// Global Middlewares
import { protect } from "@shared/middlewares/auth.middleware";
import { restrictTo } from "@shared/middlewares/role.middleware";
import { validate } from "@shared/middlewares/validate.middleware";

// DTO Validation Schemas
import {
  AdminAuditLogQuerySchema,
  AdminAuditLogExportSchema,
} from "./dto/audit-log.dto";

const router = Router();

/**
 * ADMIN AUDIT LOG ROUTES
 *
 * SECURITY BOUNDARY:
 * - `protect`: Validates JWT and attaches `req.user`.
 * - `restrictTo("ADMIN")`: Ensures the user has admin privileges.
 * - `validate(AdminAuditLogQuerySchema)`: Sanitizes and coerces query params.
 *
 * MOUNTING: These routes are mounted at `/api/v1/admin/audit-logs` in `src/routes/index.ts`.
 */

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Fetch paginated audit logs with filters (Module, Action, Admin, Date Range).
 * @access  Private (Admin Only)
 */
router.get(
  "/admin/audit-logs",
  protect,
  restrictTo("ADMIN"),
  validate(AdminAuditLogQuerySchema),
  AuditLogController.getAuditLogs,
);

/**
 * @route   GET /api/v1/admin/audit-logs/export
 * @desc    Queue an async export of audit logs to CSV.
 * @access  Private (Admin Only)
 */
router.get(
  "/export",
  protect,
  restrictTo("ADMIN"),
  validate(AdminAuditLogExportSchema),
  AuditLogController.exportAuditLogs,
);

export const AuditLogRoutes = router;
