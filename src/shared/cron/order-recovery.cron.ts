import cron from "node-cron";
import { OrderService } from "@modules/orders/order.service";
import logger from "@config/logger";

/**
 * Enterprise Cron Orchestrator
 * Automatically triggers maintenance tasks without blocking HTTP traffic.
 */
export const startCronJobs = (): void => {
  // Run every 15 minutes: '*/15 * * * *'
  cron.schedule("*/15 * * * *", async () => {
    logger.info(
      "[Cron] Initiating routine sweep for abandoned pending orders...",
    );
    try {
      await OrderService.recoverAbandonedOrders();
      logger.info("[Cron] Abandoned order sweep completed successfully.");
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(
          `[Cron] Critical failure during order recovery sweep: ${error.message}`,
        );
      } else {
        logger.error("[Cron] Critical failure during order recovery sweep");
      }
    }
  });

  logger.info("[System] Automated Cron Jobs initialized.");
};
