import mongoose, { Schema } from "mongoose";
import { IBaseProduct } from "../interfaces";
import { deleteFromCloudinary } from "@config/cloudinary";
import { TaxProfile } from "@modules/orders/tax.utils";
import logger from "@config/logger";

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

    // Legal Tax Requirements
    hsnCode: {
      type: String,
      required: true,
      trim: true,
      minlength: [4, "HSN Code must be at least 4 digits"],
      maxlength: [8, "HSN Code cannot exceed 8 digits"],
    },

    taxProfile: {
      type: String,
      enum: Object.values(TaxProfile),
      required: true,
    },

    // rating & review meta data
    ratingsMetadata: {
      averageRating: {
        type: Number,
        default: 0,
        min: [0, "Average rating cannot be below 0"],
        max: [5, "Average rating cannot exceed 5"],
        // Rounds to 1 decimal place (e.g., 4.74 -> 4.7)
        set: (val: number) => Math.round(val * 10) / 10,
      },
      totalReviews: {
        type: Number,
        default: 0,
        min: 0,
      },
      ratingDistribution: {
        1: { type: Number, default: 0, min: 0 },
        2: { type: Number, default: 0, min: 0 },
        3: { type: Number, default: 0, min: 0 },
        4: { type: Number, default: 0, min: 0 },
        5: { type: Number, default: 0, min: 0 },
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

/**
 * DOCUMENT DELETION HOOK
 * Automatically sweeps Cloudinary to delete associated images when a product is destroyed.
 */
BaseProductSchema.pre(
  "findOneAndDelete",
  async function (this: mongoose.Query<unknown, unknown>) {
    try {
      // Retrieve the document that is about to be deleted and strictly cast it
      const docToDelete = (await this.model
        .findOne(this.getQuery())
        .lean()) as IBaseProduct | null;

      // If it has images, loop through and destroy them on the cloud
      if (
        docToDelete &&
        docToDelete.images &&
        Array.isArray(docToDelete.images)
      ) {
        const deletePromises = docToDelete.images.map((imgUrl: string) => {
          if (typeof imgUrl === "string") {
            // Using your perfectly engineered existing function
            return deleteFromCloudinary(imgUrl);
          }
          return Promise.resolve();
        });

        // Await all deletion requests concurrently for maximum performance
        await Promise.all(deletePromises);
        logger.info(
          `[Product Hook] Successfully wiped orphaned images for deleted product.`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(
          `[Pre-Delete Hook] Failed to clean up images: ${error.message}`,
        );
      }
    }
  },
);

export const Product = mongoose.model<IBaseProduct>(
  "Product",
  BaseProductSchema,
);
