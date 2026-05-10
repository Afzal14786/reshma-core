import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize"; // NEW: Enterprise NoSQL Firewall
import cookieParser from "cookie-parser";
import env from "@config/env";

// Middleware Imports
import { standardLimiter } from "@shared/middlewares/rate-limit.middleware";
import { errorHandler } from "@shared/middlewares/error.middleware";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";

// Router Import
import globalRouter from "./routes";

const app: Application = express();

/**
 * Security & HTTP Middlewares
 */
// Helmet sets secure HTTP headers (prevents XSS, Clickjacking, MIME sniffing)
app.use(helmet());

// CORS allows our specific frontend domain to communicate with this API securely
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // Crucial for accepting HttpOnly cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

// Apply standard rate limiting to all API routes to prevent basic DDoS attempts
app.use("/api", standardLimiter);

/**
 * Payload Parsers
 * * ARCHITECTURE NOTE:
 * We use the 'verify' hook to intercept the raw Buffer stream before it gets parsed into JSON.
 * This is absolutely critical for Razorpay Webhooks, which require the exact, unparsed string
 * for HMAC SHA256 cryptographic signature validation.
 */
app.use(
  express.json({
    limit: "10kb", // Strict limit to prevent Payload Too Large attacks
    verify: (req: Request, res: Response, buf: Buffer) => {
      // If the request is targeting our webhook route, safely attach the raw string
      if (req.originalUrl.includes("/webhook")) {
        // We cast to an unknown intersection to satisfy TypeScript without using 'any'
        (req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
      }
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Parse cookies attached to the client request
app.use(cookieParser(env.JWT_ACCESS_SECRET));

/**
 * Global Security Firewall: NoSQL Injection Defense
 * * ARCHITECTURE NOTE:
 * Placed exactly here (after parsers, before routes). It recursively scans req.body,
 * req.query, and req.params, stripping out any keys starting with '$' or '.'
 * This is a global safety net in case a specific route lacks Zod validation.
 */
app.use(mongoSanitize());

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
