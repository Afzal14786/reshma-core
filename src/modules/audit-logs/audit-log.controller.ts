import { Request, Response, NextFunction } from "express";
import { AuditLogService } from "./audit-log.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { AppError } from "@shared/utils/app-error";
import { getAuditContext } from "@shared/utils/audit.utils";
import { AuditExportQueueManager } from "@shared/queues/audit-export.queue";
import { AdminAuditLogQueryInput } from "./dto/audit-log.dto";
import logger from "@config/logger";

/**
 * ENTERPRISE AUDIT LOG CONTROLLER
 *
 * ARCHITECTURE NOTE:
 * - Zod middleware (`validate(AdminAuditLogQuerySchema)`) runs BEFORE these methods.
 * - This guarantees `req.query` is already sanitized, typed, and coerced.
 * - Both endpoints are strictly gated behind `restrictTo("ADMIN")` middleware.
 */
export class AuditLogController {
  /**
   * @route   GET /api/v1/admin/audit-logs
   * @desc    Fetch paginated audit logs with filters for the Admin Dashboard.
   * @access  Private (Admin Only)
   */
  public static async getAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Extract validated query params
      const query = req.query as unknown as AdminAuditLogQueryInput;
      const {
        page,
        limit,
        module,
        action,
        adminId,
        targetId,
        startDate,
        endDate,
      } = query;

      const skip = (page - 1) * limit;

      // Build MongoDB filter
      const filter: Record<string, unknown> = {};
      if (module) filter.module = { $eq: module };
      if (action) filter.action = { $eq: action };
      if (adminId) filter.adminId = { $eq: adminId };
      if (targetId) filter.targetId = { $eq: targetId };

      // Date range filtering
      if (startDate) {
        filter.timestamp = { $gte: startDate };
      }
      if (endDate) {
        // Set to end of day for inclusive filtering
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.timestamp = { ...(filter.timestamp || {}), $lte: endOfDay };
      }

      // Fetch from Service
      const { logs, meta } = await AuditLogService.fetchLogs(
        filter,
        limit,
        skip,
      );

      // Return Standardized Response
      new ApiResponse(res, HTTP_STATUS.OK, "Audit logs fetched successfully.", {
        logs,
        meta,
      }).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/v1/admin/audit-logs/export
   * @desc    Queues an async export of audit logs to CSV (emailed to admin).
   * @access  Private (Admin Only)
   *
   * RESPONSE: 202 Accepted (Job Queued)
   *
   * ARCHITECTURE NOTE:
   * We use BullMQ to handle the export in the background.
   * - Prevents HTTP timeouts for large datasets.
   * - Admin receives the CSV via email (same as user data export).
   */
  public static async exportAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Extract Admin Context (ensures we know who to email)
      const context = getAuditContext(req);
      if (!context) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "Authentication required.",
        );
      }

      // Extract validated query params
      const query = req.query as unknown as AdminAuditLogQueryInput;
      const { module, action, adminId, targetId, startDate, endDate } = query;

      // Build filters (same logic as getAuditLogs)
      const filters: Record<string, unknown> = {};
      if (module) filters.module = { $eq: module };
      if (action) filters.action = { $eq: action };
      if (adminId) filters.adminId = { $eq: adminId };
      if (targetId) filters.targetId = { $eq: targetId };

      if (startDate) {
        filters.timestamp = { $gte: startDate };
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        filters.timestamp = { ...(filters.timestamp || {}), $lte: endOfDay };
      }

      // Push to BullMQ Export Queue
      await AuditExportQueueManager.enqueueAuditExport(
        context.adminId.toString(),
        context.adminEmail,
        context.adminName,
        filters,
      );

      logger.info(
        `[AuditLog] Export queued for admin ${context.adminEmail} with filters: ${JSON.stringify(filters)}`,
      );

      // Return 202 Accepted (The job is queued, processing will happen in background)
      new ApiResponse(
        res,
        HTTP_STATUS.ACCEPTED,
        "Audit log export has been queued. You will receive the CSV file via email shortly.",
        {
          jobId: "queued",
          estimatedTime: "2-5 minutes",
        },
      ).send();
    } catch (error) {
      next(error);
    }
  }
}
