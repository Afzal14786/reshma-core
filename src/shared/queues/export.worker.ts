import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import env from "@config/env";
import logger from "@config/logger";

// Mongoose Models for direct DB access
import { User } from "@modules/users/user.model";
import { Order } from "@modules/orders/order.model";
import { Cart } from "@modules/cart/cart.model";
import { Wishlist } from "@modules/wishlists/wishlist.model";
import { Interaction } from "@modules/interactions/interaction.model";
import { Ticket } from "@modules/support/support.model";

// Notification Facade
import { NotificationService } from "@modules/notifications/notification.service";

/**
 * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
 */
const safeLog = (message: string): string => {
  return message.replace(/[\r\n]/g, "");
};

// Create a dedicated ioredis connection specifically for the BullMQ Worker
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * DPDP / GDPR Legal Engine: The Takeout Worker
 * * ARCHITECTURE NOTE:
 * This worker runs on a separate thread (or separate container in microservices).
 * It uses Promise.all() to fetch deeply nested relational data concurrently,
 * minimizing the connection time to the MongoDB cluster.
 */
export const dataExportWorker = new Worker(
  "data-export-queue",
  async (job: Job) => {
    const { userId, email, firstname } = job.data;
    const safeUserId = String(userId).replace(/[\r\n]/g, "");
    const safeEmail = String(email).replace(/[\r\n]/g, "");

    logger.info(
      safeLog(
        `[Export Worker] Commencing data compilation for user ${safeUserId}`,
      ),
    );

    try {
      // 1. Parallel Execution: Query all domains simultaneously for maximum performance
      // Using .lean() strips heavy Mongoose wrappers, saving massive amounts of RAM
      const [profile, orders, cart, wishlist, interactions, tickets] =
        await Promise.all([
          User.findOne({ _id: { $eq: safeUserId } }).lean(),
          Order.find({ user: { $eq: safeUserId } }).lean(),
          Cart.findOne({ user: { $eq: safeUserId } }).lean(),
          Wishlist.findOne({ user: { $eq: safeUserId } }).lean(),
          Interaction.find({ user: { $eq: safeUserId } }).lean(),
          Ticket.find({ user: { $eq: safeUserId } }).lean(),
          Ticket.find({ user: { $eq: safeUserId } }).lean(),
        ]);

      if (!profile) {
        logger.warn(
          safeLog(
            `[Export Worker] User ${safeUserId} not found. Aborting job.`,
          ),
        );
        return;
      }

      // SECURITY FIX: Strip internal system fields that the user shouldn't see
      const sanitizedProfile = { ...profile };
      delete (sanitizedProfile as any).password;
      delete (sanitizedProfile as any).__v;

      // 2. Data Assembly: Construct the formal JSON payload
      const exportPayload = {
        metadata: {
          generatedAt: new Date().toISOString(),
          compliance: "DPDP / GDPR Data Portability Export",
          userId: safeUserId,
        },
        identity: sanitizedProfile,
        financials: {
          ordersTotalCount: orders.length,
          orders,
        },
        ephemeralState: {
          cart: cart ? cart.items : [],
          wishlist: wishlist ? wishlist.items : [],
        },
        activity: {
          reviewsAndComments: interactions,
          supportTickets: tickets,
        },
      };

      // 3. Memory Transformation: Convert the JS object into a raw File Buffer
      const jsonString = JSON.stringify(exportPayload, null, 2); // Pretty print (2 spaces)
      const fileBuffer = Buffer.from(jsonString, "utf-8");

      // 4. Delivery: Hand the buffer to the Notification infrastructure
      await NotificationService.sendDataExportEmail(
        safeEmail,
        firstname,
        fileBuffer,
      );

      logger.info(
        safeLog(
          `[Export Worker] Successfully dispatched data export to ${safeEmail}`,
        ),
      );
    } catch (error) {
      logger.error(
        safeLog(
          `[Export Worker] Critical failure compiling data for ${safeUserId}`,
        ),
      );
      // Throwing the error tells BullMQ to automatically retry this job based on the backoff config
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 exports simultaneously to prevent memory bloat
  },
);

// Worker Lifecycle Events for Observability
dataExportWorker.on("failed", (job: Job | undefined, err: Error) => {
  const targetId = job?.data?.userId || "Unknown";
  logger.error(
    safeLog(`[Export Worker] Job Failed for user ${targetId}: ${err.message}`),
  );
});
