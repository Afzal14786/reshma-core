import mongoose, { Schema } from "mongoose";
import { ICart } from "./interfaces/cart.interface";

/**
 * @schema CartItemSchema
 * @description The sub-document schema defining individual line items in the cart.
 */
const CartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      // ARCHITECTURAL FIX: Must reference the polymorphic base collection to allow
      // population of Bangles, Apparel, Innerwear, etc., from a single reference.
      ref: "BaseProduct",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Cart item quantity must be at least 1"],
      max: [10, "Cart item quantity cannot exceed 10"], // Mirrored from the DTO firewall
    },
    selectedAttributes: {
      // Utilizes a Map for dynamic polymorphic choices (e.g., size: 'XL', color: 'Red').
      // SECURITY NOTE: While Schema.Types.Mixed can be a vector for NoSQL injection,
      // our Zod DTO strictly limits incoming values to safe primitives (String, Number, Boolean).
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // Disables the automatic generation of ObjectIds for sub-documents.
    // This prevents database bloat and keeps the JSON payload clean for the frontend.
    _id: false,
  },
);

/**
 * @schema CartSchema
 * @description The primary schema for the Cart domain. Enforces a strict one-to-one relationship with the User.
 */
const CartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Architectural Firewall: Guarantees a single user cannot possess concurrent parallel carts
      index: true, // Optimizes query performance when fetching the cart during the checkout flow
    },
    items: [CartItemSchema],
    appliedCoupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Optional but highly recommended for frontend calculation:
    totalAfterDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    // Automatically manages 'createdAt' and 'updatedAt' timestamps
    timestamps: true,
  },
);

export const Cart = mongoose.model<ICart>("Cart", CartSchema);
