import mongoose, { Schema } from "mongoose";
import { IOrder } from "./interfaces/order.interface";
import crypto from "crypto";

/**
 * @schema OrderItemSchema
 * @description Snapshots the product data at the exact moment of purchase.
 * ARCHITECTURE NOTE: We never rely on the 'product' reference for historical pricing,
 * as admin price changes would retroactively alter past invoices.
 */
const OrderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "BaseProduct",
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true, min: 0 },

    // Allows flexible attribute tracking (e.g., size, color) verified securely by Zod DTO
    selectedAttributes: { type: Map, of: Schema.Types.Mixed },

    // Snapshots the main display image in case the product is deleted later
    imageSnapshot: { type: String, required: true },
  },
  { _id: false }, // PERFORMANCE: Disabling _id for subdocuments saves significant BSON storage space
);

/**
 * @schema OrderSchema
 * @description The central state machine for the checkout and fulfillment pipeline.
 */
const OrderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNumber: { type: String, unique: true, index: true },

    items: [OrderItemSchema],

    // Strictly snapshotted shipping details decoupled from the User's address book
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      streetAddress: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: "India" },
    },

    pricing: {
      subTotal: { type: Number, required: true },
      shippingCost: { type: Number, required: true, default: 0 },
      taxAmount: { type: Number, required: true, default: 0 },
      discountAmount: { type: Number, required: true, default: 0 },
      appliedCoupon: {
        type: Schema.Types.ObjectId,
        ref: "Coupon",
        default: null,
      },
      totalAmount: { type: Number, required: true },
    },

    paymentMethod: { type: String, enum: ["RAZORPAY", "COD"], required: true },

    // INDEXING: Added indexes to statuses to heavily optimize Admin Dashboard filtering queries
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    orderStatus: {
      type: String,
      // Expanded to support the upcoming Returns (RMA) Module logic
      enum: [
        "PENDING",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
      ],
      default: "PENDING",
      index: true,
    },

    trackingNumber: { type: String },
    courierName: { type: String },

    // --- Shiprocket Identifiers ---
    // Sparse allows them to be uniquely indexed later if needed, without crashing on nulls
    shiprocketOrderId: { type: String, sparse: true },
    shiprocketShipmentId: { type: String, sparse: true },

    // Sparse indexes allow multiple null/undefined values without throwing uniqueness errors.
    // Crucial for orders that are initialized but abandoned before Razorpay responds.
    gatewayOrderId: { type: String, sparse: true },
    gatewayPaymentId: { type: String, sparse: true },
    gatewaySignature: { type: String },
  },
  { timestamps: true },
);

/**
 * Pre-Save Hook: Human Readable Order Generation
 * Automatically generates a unique, professional order number (e.g., ORD-7B9F1A)
 * right before the document is saved to the database for the very first time.
 */
OrderSchema.pre("save", async function () {
  if (this.isNew && !this.orderNumber) {
    // Generates a collision-resistant 6-character hex string
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    this.orderNumber = `ORD-${randomHex}`;
  }
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
