import axios from "axios";
import { redisClient } from "./redis";
import env from "./env";
import logger from "./logger";

/**
 * Shiprocket Rolling Auth Manager
 *
 * ARCHITECTURE NOTE:
 * Shiprocket provides a JWT that is valid for 10 days. We do not want to execute
 * an HTTP login request for every single order dispatch (to avoid latency and rate limits).
 * This manager securely caches the token in Redis and automatically refreshes it
 * in the background before the hard expiration.
 */
class ShiprocketAuthManager {
  private readonly CACHE_KEY = "shiprocket:jwt_token";

  // Shiprocket tokens expire in 10 days.
  // We refresh it after 8 days (691200 seconds) to maintain a secure 2-day buffer.
  private readonly CACHE_TTL_SECONDS = 8 * 24 * 60 * 60;

  /**
   * Retrieves the active Shiprocket JWT.
   * If the token is missing or expired in Redis, it autonomously negotiates a new one.
   */
  public async getToken(): Promise<string> {
    try {
      // Check Redis Cache
      const cachedToken = await redisClient.get(this.CACHE_KEY);
      if (cachedToken) {
        return cachedToken;
      }

      logger.info(
        "[ShiprocketAuth] Token expired or missing. Negotiating new secure session...",
      );

      // Network Handshake (Authentication)
      const response = await axios.post(
        `${env.SHIPROCKET_API_BASE_URL}/v1/external/auth/login`,
        {
          email: env.SHIPROCKET_EMAIL,
          password: env.SHIPROCKET_PASSWORD,
        },
      );

      const token = response.data?.token;

      if (!token) {
        throw new Error(
          "Shiprocket API responded successfully but omitted the token payload.",
        );
      }

      // Cache the new token
      await redisClient.setEx(this.CACHE_KEY, this.CACHE_TTL_SECONDS, token);
      logger.info(
        "[ShiprocketAuth] New authentication token successfully generated and cached in Redis.",
      );

      return token;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        logger.error(
          `[ShiprocketAuth] Network failure during authentication: ${error.response?.data?.message || error.message}`,
        );
      } else if (error instanceof Error) {
        logger.error(`[ShiprocketAuth] Internal failure: ${error.message}`);
      }

      // We throw a standard Error rather than an AppError here because this might be
      // executed by a background BullMQ worker, not just an Express HTTP request.
      throw new Error(
        "Logistics Provider Authentication Failed. Cannot proceed with dispatch.",
      );
    }
  }
}

// Export as a Singleton to ensure connection pooling and cache logic is shared globally
export const shiprocketAuth = new ShiprocketAuthManager();
