import app from "./app";
import env from "@config/env";
import logger from "@config/logger";
import mongoose from "mongoose";
import { redisClient, connectRedis } from "@config/redis";
import { Server } from "http";

// Initialize Background Workers
// By importing this here, the worker starts listening to Redis the moment the server boots.
import "@shared/queues/email.worker";

/**
 * Failsafe 1: Uncaught Exceptions
 * Catches synchronous bugs (e.g., trying to read a property of undefined outside an async function)
 * MUST be declared before any other code runs.
 */
process.on("uncaughtException", (err: Error) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down forcefully...", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

let server: Server;

const bootstrap = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    logger.info("MongoDB connected successfully.");

    // 2. Connect to Redis
    await connectRedis();

    // 3. Start Express Server
    server = app.listen(env.PORT, () => {
      logger.info(
        `Reshma-Core API is running on port ${env.PORT} in ${env.NODE_ENV} mode.`,
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Ignite the application
bootstrap();

/**
 * Graceful Shutdown Protocol
 * * ARCHITECTURE NOTE:
 * If we deploy to AWS or Docker, when we push a new update, the system sends a SIGTERM.
 * If we instantly kill the server, active customer checkouts will crash.
 * This function stops accepting NEW requests, finishes the CURRENT requests,
 * safely disconnects the database, and then shuts down cleanly.
 */
const gracefulShutdown = () => {
  logger.info("Received termination signal. Initiating graceful shutdown...");

  server.close(async () => {
    logger.info("HTTP server closed. Terminating database connections...");

    try {
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed.");

      await redisClient.quit();
      logger.info("Redis connection closed.");

      process.exit(0);
    } catch (error) {
      logger.error("Error during database disconnection:", error);
      process.exit(1);
    }
  });

  // Failsafe: If connections take too long to close, forcefully kill after 15 seconds
  setTimeout(() => {
    logger.error("Graceful shutdown took too long. Forcefully terminating...");
    process.exit(1);
  }, 15000);
};

/**
 * Failsafe 2: Unhandled Rejections
 * Catches asynchronous promises that throw an error without a try/catch block.
 */
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! Initiating graceful shutdown...", {
    error: err.message,
    stack: err.stack,
  });
  gracefulShutdown();
});

// Capture system termination signals
process.on("SIGTERM", gracefulShutdown); // Sent by Docker/Kubernetes/AWS
process.on("SIGINT", gracefulShutdown); // Sent by pressing CTRL+C in the terminal
