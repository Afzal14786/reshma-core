import mongoose, { Schema } from "mongoose";
import crypto from "crypto";
import {
  ITicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  LinkedEntityType,
  MessageSenderRole,
} from "./interfaces/support.interface";

/**
 * 1. MESSAGE SUB-SCHEMA
 * Represents a single reply in the threaded support conversation.
 */
const MessageSchema = new Schema(
  {
    senderRole: {
      type: String,
      enum: Object.values(MessageSenderRole),
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 3000,
    },
    attachments: [
      {
        type: String, // Cloudinary URLs
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * 2. POLYMORPHIC LINK SUB-SCHEMA
 * Allows a ticket to attach to multiple domains without strict relational locks.
 */
const LinkedEntitySchema = new Schema(
  {
    entityType: {
      type: String,
      enum: Object.values(LinkedEntityType),
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }, // No need for an ID on this small reference object
);

/**
 * 3. MASTER TICKET SCHEMA
 * The Root Aggregate for the Customer Support Engine.
 */
const TicketSchema = new Schema<ITicket>(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null, // DPDP / GDPR: Becomes null if the user executes Right to be Forgotten
      index: true,
    },
    subject: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 150,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
      index: true,
    },
    assignedAdmin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    linkedEntity: {
      type: LinkedEntitySchema,
      default: undefined,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * ARCHITECTURE NOTE: Automated ID Generator Hook
 * Intercepts the document right before validation to assign a unique,
 * human-readable tracking ID (e.g., TCK-A1B2C3D4) if one doesn't exist.
 * * SECURITY (TS Compliant):
 * Using an async function inherently returns a Promise, perfectly satisfying
 * Mongoose's execution pipeline without needing a poorly-inferred 'next()' callback.
 */
TicketSchema.pre("validate", async function () {
  if (!this.ticketId) {
    // Generates 8 random hex characters (4 bytes) safely
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    this.ticketId = `TCK-${randomHex}`;
  }
});

/**
 * SECURITY (CodeQL) NOTE:
 * Compound index created to optimize the Admin Dashboard sorting queue,
 * preventing CWE-400 (Uncontrolled Resource Consumption) during heavy loads.
 */
TicketSchema.index({ status: 1, priority: -1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
