import { z } from "zod";

/**
 * Password Mutation Schema
 * * SECURITY NOTE:
 * We require the user's current password. This prevents session-hijacking
 * where a malicious actor uses an unlocked laptop to change the account password.
 */
export const UpdatePasswordSchema = z.object({
  body: z
    .object({
      otp: z.string().length(6, "OTP must be exactly 6 digits"),
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters")
        .regex(
          /[A-Z]/,
          "New password must contain at least one uppercase letter",
        )
        .regex(/[0-9]/, "New password must contain at least one number")
        .regex(
          /[\W_]/,
          "New password must contain at least one special character",
        ),
    })
    .strict(),
});

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>["body"];
