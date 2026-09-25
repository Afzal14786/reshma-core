import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env from "@config/env";

// Middleware Imports
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";
import { errorHandler } from "@shared/middlewares/error.middleware";
import { correlationMiddleware } from "@shared/middlewares/correlation.middleware";
import { httpLogger } from "@shared/middlewares/http-logger";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";

// Router Import
import globalRouter from "./routes";

const app: Application = express();

/**
 * Trust the first proxy (AWS ALB, Nginx, Cloudflare).
 *
 * Without this, `req.ip` resolves to the proxy's internal address, not
 * the client's. Every rate limiter keys on `req.ip`, so all users would
 * share a single bucket and a single busy client could 429 the entire
 * API for everyone else.
 *
 * IMPORTANT: Adjust the number if your topology has more than one proxy
 * hop (e.g., Cloudflare → ALB → Node requires `2`).
 */
app.set("trust proxy", 1);

/**
 * Security & Observability Middlewares
 */
// Helmet sets secure HTTP headers (prevents XSS, Clickjacking, MIME sniffing)
app.use(helmet());

// CORS allows our specific frontend domain to communicate with this API securely
app.use(
  cors({
    origin: [env.CLIENT_URL, env.ADMIN_URL],
    credentials: true, // Crucial for accepting HttpOnly cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

// Generate a unique correlation ID for every request (for distributed tracing)
app.use(correlationMiddleware);

/**
 * Enterprise Observability: HTTP Interceptor
 * * ARCHITECTURE NOTE:
 * Placed exactly here (before parsers, limits, and routes) so it accurately
 * measures the entire request lifecycle, including parsing time.
 */
app.use(httpLogger);

// Apply standard rate limiting to all API routes to prevent basic DDoS attempts
app.use("/api", standardLimiter);

/**
 * Payload Parsers
 * * ARCHITECTURE NOTE:
 * We use the 'verify' hook to intercept the raw Buffer stream before it gets parsed into JSON.
 * This is absolutely critical for Razorpay & Shiprocket Webhooks, which require the exact, unparsed string
 * for HMAC SHA256 cryptographic signature validation.
 */
app.use(
  express.json({
    limit: "10kb", // Strict limit to prevent Payload Too Large attacks
    verify: (req: Request, res: Response, buf: Buffer) => {
      // If the request is targeting any webhook route, safely attach the raw string
      if (req.originalUrl.includes("/webhook")) {
        req.rawBody = buf.toString("utf8");
      }
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Parse cookies attached to the client request
app.use(cookieParser(env.COOKIE_SECRET));

/**
 * Mount Global Router
 */
app.use("/api/v1", globalRouter);

/**
 * 404 Route Catcher
 * If the request bypasses the global router, it means the endpoint doesn't exist.
 * We throw an AppError, which immediately drops down to the Global Error Handler.
 */
app.all(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  next(
    new AppError(
      HTTP_STATUS.NOT_FOUND,
      `The endpoint ${req.originalUrl} does not exist on this server.`,
    ),
  );
});

/**
 * Global Error Handler
 * * ARCHITECTURE NOTE:
 * This MUST be the very last middleware mounted. It catches all AppErrors,
 * ZodErrors, and MongooseErrors, formats them securely, and sends the JSON response.
 */
app.use(errorHandler);

export default app;
