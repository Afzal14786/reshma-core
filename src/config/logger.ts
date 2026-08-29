import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { createNamespace } from "cls-hooked";
import env from "./env";

const isDevelopment = env.NODE_ENV === "development";

/**
 * CORRELATION ID NAMESPACE (Async Context)
 *
 * This namespace stores the `requestId` for the duration of a single HTTP request.
 * It is used by the Winston logger to inject the ID into every log entry.
 * The middleware in `correlation.middleware.ts` sets this value.
 */
export const requestNamespace = createNamespace("request-scope");

/**
 * Helper to retrieve the current request ID from the async context.
 * Returns 'no-request-id' if called outside an HTTP request (e.g., during app startup).
 */
const getRequestId = (): string => {
  return requestNamespace.get("requestId") || "no-request-id";
};

/**
 * Custom Winston format: Injects `requestId` into the log metadata.
 * This format is applied to BOTH console and file transports.
 */
const requestIdFormat = winston.format((info) => {
  info.requestId = getRequestId();
  return info;
});

/**
 * ARCHITECTURE NOTE: Enterprise Logging Configuration
 * 1. Development: Prints colorized, readable text with requestId.
 * 2. Production: Enforces strict JSON formatting for cloud log aggregators.
 * 3. Retention: Auto-rotates files daily, zips old logs, deletes logs older than 14 days.
 */

// Base JSON format used for files and Production console
const jsonFormat = winston.format.combine(
  requestIdFormat(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const transports: winston.transport[] = [
  // 1. Standard Console Output
  new winston.transports.Console({
    format: isDevelopment
      ? winston.format.combine(
          requestIdFormat(),
          winston.format.colorize(),
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.printf(
            ({ level, message, timestamp, requestId, stack }) =>
              `${timestamp} [${requestId}] [Reshma-Core] ${level}: ${stack || message}`,
          ),
        )
      : jsonFormat,
  }),

  // 2. Persistent File Output: Errors Only
  new DailyRotateFile({
    filename: "logs/error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    level: "error",
    format: jsonFormat,
  }),

  // 3. Persistent File Output: All Activity (Combined)
  new DailyRotateFile({
    filename: "logs/combined-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    format: jsonFormat,
  }),
];

const logger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  transports,
});

export default logger;
