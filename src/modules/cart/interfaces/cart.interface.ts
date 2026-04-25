import { Types, Document } from "mongoose";

/**
 * Supported primitive types for dynamic product attributes.
 * Enforces strict typing over the generic 'any' keyword.
 */
export type AttributeValue = string | number | boolean;

/**
 * @interface ICartItem
 * @description Represents an individual product line item within a user's cart.
 */
export interface ICartItem {
  /** The unique MongoDB ObjectId of the referenced Product */
  product: Types.ObjectId;

  /** The number of units the customer wishes to purchase */
  quantity: number;

  /**
   * A strictly typed map to store user-selected polymorphic variations.
   * Replaces 'any' to ensure absolute type safety at compile time.
   * Example: { "bangleSize": "2.4", "color": "Red" }
   */
  selectedAttributes?: Record<string, AttributeValue>;
}

/**
 * @interface ICart
 * @description Represents the stateful shopping cart for a specific user.
 * Prices are intentionally omitted to prevent stale data; they must be computed
 * dynamically during retrieval by cross-referencing the Product catalog.
 */
export interface ICart extends Document {
  /** The unique MongoDB ObjectId of the User who owns this cart */
  user: Types.ObjectId;

  /** The collection of products currently held in the cart */
  items: ICartItem[];

  /** Timestamp of cart creation (Auto-managed by Mongoose) */
  createdAt: Date;

  /** Timestamp of last cart modification (Auto-managed by Mongoose) */
  updatedAt: Date;
}
