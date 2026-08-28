import { z } from "zod";

/**
 * DTO for initiating 2FA setup.
 * No body required; the user must be authenticated (JWT) to access this.
 */
export const SetupTwoFactorSchema = z.object({
  body: z.object({}).strict(),
});

/**
 * DTO for verifying the initial TOTP to enable 2FA.
 */
export const VerifySetupTwoFactorSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
    })
    .strict(),
});

/**
 * DTO for verifying 2FA during login.
 * Requires the 6-digit token and the short-lived twoFactorToken from the login step.
 */
export const VerifyLoginTwoFactorSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
      twoFactorToken: z.string().min(10, "Invalid session token"),
      // Optional: Backup code (alphanumeric, 10 chars)
      backupCode: z
        .string()
        .length(10, "Invalid backup code format")
        .optional(),
    })
    .strict(),
});

/**
 * DTO for disabling 2FA.
 * Requires the current TOTP to prevent unauthorized deactivation.
 */
export const DisableTwoFactorSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
    })
    .strict(),
});

// Type exports for controllers
export type SetupTwoFactorInput = z.infer<typeof SetupTwoFactorSchema>["body"];
export type VerifySetupTwoFactorInput = z.infer<
  typeof VerifySetupTwoFactorSchema
>["body"];
export type VerifyLoginTwoFactorInput = z.infer<
  typeof VerifyLoginTwoFactorSchema
>["body"];
export type DisableTwoFactorInput = z.infer<
  typeof DisableTwoFactorSchema
>["body"];
