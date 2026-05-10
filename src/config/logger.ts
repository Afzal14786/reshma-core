import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import env from "./env";

const isDevelopment = env.NODE_ENV === "development";

/**
 * ARCHITECTURE NOTE: Enterprise Logging Configuration
 * 1. Development: Prints colorized, easily readable text to the console.
 * 2. Production: Enforces strict JSON formatting for the console. This is mandatory for
 * cloud log aggregators (AWS CloudWatch, Datadog) to parse and index the logs properly.
 * 3. Retention: Auto-rotates files daily, zips old logs, and deletes logs older than
 * 14 days to prevent server disk exhaustion.
 */

// Define the strict JSON format used for files and Production console
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }), // Automatically extracts deep stack traces for errors
  winston.format.splat(),
  winston.format.json(),
);

const transports: winston.transport[] = [
  // 1. Standard Console Output
  new winston.transports.Console({
    format: isDevelopment
      ? winston.format.combine(
          winston.format.colorize(),
          // FIX: We must explicitly generate the timestamp for the dev console too!
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.printf(
            ({ level, message, timestamp, stack }) =>
              `${timestamp} [Reshma-Core] ${level}: ${stack || message}`,
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
    level: "error", // Critical: This file will only contain 500s and system crashes
    format: jsonFormat, // Always use JSON for persistent storage
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
