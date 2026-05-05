import { z } from "zod";

/**
 * Advanced Search Data Transfer Object
 * Protects the Typesense engine from malicious or malformed query strings.
 */
export const SearchQuerySchema = z.object({
  q: z.string().default("*"), // '*' tells Typesense to match everything if no query is provided
  page: z.coerce.number().int().min(1).default(1),
  // Hard ceiling of 100 items per page to prevent memory exhaustion attacks
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Faceted Filters (Optional)
  itemType: z.string().optional(),
  mainCategory: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  // Sorting: strictly controlled to prevent query injection
  sortBy: z
    .enum(["basePrice:asc", "basePrice:desc", "createdAt:desc"])
    .optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
