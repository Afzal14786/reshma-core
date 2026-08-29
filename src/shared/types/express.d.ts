import { IUser } from "@modules/users/interfaces/user.interface";

/**
 * ARCHITECTURE NOTE: Express Type Declaration Merging
 * By default, the Express Request object knows nothing about our custom properties.
 * We use TypeScript Declaration Merging to inject:
 * 1. `user` - The authenticated IUser object (populated by `protect` middleware).
 * 2. `rawBody` - The raw string body (used for Razorpay/Shiprocket webhook HMAC verification).
 * 3. `id` - The correlation ID for distributed tracing (populated by `correlationMiddleware`).
 */
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      rawBody?: string;
      id: string; // ✅ NEW: Correlation ID for request-scoped logging
    }
  }
}
