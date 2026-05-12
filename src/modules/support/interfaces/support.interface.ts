import { Types, Document } from "mongoose";

/**
 * SUPPORT ENGINE ENUMS
 * Defines the strict state machines and categorizations for the ticketing system.
 */

export enum TicketCategory {
  ORDER_ISSUE = "ORDER_ISSUE",
  PAYMENT_ISSUE = "PAYMENT_ISSUE",
  RETURN_ISSUE = "RETURN_ISSUE",
  PRODUCT_INQUIRY = "PRODUCT_INQUIRY",
  TECHNICAL_ISSUE = "TECHNICAL_ISSUE",
  GENERAL = "GENERAL",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL", // Reserved for Admin escalation (e.g., Legal/Fraud)
}

export enum TicketStatus {
  OPEN = "OPEN", // Customer initiated
  IN_PROGRESS = "IN_PROGRESS", // Admin is investigating
  WAITING_ON_CUSTOMER = "WAITING_ON_CUSTOMER", // Admin replied, pending customer action
  RESOLVED = "RESOLVED", // Solution provided
  CLOSED = "CLOSED", // Hard locked, no further replies allowed
}

export enum LinkedEntityType {
  ORDER = "Order",
  PRODUCT = "Product",
  RETURN = "Return",
}

export enum MessageSenderRole {
  USER = "USER",
  ADMIN = "ADMIN",
}

/**
 * SUPPORT ENGINE INTERFACES
 */

export interface ILinkedEntity {
  entityType: LinkedEntityType;
  entityId: Types.ObjectId;
}

export interface ITicketMessage {
  _id?: Types.ObjectId; // Embedded subdocument ID
  senderRole: MessageSenderRole;
  senderId: Types.ObjectId;
  message: string;
  attachments: string[]; // Cloudinary secure URLs
  isRead: boolean;
  createdAt?: Date;
}

export interface ITicket extends Document {
  ticketId: string; // Human-readable ID (e.g., TCK-9A4B2)
  user: Types.ObjectId | null; // Nullable for DPDP/GDPR "Right to be Forgotten"

  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;

  // Polymorphic association (allows a ticket to be explicitly linked to an Order, Product, etc.)
  linkedEntity?: ILinkedEntity;

  // Threaded conversation array
  messages: ITicketMessage[];

  // Auditing
  assignedAdmin?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
