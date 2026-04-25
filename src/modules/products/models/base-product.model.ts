import mongoose, { Schema } from "mongoose";
import { IBaseProduct } from "../interfaces";

/**
 * Base Mongoose Configuration
 * Forces all discriminators to save to the 'products' collection.
 */
const productOptions = {
  discriminatorKey: "itemType",
  timestamps: true,
  collection: "products",
};

const BaseProductSchema = new Schema<IBaseProduct>(
  {
    itemType: {
      type: String,
      required: true,
      enum: ["BANGLE", "APPAREL", "FABRIC", "INNERWEAR", "ACCESSORY"],
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    mainCategory: {
      type: String,
      required: true,
      enum: ["Sarees", "Apparel", "Accessories", "Innerwear", "Bangles"],
    },
    subCategory: { type: String, required: true, trim: true },
    material: { type: String, required: true, trim: true },
    sellingUnit: {
      type: String,
      required: true,
      enum: ["Single Piece", "Meter", "Set", "Pair", "Dozen", "Pack"],
    },
    colors: { type: [String], default: [] },
    basePrice: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    currentStock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
    },
    weightGrams: { type: Number, required: true, min: 0 },
    isFragile: { type: Boolean, required: true },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (arr: string[]) => arr.length > 0,
        message: "Minimum one image required",
      },
    },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  productOptions,
);

// Performance Indexes
BaseProductSchema.index({ name: "text", tags: "text", subCategory: "text" });
BaseProductSchema.index({
  isActive: 1,
  itemType: 1,
  mainCategory: 1,
  createdAt: -1,
});

export const Product = mongoose.model<IBaseProduct>(
  "Product",
  BaseProductSchema,
);
