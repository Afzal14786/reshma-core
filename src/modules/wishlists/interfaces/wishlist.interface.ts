import { Types, Document } from "mongoose";

/**
 * @interface IWishlistItem
 * @description Represents an individual product saved by the user.
 * ARCHITECTURE NOTE: We intentionally do NOT store prices or active status here.
 * That data is highly volatile and will be dynamically populated at runtime.
 */
export interface IWishlistItem {
  product: Types.ObjectId;
  addedAt: Date;
}

/**
 * @interface IWishlist
 * @description The root document representing a user's entire wishlist.
 * Enforces a strict one-to-one relationship with the User identity.
 */
export interface IWishlist extends Document {
  user: Types.ObjectId;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}
