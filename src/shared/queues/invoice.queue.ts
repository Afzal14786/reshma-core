import { Queue } from "bullmq";
import env from "@config/env";
import logger from "@config/logger";

export interface IInvoiceJobData {
  orderId: string;
}

/**
 * ARCHITECTURE NOTE: BullMQ Redis Connection
 * BullMQ uses 'ioredis' internally, which has a different API than our primary 'node-redis' client.
 * We parse the REDIS_URL to feed BullMQ's expected ConnectionOptions so it can manage its own socket.
 */
const redisUrl = new URL(env.REDIS_URL);

/**
 * ARCHITECTURE NOTE: Strict Generics
 * We explicitly pass "generate-invoice" as the third generic type to satisfy
 * BullMQ's ExtractNameType requirement and enforce type-safety on job enqueuing.
 */
export const invoiceQueue = new Queue<
  IInvoiceJobData,
  void,
  "generate-invoice"
>("invoice-generation", {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    password: env.REDIS_PASSWORD || redisUrl.password || undefined,
    // Enable TLS if the environment utilizes a secure redis protocol (rediss://)
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export class InvoiceQueueManager {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  public static async enqueueInvoiceGeneration(orderId: string): Promise<void> {
    try {
      const safeOrderId = String(orderId).replace(/[\r\n]/g, "");

      // The compiler now successfully recognizes "generate-invoice" as the valid enum type
      await invoiceQueue.add("generate-invoice", { orderId: safeOrderId });

      logger.info(
        this.safeLog(
          `[InvoiceQueue] Successfully enqueued background invoice job for Order: ${safeOrderId}`,
        ),
      );
    } catch (error) {
      logger.error(
        this.safeLog(
          `[InvoiceQueue] Failed to enqueue job: ${error instanceof Error ? error.message : "Unknown"}`,
        ),
      );
    }
  }
}
