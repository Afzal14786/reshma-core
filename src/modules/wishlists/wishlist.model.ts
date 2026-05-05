import mongoose, { Schema } from "mongoose";
import { IWishlist } from "./interfaces/wishlist.interface";

/**
 * @schema WishlistItemSchema
 * @description The sub-document schema defining individual saved items.
 */
const WishlistItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      // Must reference the polymorphic base collection to allow saving Bangles, Apparel, etc.
      ref: "BaseProduct",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // PERFORMANCE: Disables automatic ObjectId generation for sub-documents.
    // This prevents massive database bloat for users who wishlist hundreds of items.
    _id: false,
  },
);

/**
 * @schema WishlistSchema
 * @description The primary schema for the Wishlist domain.
 */
const WishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // FIREWALL: Mathematically guarantees a single user cannot possess concurrent parallel wishlists.
      index: true, // PERFORMANCE: Heavily optimizes the retrieval query since this is read-heavy.
    },
    items: [WishlistItemSchema],
  },
  {
    timestamps: true,
  },
);

export const Wishlist = mongoose.model<IWishlist>("Wishlist", WishlistSchema);
