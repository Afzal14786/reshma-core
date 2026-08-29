import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { requestNamespace } from "@config/logger";

/**
 * Correlation ID Middleware
 *
 * Generates a unique request ID for every HTTP request to enable distributed tracing.
 * - Uses the client-provided `X-Request-ID` header if present.
 * - Otherwise, generates a new UUID.
 * - Attaches the ID to `req.id` for downstream use.
 * - Sets the response header `X-Request-ID` so clients can correlate their own logs.
 * - Binds the ID to the `requestNamespace` so Winston logs automatically include it.
 */
export const correlationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Determine the request ID (client-provided or new)
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();

  // 2. Attach to the request object
  req.id = requestId;

  // 3. Set the response header so the client can trace the request
  res.setHeader("X-Request-ID", requestId);

  // 4. Bind the ID to the async context (so Winston logs can access it)
  requestNamespace.run(() => {
    requestNamespace.set("requestId", requestId);
    next();
  });
};
