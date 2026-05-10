import { Request, Response, NextFunction } from "express";
import { redisClient } from "@config/redis";
import logger from "@config/logger";

/**
 * ARCHITECTURE NOTE: The Edge Cache Middleware
 * Shields MongoDB from read-heavy traffic spikes by serving identical GET requests from Redis RAM.
 * Utilizes a Proxy Pattern to hijack `res.json` and automatically cache Mongoose output.
 */
export const cacheMiddleware = (durationInSeconds: number) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // SECURITY: Only cache GET requests. Never cache mutations (POST, PUT, PATCH, DELETE).
    if (req.method !== "GET") {
      return next();
    }

    // Isolate the exact URL including query params (e.g., /api/v1/products?itemType=BANGLE)
    const key = `reshma:cache:${req.originalUrl}`;

    try {
      // Failsafe: If Redis crashed, bypass the cache and hit MongoDB so the platform stays online
      if (!redisClient.isOpen) {
        logger.warn("[CacheMiddleware] Redis is offline. Bypassing cache.");
        return next();
      }

      // 1. Check for a Cache Hit
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        // FAST PATH: Return directly from RAM
        res.setHeader("X-Cache", "HIT");
        res.status(200).json(JSON.parse(cachedData));
        return;
      }

      // 2. Cache Miss: Setup the Proxy
      res.setHeader("X-Cache", "MISS");

      // Keep a reference to the original Express JSON function
      const originalJson = res.json.bind(res);

      // Hijack the JSON function
      res.json = (body: any): Response => {
        // Ensure we only cache successful responses (we don't want to cache 404s or 500s)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient
            .setEx(key, durationInSeconds, JSON.stringify(body))
            .catch((err) => {
              logger.error(
                `[CacheMiddleware] Failed to write to Redis: ${err.message}`,
              );
            });
        }

        // Execute the original function to send the data to the user
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error(
        `[CacheMiddleware] Execution failed: ${error instanceof Error ? error.message : "Unknown"}`,
      );
      next(); // Failsafe: Always proceed to the controller if the cache layer fails
    }
  };
};
