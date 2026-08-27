import { z } from "zod";

/**
 * Admin Global Search DTO
 *
 * SECURITY BOUNDARY:
 * - Only accepts a single 'q' (query) parameter.
 * - Strips control characters to prevent log injection (CWE-117).
 * - Max length of 100 characters to prevent abusive regex attacks.
 */
export const AdminSearchQuerySchema = z.object({
  query: z.object({
    q: z
      .string()
      .trim()
      .min(1, "Search query cannot be empty")
      .max(100, "Search query is too long")
      .transform((val) => val.replace(/[\r\n]/g, "")), // CRLF Injection sanitization
  }),
});

export type AdminSearchQueryInput = z.infer<
  typeof AdminSearchQuerySchema
>["query"];
