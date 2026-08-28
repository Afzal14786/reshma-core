import { Queue } from "bullmq";
import Redis from "ioredis";
import env from "@config/env";
import logger from "@config/logger";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Audit Export Queue
 *
 * This queue handles background generation of CSV exports for audit logs.
 * Jobs are processed by the `AuditExportWorker` (to be implemented later).
 */
export const AuditExportQueue = new Queue("audit-export-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
  },
});

/**
 * Queue Manager for Audit Exports
 *
 * Provides a clean interface to enqueue export jobs from the controller layer.
 */
export class AuditExportQueueManager {
  /**
   * Enqueues an audit export job.
   *
   * @param adminId - The ID of the admin requesting the export
   * @param adminEmail - The email of the admin (for notification)
   * @param adminName - The name of the admin (for email greeting)
   * @param filters - The MongoDB filters to apply to the export
   *
   * SECURITY: Filters are passed directly to the worker; they are already validated.
   * PERFORMANCE: Uses a unique job ID to prevent duplicate submissions.
   */
  public static async enqueueAuditExport(
    adminId: string,
    adminEmail: string,
    adminName: string,
    filters: Record<string, unknown>,
  ): Promise<void> {
    const jobId = `audit-export-${adminId}-${Date.now()}`;

    await AuditExportQueue.add(
      "export-audit-logs",
      { adminId, adminEmail, adminName, filters },
      { jobId },
    );

    logger.info(
      `[AuditExportQueue] Job ${jobId} enqueued for ${adminEmail} with filters: ${JSON.stringify(filters)}`,
    );
  }
}
