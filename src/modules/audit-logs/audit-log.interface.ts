import { Types, Document } from "mongoose";

/**
 * Strictly defined actions for the audit trail.
 * These represent the exact operations performed by admins.
 */
export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
}

/**
 * Strictly defined modules for the audit trail.
 * Each module represents a bounded context in the platform.
 * Adding a new module here instantly makes it available for logging.
 */
export enum AuditModule {
  PRODUCT = "PRODUCT",
  ORDER = "ORDER",
  USER = "USER",
  SUPPORT = "SUPPORT",
  RETURN = "RETURN",
  COUPON = "COUPON",
  AUTH = "AUTH",
}

/**
 * The core Audit Log document structure.
 *
 * ARCHITECTURE NOTE:
 * - `changes` is populated for `UPDATE` actions (contains before/after diff).
 * - `payload` is populated for `CREATE` actions (contains the full request body).
 * - `adminEmail` and `adminName` are denormalized for fast searching without `populate()`.
 */
export interface IAuditLog extends Document {
  // --- Who (Denormalized for performance) ---
  adminId: Types.ObjectId;
  adminEmail: string;
  adminName: string;

  // --- What ---
  action: AuditAction;
  module: AuditModule;

  // --- Target ---
  targetId: string;
  targetName?: string;

  // --- Change Context ---
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  payload?: Record<string, unknown>;

  // --- Where & When ---
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;

  // --- Mongoose Timestamps ---
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for the `AuditLogService.log()` method.
 * This ensures strict typing when passing data from the service layer.
 */
export interface IAuditLogInput {
  adminId: Types.ObjectId;
  adminEmail: string;
  adminName: string;
  action: AuditAction;
  module: AuditModule;
  targetId: string;
  targetName?: string;
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> };
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
