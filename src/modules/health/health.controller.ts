import { Request, Response } from "express";
import mongoose from "mongoose";
import { redisClient } from "@config/redis";
import { typesenseManager } from "@config/typesense";
import os from "os";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";

/**
 * DevOps Infrastructure: Deep Liveness Probe
 * * ARCHITECTURE NOTE:
 * Evaluates the actual health of all dependent microservices.
 * If a dependency is down, it returns HTTP 503 to force the AWS/K8s
 * Load Balancer to pull this specific instance out of the traffic rotation.
 */
export class HealthController {
  public static async checkHealth(req: Request, res: Response) {
    const healthStatus = {
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: { status: "UNKNOWN", latency: 0 },
        redis: { status: "UNKNOWN", latency: 0 },
        typesense: { status: "UNKNOWN", latency: 0 },
      },
      system: {
        memoryUsagePercent: 0,
        cpuLoadAvg: os.loadavg(),
      },
    };

    let isHealthy = true;

    // 1. MongoDB Deep Ping
    try {
      const mongoStart = Date.now();
      // Ensure the driver is actually connected before attempting to ping the admin DB
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        healthStatus.services.mongodb.latency = Date.now() - mongoStart;
        healthStatus.services.mongodb.status = "UP";
      } else {
        throw new Error("Mongoose readyState indicates disconnection.");
      }
    } catch (error) {
      isHealthy = false;
      healthStatus.services.mongodb.status = "DOWN";
      logger.error("[HealthCheck] MongoDB Deep Probe Failed.");
    }

    // 2. Redis Deep Ping
    try {
      const redisStart = Date.now();
      if (redisClient.isOpen) {
        await redisClient.ping();
        healthStatus.services.redis.latency = Date.now() - redisStart;
        healthStatus.services.redis.status = "UP";
      } else {
        throw new Error("Redis client is not open.");
      }
    } catch (error) {
      isHealthy = false;
      healthStatus.services.redis.status = "DOWN";
      logger.error("[HealthCheck] Redis Deep Probe Failed.");
    }

    // 3. Typesense Deep Ping
    try {
      const tsStart = Date.now();
      await typesenseManager.client.health.retrieve();
      healthStatus.services.typesense.latency = Date.now() - tsStart;
      healthStatus.services.typesense.status = "UP";
    } catch (error) {
      isHealthy = false;
      healthStatus.services.typesense.status = "DOWN";
      logger.error("[HealthCheck] Typesense Deep Probe Failed.");
    }

    // 4. System Hardware Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    healthStatus.system.memoryUsagePercent = parseFloat(
      ((usedMem / totalMem) * 100).toFixed(2),
    );

    // Evaluate final health state
    if (!isHealthy) {
      healthStatus.status = "DEGRADED";
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(healthStatus);
    }

    return res.status(HTTP_STATUS.OK).json(healthStatus);
  }
}
