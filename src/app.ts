import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
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

/** * Security & HTTP Middlewares
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

/** * Payload Parsers
 */
// Parse incoming JSON payloads (Strict limit to 10kb to prevent Payload Too Large attacks)
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
// Parse cookies attached to the client request
app.use(cookieParser(env.JWT_ACCESS_SECRET));

/** * Mount Global Router
 */
app.use("/api/v1", globalRouter);

/** * 404 Route Catcher
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

/** * Global Error Handler
 * * ARCHITECTURE NOTE:
 * This MUST be the very last middleware mounted. It catches all AppErrors,
 * ZodErrors, and MongooseErrors, formats them securely, and sends the JSON response.
 */
app.use(errorHandler);

export default app;
