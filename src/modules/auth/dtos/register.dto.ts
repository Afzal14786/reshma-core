import { z } from "zod";

/**
 * Registration DTO
 * * ARCHITECTURE NOTE:
 * We enforce strict password policies and automatically sanitize inputs (trimming whitespace,
 * lowercasing emails) before the data ever reaches the controller.
 * * * LEGAL NOTE (DPDP/GDPR): We strictly enforce that the 'acceptPrivacyPolicy'
 * boolean is present and true. If a user or bot bypasses the frontend checkbox,
 * Zod will block the request right here.
 */
export const RegisterSchema = z.object({
  body: z.object({
    firstname: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .trim(),
    lastname: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .trim(),
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),

    // Transform strips all spaces and hyphens from the phone number
    phone: z
      .string()
      .transform((val) => val.replace(/[\s-]/g, ""))
      .optional(),

    // --- LEGAL GATEKEEPER ---
    acceptPrivacyPolicy: z.boolean().refine((val) => val === true, {
      message:
        "You must explicitly accept the Privacy Policy to create an account.",
    }),
  }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>["body"];
