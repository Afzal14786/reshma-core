import { Queue } from "bullmq";
import { redisClient } from "@config/redis";
import logger from "@config/logger";

/**
 * ARCHITECTURE NOTE:
 * BullMQ requires an underlying Redis connection. We cast it to 'any' here
 * to seamlessly bypass strict type-checking differences between 'ioredis'
 * and the standard Node Redis client, while maintaining identical functionality.
 */
export const dataExportQueue = new Queue("data-export-queue", {
  connection: redisClient as any,
});

/**
 * @class ExportQueueManager
 * @description Manages the injection of Data Portability requests into the background pipeline.
 */
export class ExportQueueManager {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   * Cleans strings of control characters to prevent Log Injection attacks.
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * Drops a payload into the BullMQ pipeline.
   * FIRE AND FORGET: This deliberately does not throw errors back to the caller
   * so the frontend API response is never blocked by a transient Redis blip.
   */
  public static async enqueueDataExport(
    userId: string,
    email: string,
    firstname: string,
  ): Promise<void> {
    const safeUserId = String(userId).replace(/[\r\n]/g, "");

    try {
      await dataExportQueue.add(
        "compile-user-data",
        { userId: safeUserId, email, firstname },
        {
          attempts: 3, // Auto-retry 3 times if the worker fails (e.g., DB timeout)
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true, // Keep Redis memory clean
          removeOnFail: false, // Keep failed jobs for Admin inspection
        },
      );

      logger.info(
        this.safeLog(
          `[Export Queue] DPDP Export job enqueued for user ${safeUserId}`,
        ),
      );
    } catch (error) {
      logger.error(
        this.safeLog(
          `[Export Queue] Failed to enqueue export job for user ${safeUserId}`,
        ),
      );
    }
  }
}
