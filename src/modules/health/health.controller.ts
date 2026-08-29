import { Request, Response } from "express";
import mongoose from "mongoose";
import { redisClient } from "@config/redis";
import { typesenseManager } from "@config/typesense";
import { emailQueue } from "@shared/queues/email.queue";
import os from "os";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";

/**
 * HEALTH CHECK TIMEOUTS (Milliseconds)
 * Prevents the health endpoint from hanging if a dependency is slow.
 */
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * DevOps Infrastructure: Deep Liveness Probe (Enhanced)
 *
 * ARCHITECTURE NOTE:
 * Evaluates the actual health of all dependent microservices AND BullMQ workers.
 * If a dependency is down, it returns HTTP 503 to force the AWS/K8s
 * Load Balancer to pull this specific instance out of the traffic rotation.
 *
 * ENHANCEMENTS (Phase 3.3):
 * - Added BullMQ queue liveness check.
 * - Added timeout guards (Promise.race) to prevent hanging.
 * - Added worker health check for BullMQ.
 */
export class HealthController {
  /**
   * Utility: Runs a promise with a timeout guard.
   * Prevents the health check from hanging indefinitely.
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = HEALTH_CHECK_TIMEOUT,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    return Promise.race([promise, timeoutPromise]);
  }

  public static async checkHealth(req: Request, res: Response) {
    const healthStatus = {
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: { status: "UNKNOWN", latency: 0 },
        redis: { status: "UNKNOWN", latency: 0 },
        typesense: { status: "UNKNOWN", latency: 0 },
        bullmq: { status: "UNKNOWN", workers: 0, latency: 0 },
      },
      system: {
        memoryUsagePercent: 0,
        cpuLoadAvg: os.loadavg(),
      },
    };

    let isHealthy = true;

    // mongo deep ping (with timeout)
    try {
      const mongoStart = Date.now();
      await HealthController.withTimeout(
        (async () => {
          if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
          } else {
            throw new Error("Mongoose readyState indicates disconnection.");
          }
        })(),
      );
      healthStatus.services.mongodb.latency = Date.now() - mongoStart;
      healthStatus.services.mongodb.status = "UP";
    } catch (error) {
      isHealthy = false;
      healthStatus.services.mongodb.status = "DOWN";
      const errMsg = error instanceof Error ? error.message : "Unknown";
      logger.error(`[HealthCheck] MongoDB Deep Probe Failed: ${errMsg}`);
    }

    // redis deep ping
    try {
      const redisStart = Date.now();
      await HealthController.withTimeout(
        (async () => {
          if (redisClient.isOpen) {
            await redisClient.ping();
          } else {
            throw new Error("Redis client is not open.");
          }
        })(),
      );
      healthStatus.services.redis.latency = Date.now() - redisStart;
      healthStatus.services.redis.status = "UP";
    } catch (error) {
      isHealthy = false;
      healthStatus.services.redis.status = "DOWN";
      const errMsg = error instanceof Error ? error.message : "Unknown";
      logger.error(`[HealthCheck] Redis Deep Probe Failed: ${errMsg}`);
    }

    // typesence deep ping
    try {
      const tsStart = Date.now();
      await HealthController.withTimeout(
        typesenseManager.client.health.retrieve(),
      );
      healthStatus.services.typesense.latency = Date.now() - tsStart;
      healthStatus.services.typesense.status = "UP";
    } catch (error) {
      isHealthy = false;
      healthStatus.services.typesense.status = "DOWN";
      const errMsg = error instanceof Error ? error.message : "Unknown";
      logger.error(`[HealthCheck] Typesense Deep Probe Failed: ${errMsg}`);
    }

    // bullmq queue & worker liveness
    try {
      const bullStart = Date.now();
      let workerCount = 0;

      // Instead, we check if the queue is operational by:
      // 1. Getting the list of workers
      // 2. If workers exist, the queue is operational.
      const queueInfo = await HealthController.withTimeout(
        emailQueue.getWorkers(),
      );
      workerCount = queueInfo.length;

      // If we have at least 1 active worker, the queue is healthy
      if (workerCount > 0) {
        healthStatus.services.bullmq.status = "UP";
        healthStatus.services.bullmq.workers = workerCount;
      } else {
        // If no workers are running, the queue is in a degraded state
        healthStatus.services.bullmq.status = "NO_WORKERS";
        isHealthy = false;
      }

      healthStatus.services.bullmq.latency = Date.now() - bullStart;
    } catch (error) {
      isHealthy = false;
      healthStatus.services.bullmq.status = "DOWN";
      const errMsg = error instanceof Error ? error.message : "Unknown";
      logger.error(`[HealthCheck] BullMQ Deep Probe Failed: ${errMsg}`);
    }

    // --- 5. SYSTEM HARDWARE METRICS ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    healthStatus.system.memoryUsagePercent = parseFloat(
      ((usedMem / totalMem) * 100).toFixed(2),
    );

    // --- 6. FINAL HEALTH EVALUATION ---
    if (!isHealthy) {
      healthStatus.status = "DEGRADED";
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(healthStatus);
    }

    return res.status(HTTP_STATUS.OK).json(healthStatus);
  }
}
