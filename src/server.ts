import app from "./app";
import env from "@config/env";
import logger from "@config/logger";
import { typesenseManager } from "@config/typesense";
import mongoose from "mongoose";
import { redisClient, connectRedis } from "@config/redis";
import { Server } from "http";
import { startCronJobs } from "./shared/cron/order-recovery.cron";

// Initialize Background Workers
// By importing this here, the workers start listening to Redis the moment the server boots.
import "@shared/queues/email.worker";
import "@shared/queues/invoice.worker";

/**
 * Failsafe : Uncaught Exceptions
 * Catches synchronous bugs (e.g., trying to read a property of undefined outside an async function).
 * MUST be declared before any other code runs to catch synchronous boot errors.
 */
process.on("uncaughtException", (err: Error) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down forcefully...", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Explicitly type as Server | undefined to enforce safety checks during shutdown
let server: Server | undefined;

/**
 * Enterprise Graceful Shutdown Protocol
 * * ARCHITECTURE NOTE:
 * If we deploy to AWS or Docker, when we push a new update, the system sends a SIGTERM.
 * If we instantly kill the server, active customer checkouts and ACID transactions will corrupt.
 * This function stops accepting NEW requests, waits for the event loop to drain,
 * safely disconnects MongoDB and Redis, and then exits cleanly.
 */
const gracefulShutdown = (signal: string) => {
  logger.info(
    `[${signal}] Received termination signal. Initiating graceful shutdown...`,
  );

  // Failsafe: Force kill if connections take too long to close
  const forceDropTimer = setTimeout(() => {
    logger.error(
      "[Shutdown] Timeout exceeded. Forcefully terminating process.",
    );
    process.exit(1);
  }, 15000);

  // Unref ensures this timer does not keep the Node event loop alive if teardown finishes quickly.
  forceDropTimer.unref();

  const teardownDatabases = async () => {
    try {
      // Safely check if Mongoose is actually connected before closing
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
        logger.info("[Shutdown] MongoDB connection closed safely.");
      }

      // Safely check if Redis is actually open before quitting
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        logger.info("[Shutdown] Redis connection closed safely.");
      }

      logger.info("[Shutdown] Sequence complete. Exiting process.");
      process.exit(0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(
          `[Shutdown] Error during database disconnection: ${error.message}`,
        );
      }
      process.exit(1);
    }
  };

  // Safely check if the Express server successfully booted before closing it
  if (server) {
    logger.info(
      "[Shutdown] Halting new HTTP traffic. Draining active requests...",
    );
    server.close(async () => {
      logger.info("[Shutdown] HTTP server closed.");
      await teardownDatabases();
    });
  } else {
    logger.info(
      "[Shutdown] HTTP server never initialized. Proceeding to database teardown...",
    );
    teardownDatabases();
  }
};

/**
 * Failsafe : Unhandled Rejections
 * Catches asynchronous promises that throw an error without a try/catch block.
 */
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! Initiating graceful shutdown...", {
    error: err.message,
    stack: err.stack,
  });
  gracefulShutdown("UNHANDLED_REJECTION");
});

// Capture system termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Sent by Docker/Kubernetes/AWS
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Sent by pressing CTRL+C in the terminal

const bootstrap = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    logger.info("MongoDB connected successfully.");

    // Initialize Background Workers (Inventory Recovery)
    startCronJobs();

    // Initialize Search Engine Schema
    await typesenseManager.initializeSchema();

    // Connect to Redis
    await connectRedis();

    // Start Express Server
    server = app.listen(env.PORT, () => {
      logger.info(
        `Reshma-Core API is running on port ${env.PORT} in ${env.NODE_ENV} mode.`,
      );
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Failed to start server: ${error.message}`);
    }
    process.exit(1);
  }
};

// Ignite the application
bootstrap();
