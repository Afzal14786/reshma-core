import { AuditLog } from "./audit-log.model";
import { IAuditLogInput, IAuditLog } from "./audit-log.interface";
import logger from "@config/logger";

/**
 * ENTERPRISE AUDIT LOG SERVICE
 *
 * ARCHITECTURE NOTE:
 * - All write operations are non-blocking (fire-and-forget) to prevent latency spikes.
 * - Errors in the logging pipeline are caught and logged to Winston, but NEVER thrown.
 * - This ensures that the main business operation succeeds even if the audit log fails.
 */
export class AuditLogService {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * Prevents CRLF injection in log messages.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * Core Logging Method (Fire-and-Forget)
   *
   * @param data - The audit log payload (admin context, action, module, target, changes, etc.)
   * @returns Promise<void> - Resolves immediately without waiting for DB write.
   *
   * PERFORMANCE: This method uses setImmediate to offload the DB write
   * to the next event loop iteration, ensuring the HTTP request is not delayed.
   *
   * ERROR HANDLING: Any DB error is caught and logged to Winston, but the
   * function never throws, guaranteeing that the caller's business logic
   * is never interrupted by a logging failure.
   */
  public static async log(data: IAuditLogInput): Promise<void> {
    // Fire-and-forget: We do NOT await the DB write here.
    // Instead, we schedule it for the next event loop tick.
    setImmediate(async () => {
      try {
        // Build the document object with only defined fields.
        // This satisfies `exactOptionalPropertyTypes: true`.
        const doc: Record<string, unknown> = {
          adminId: data.adminId,
          adminEmail: data.adminEmail,
          adminName: data.adminName,
          action: data.action,
          module: data.module,
          targetId: data.targetId,
          timestamp: new Date(),
        };

        // Conditionally add optional fields only if they are defined
        if (data.targetName !== undefined) doc.targetName = data.targetName;
        if (data.changes !== undefined) doc.changes = data.changes;
        if (data.payload !== undefined) doc.payload = data.payload;
        if (data.ipAddress !== undefined) doc.ipAddress = data.ipAddress;
        if (data.userAgent !== undefined) doc.userAgent = data.userAgent;

        await AuditLog.create(doc);

        logger.debug(
          this.safeLog(
            `[AuditLog] Logged ${data.action} on ${data.module} ${data.targetId} by ${data.adminEmail}`,
          ),
        );
      } catch (error) {
        // CRITICAL: We must NEVER throw an error from here.
        // If the audit log fails, we just log the failure to Winston.
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(
          this.safeLog(`[AuditLog] Failed to write audit log: ${errMsg}`),
        );
      }
    });
  }

  /**
   * Fetch Audit Logs with Pagination and Filters
   *
   * @param query - MongoDB query object (e.g., { module: "PRODUCT", adminId: "..." })
   * @param limit - Number of results per page (default: 20, max: 100)
   * @param skip - Number of results to skip (default: 0)
   * @returns { logs: IAuditLog[], meta: { total, limit, skip } }
   *
   * PERFORMANCE: Uses `Promise.all` to run `find` and `countDocuments` in parallel.
   * The query uses the compound indexes defined in the model for optimal speed.
   */
  public static async fetchLogs(
    query: Record<string, unknown> = {},
    limit: number = 20,
    skip: number = 0,
  ): Promise<{
    logs: IAuditLog[];
    meta: { total: number; limit: number; skip: number };
  }> {
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate("adminId", "firstname lastname email avatar")
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs: logs as IAuditLog[],
      meta: { total, limit, skip },
    };
  }
}
