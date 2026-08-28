import { z } from "zod";
import { AuditAction, AuditModule } from "../audit-log.interface";

/**
 * MongoDB ObjectId validator (reusable pattern).
 */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId format");

/**
 * Audit Log Query Schema (for GET /admin/audit-logs)
 *
 * SECURITY BOUNDARY:
 * - Caps `limit` at 100 to prevent memory exhaustion (CWE-400).
 * - Uses `z.coerce.date()` to safely parse date strings.
 * - `.strict()` drops any unknown query parameters, preventing injection.
 */
export const AdminAuditLogQuerySchema = z
  .object({
    // Pagination
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),

    // Strict Enums
    module: z.nativeEnum(AuditModule).optional(),
    action: z.nativeEnum(AuditAction).optional(),

    // ObjectId validations
    adminId: objectIdSchema.optional(),
    targetId: objectIdSchema.optional(),

    // Date Range (coerced to Date objects)
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict();

/**
 * Export Schema (same as query, but we create a separate type for semantic clarity).
 */
export const AdminAuditLogExportSchema = AdminAuditLogQuerySchema;

// Export TypeScript types for the Controllers
export type AdminAuditLogQueryInput = z.infer<typeof AdminAuditLogQuerySchema>;
export type AdminAuditLogExportInput = z.infer<
  typeof AdminAuditLogExportSchema
>;
