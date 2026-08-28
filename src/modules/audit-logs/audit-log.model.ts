import mongoose, { Schema } from "mongoose";
import { IAuditLog, AuditAction, AuditModule } from "./audit-log.interface";

const AuditLogSchema = new Schema<IAuditLog>(
  {
    // --- Who ---
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
      index: true,
    },
    adminName: {
      type: String,
      required: true,
    },

    // --- What ---
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: Object.values(AuditModule),
      required: true,
      index: true,
    },

    // --- Target ---
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    targetName: {
      type: String,
    },

    // --- Change Context ---
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    payload: {
      type: Schema.Types.Mixed,
    },

    // --- Where & When ---
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * ENTERPRISE PERFORMANCE STRATEGY:
 * Compound indexes are created to handle the most common Admin Dashboard queries.
 * - `adminId + timestamp`: Filter by admin, sorted by recent.
 * - `module + timestamp`: Filter by module, sorted by recent.
 * - `targetId + module`: Find full history of a specific entity.
 * - `timestamp`: General date-range queries.
 */
AuditLogSchema.index({ adminId: 1, timestamp: -1 });
AuditLogSchema.index({ module: 1, timestamp: -1 });
AuditLogSchema.index({ targetId: 1, module: 1 });
AuditLogSchema.index({ timestamp: -1 });

/**
 * Defensive pre-save hook to ensure timestamp is never null.
 * Mongoose v7+ compatible (async function, no `next` callback).
 */
AuditLogSchema.pre("save", async function () {
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
});

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
