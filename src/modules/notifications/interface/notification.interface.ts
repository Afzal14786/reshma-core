import { Document, Types } from "mongoose";

export type NotificationType =
  | "SYSTEM"
  | "ORDER"
  | "PROMOTION"
  | "SECURITY"
  | "RETURN";

/**
 * In-App Database Notification Interface
 * * ARCHITECTURE NOTE:
 * This populates the "Bell Icon" in the frontend. It is completely decoupled from
 * emails. Some actions (like a password change) will trigger BOTH an email and an
 * in-app notification.
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId; // References the User
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}
