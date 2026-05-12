import cron from "node-cron";
import { OrderService } from "@modules/orders/order.service";
import logger from "@config/logger";
import { redisClient } from "@config/redis";

/**
 * Enterprise Cron Orchestrator
 * Automatically triggers maintenance tasks without blocking HTTP traffic.
 * * ARCHITECTURE NOTE:
 * Implements a Redis Distributed Lock. In a horizontally scaled environment (Docker/AWS),
 * multiple Node.js instances will trigger this cron job simultaneously. The Redis lock
 * guarantees that only ONE instance executes the database mutation, preventing
 * inventory duplication.
 */
export const startCronJobs = (): void => {
  // Run every 15 minutes: '*/15 * * * *'
  cron.schedule("*/15 * * * *", async () => {
    const lockKey = "cron:order-recovery-lock";

    try {
      // Attempt to acquire the Distributed Lock
      const acquiredLock = await redisClient.set(lockKey, "locked", {
        EX: 60,
        NX: true,
      });

      // Idempotency Firewall
      if (!acquiredLock) {
        // Another container already acquired the lock. Silently abort.
        logger.info(
          "[Cron] Order recovery sweep bypassed (Lock already acquired by another cluster instance).",
        );
        return;
      }

      // Execution (Only 1 container reaches this point)
      logger.info(
        "[Cron] Lock acquired. Initiating routine sweep for abandoned pending orders...",
      );

      await OrderService.recoverAbandonedOrders();

      logger.info("[Cron] Abandoned order sweep completed successfully.");
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[Cron] Critical failure during order recovery sweep: ${errMsg}`,
      );
    }
  });

  logger.info(
    "[System] Automated Cron Jobs initialized with Distributed Locking.",
  );
};
