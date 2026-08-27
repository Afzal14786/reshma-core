import { z } from "zod";

/**
 * Advanced Search Data Transfer Object
 * Protects the Typesense engine from malicious or malformed query strings.
 *
 * SECURITY ENHANCEMENT (Phase 1.1):
 * - itemType and mainCategory are now locked to strict enums.
 * - These exact values are derived from the Product schema discriminators.
 * - Prevents Typesense filter injection attacks by rejecting malformed categories
 *   at the Zod validation layer before they reach the RAM cluster.
 */
export const SearchQuerySchema = z.object({
  q: z.string().default("*"), // '*' tells Typesense to match everything if no query is provided
  page: z.coerce.number().int().min(1).default(1),
  // Hard ceiling of 100 items per page to prevent memory exhaustion attacks
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // SECURE: Strict enums to prevent Typesense filter injection
  // These values must match the discriminator enums in your Product Schema
  itemType: z
    .enum(["BANGLE", "APPAREL", "FABRIC", "INNERWEAR", "ACCESSORY"])
    .optional(),

  mainCategory: z
    .enum(["Sarees", "Apparel", "Accessories", "Innerwear", "Bangles"])
    .optional(),

  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  // Sorting: strictly controlled to prevent query injection
  sortBy: z
    .enum(["basePrice:asc", "basePrice:desc", "createdAt:desc"])
    .optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
