import rateLimit from "express-rate-limit";
import { HTTP_STATUS } from "@shared/constant/http-codes";

/**
 * Infrastructure Layer: Rate Limiting
 * * ARCHITECTURE NOTE:
 * E-commerce platforms face specific financial bot attacks. We export multiple limiters
 * tailored to the sensitivity of the route. Memory store is used for Phase 1, but
 * this should be swapped to a RedisStore when deployed across multiple server instances.
 */

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: "Too many request from this IP, please try again after 15 minutes",
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message:
      "Too many authentication attempts. Your IP has been temporarily blocked",
  },
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message:
      "Checkout limit exceeded. Please contact support if you need to place a bulk order.",
  },
});
