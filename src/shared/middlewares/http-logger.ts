import morgan from "morgan";
import logger from "@config/logger";
import env from "@config/env";

/**
 * ARCHITECTURE NOTE: Enterprise HTTP Interceptor
 * This middleware acts as a stopwatch for every incoming HTTP request.
 * It extracts the method, URL, status code, payload size, and exact millisecond latency.
 * The output is piped directly into our Winston logger.
 *
 * * Separation of Concerns:
 * We explicitly DO NOT use Morgan's built-in "dev" format here. Morgan's "dev"
 * injects its own ANSI color codes. Because we are piping this into Winston
 * (which already handles environment-specific coloring and JSON formatting),
 * we want Morgan to output a raw, consistent data string. Winston will format it.
 */

// The precise, data-rich string used across all environments.
const format =
  ":remote-addr - :method :url :status :res[content-length] bytes - :response-time ms";

const stream = {
  write: (message: string) => {
    // Morgan automatically adds a newline character at the end of its strings.
    // We trim it off so Winston doesn't print empty blank lines in the log files.
    logger.info(message.trim());
  },
};

export const httpLogger = morgan(format, {
  stream,
  // Keeps the terminal clean during automated test execution
  skip: () => env.NODE_ENV === "test",
});
