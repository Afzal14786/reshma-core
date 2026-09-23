import mongoose, { Schema } from "mongoose";
import { INotification } from "./interface/notification.interface";

const NotificationSchema = new Schema<INotification>(
  {
    // @Index true -> Crucial for scaling. We will always query notifications by user ID.
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["SYSTEM", "ORDER", "PROMOTION", "SECURITY", "RETURN"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    link: { type: String }, // e.g., "/dashboard/settings"
  },
  {
    timestamps: true,
  },
);

// Create a compound index: Retrieve unread notifications for a specific user, sorted by newest
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
