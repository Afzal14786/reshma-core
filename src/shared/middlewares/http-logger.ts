import morgan from "morgan";
import logger from "@config/logger";
import env from "@config/env";

/**
 * HTTP Traffic Interceptor
 * * ARCHITECTURE NOTE:
 * Morgan is excellent at intercepting Express requests, but by default, it just dumps
 * them into the terminal. We create this stream bridge to hijack Morgan's output and
 * pipe it directly into our Winston logger. This guarantees that all HTTP traffic
 * benefits from Winston's Daily Log Rotation and JSON formatting.
 */
const stream = {
  write: (message: string) => {
    // Morgan automatically adds a newline character at the end of its strings.
    // We trim it off so Winston doesn't print empty blank lines in the log files.
    logger.info(message.trim());
  },
};

/**
 * Dynamic Format Strategy:
 * - Production: We log IP addresses (`:remote-addr`), exact byte sizes, and methods.
 * This is critical for security audits, tracing DDOS attacks, and debugging proxy issues.
 * - Development: We use the 'dev' string, which provides a concise, color-coded
 * summary in the terminal to keep the developer's console clean.
 */
const format =
  env.NODE_ENV === "production"
    ? ":remote-addr - :method :url :status :res[content-length] - :response-time ms"
    : "dev";

export const httpLogger = morgan(format, { stream });
