import { z } from "zod";

/**
 * Public Product DTOs
 * * * ARCHITECTURE NOTE:
 * Public endpoints rarely use `req.body`. Instead, they rely heavily on `req.query`
 * for pagination, sorting, and filtering. This DTO sanitizes the URL parameters
 * to prevent NoSQL injection via malicious query strings.
 */

export const GetProductsQuerySchema = z.object({
  query: z.object({
    // Pagination (Zod parses these from strings to numbers automatically if we use coerce)
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(15), // Hard cap at 50 to prevent DB exhaustion

    // Filtering
    itemType: z
      .enum(["BANGLE", "APPAREL", "FABRIC", "INNERWEAR", "ACCESSORY"])
      .optional(),
    mainCategory: z
      .enum(["Sarees", "Apparel", "Accessories", "Innerwear", "Bangles"])
      .optional(),
    subCategory: z.string().trim().optional(),

    // Sorting (e.g., 'basePrice' for asc, '-basePrice' for desc)
    sort: z.string().optional(),

    // Global Text Search
    q: z.string().trim().optional(),
  }),
});

export type GetProductsQueryInput = z.infer<
  typeof GetProductsQuerySchema
>["query"];

export const GetProductByIdSchema = z.object({
  params: z.object({
    // Validate that the URL param is exactly a 24-character hex string (Mongo ObjectId)
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID format"),
  }),
});
