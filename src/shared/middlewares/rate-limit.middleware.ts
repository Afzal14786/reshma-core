import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "@config/redis";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * Infrastructure Layer: Distributed Rate Limiting
 * * ARCHITECTURE NOTE:
 * Upgraded from local RAM to a Distributed Redis Store.
 * In a clustered environment (multiple EC2/PM2 instances), all servers now share
 * a centralized "Strike Counter". If an IP is blocked on Server A, it is instantly
 * blocked on Server B, neutralizing "Server-Hopping" bot attacks.
 */

// We create a factory utility to generate the RedisStore instance.
// The `sendCommand` adapter maps the rate-limiter's raw commands into our node-redis (v4) client.
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      if (!redisClient.isOpen) {
        await new Promise((resolve) => redisClient.once("ready", resolve));
      }
      return redisClient.sendCommand(args);
    },
  });
};

export const standardLimiter = rateLimit({
  store: createRedisStore("rl:standard:"),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // UNIQUE IDENTIFIER: Prevents double-count errors when layered with specific limiters
  requestPropertyName: "standardRateLimit",
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
});

export const authLimiter = rateLimit({
  store: createRedisStore("rl:auth:"),
  windowMs: 60 * 60 * 1000, // 1 Hour
  max: 10, // Limit each IP to 10 authentication requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  // UNIQUE IDENTIFIER: Prevents collision with standardLimiter
  requestPropertyName: "authRateLimit",
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message:
      "Too many authentication attempts. Your IP has been temporarily blocked to prevent brute-force attacks.",
  },
});

export const checkoutLimiter = rateLimit({
  store: createRedisStore("rl:checkout:"),
  windowMs: 60 * 60 * 1000, // 1 Hour
  max: 5, // Strict limit on order creation to prevent card-testing bots
  standardHeaders: true,
  legacyHeaders: false,
  // UNIQUE IDENTIFIER: Prevents collision with standardLimiter
  requestPropertyName: "checkoutRateLimit",
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message:
      "Checkout limit exceeded. Please contact support if you need to place a bulk order.",
  },
});

/**
 * DEVOPS HEALTH LIMITER
 * * ARCHITECTURE NOTE:
 * We explicitly DO NOT use the RedisStore here. We use the default Memory Store.
 * If Redis goes down, we need the health route to bypass the limiter and successfully
 * return a 503 state to the Load Balancer.
 * High capacity (3000) easily accommodates AWS ELB pings but blocks Layer 7 DoS attacks.
 */
export const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // ~3.3 requests per second
  standardHeaders: true,
  legacyHeaders: false,
  // UNIQUE IDENTIFIER: Prevents collision with standardLimiter
  requestPropertyName: "healthRateLimit",
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "Health check rate limit exceeded.",
  },
});
