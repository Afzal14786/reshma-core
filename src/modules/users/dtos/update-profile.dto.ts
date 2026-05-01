import { z } from "zod";

/**
 * Profile Mutation Schema
 * * ARCHITECTURE NOTE:
 * Uses `.strict()` to guarantee absolute protection against Mass Assignment attacks.
 * Only explicit demographic fields are allowed. Attempts to inject `role`,
 * `isEmailVerified`, or `loyaltyPoints` will trigger an immediate 400 Bad Request.
 */
export const UpdateProfileSchema = z.object({
  body: z
    .object({
      firstname: z
        .string()
        .min(2, "First name must be at least 2 characters")
        .max(50)
        .optional(),
      lastname: z
        .string()
        .min(2, "Last name must be at least 2 characters")
        .max(50)
        .optional(),
      // Enforcing standard Indian 10-digit mobile number format
      phone: z
        .string()
        .regex(/^[6-9]\d{9}$/, "Invalid phone number format")
        .optional(),
      gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
      // ISO 8601 Date string validation for Birthdays
      dob: z
        .string()
        .datetime({ message: "Invalid date format. Expected ISO 8601" })
        .optional(),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>["body"];
