import { redisClient } from "@config/redis";
import logger from "@config/logger";

export class CacheManager {
  /**
   * SECURITY UTILITY: CodeQL CWE-117 Neutralizer
   */
  private static safeLog(message: string): string {
    return message.replace(/[\r\n]/g, "");
  }

  /**
   * @method invalidateCachePattern
   * @description Finds and deletes all Redis keys matching a specific route pattern.
   * Useful when an Admin updates a resource (e.g., clearing all cached product pages).
   */
  public static async invalidateCachePattern(pattern: string): Promise<void> {
    if (!redisClient.isOpen) return;

    try {
      // Find all keys in Redis that start with our prefix + pattern
      // e.g., pattern = "/api/v1/products*"
      const searchPattern = `reshma:cache:${pattern}*`;

      // Node-Redis v4 utilizes the modern KEYS command structure
      const keys = await redisClient.keys(searchPattern);

      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(
          this.safeLog(
            `[CacheManager] Invalidated ${keys.length} cached routes for pattern: ${pattern}`,
          ),
        );
      }
    } catch (error) {
      logger.error(
        this.safeLog(
          `[CacheManager] Failed to invalidate pattern ${pattern}: ${error instanceof Error ? error.message : "Unknown"}`,
        ),
      );
    }
  }
}
