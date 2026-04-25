import { z } from "zod";

/**
 * Domain Transfer Object (DTO): Google OAuth
 * * * ARCHITECTURE NOTE:
 * Even though we trust Google, we DO NOT trust the client's browser.
 * This schema acts as an absolute firewall, ensuring the frontend sends
 * a structurally sound `idToken` before we waste server CPU cycles trying
 * to cryptographically verify it.
 */
export const googleLoginSchema = z.object({
  body: z.object({
    idToken: z
      .string({
        message: "Google ID Token is required", // Changed from required_error to message
      })
      .min(20, "Invalid Google ID token format"),
  }),
});

// Extract the inferred type strictly from the 'body' object
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>["body"];
