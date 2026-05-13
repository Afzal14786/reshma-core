import { z } from "zod";

/**
 * Data Transfer Object for Initiating Password Reset
 * Validates that the client provides a well-formed email address.
 */
export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .email("Please provide a valid email address.")
      .max(255, "Email exceeds maximum allowed length."), // Prevents payload bloat
  }),
});

/**
 * Data Transfer Object for Completing Password Reset
 * Enforces strict cryptographic password policies and prevents Resource Exhaustion (DoS).
 */
export const ResetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ message: "Reset token is required" })
      .trim()
      .min(64, "Invalid token format") // Our crypto.randomBytes(32).toString("hex") generates exactly 64 chars
      .max(64, "Invalid token format"),

    newPassword: z
      .string({ message: "New password is required" })
      .min(8, "Password must be at least 8 characters long")
      .max(64, "Password exceeds maximum length of 64 characters") // SECURITY FIX: Prevents Bcrypt DoS (CWE-400)
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[\W_]/, "Password must contain at least one special character"),
  }),
});

// Extract TypeScript types for the Controller
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>["body"];
