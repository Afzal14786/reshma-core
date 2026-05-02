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
  /** The unique MongoDB ObjectId of the referenced Product (Polymorphic BaseProduct) */
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
 * ARCHITECTURE NOTE: Prices are intentionally omitted from the database schema
 * to prevent stale data. Pricing is computed dynamically during retrieval.
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

/**
 * @interface ICartResponse
 * @description Represents the dynamically calculated cart payload sent to the client.
 * This guarantees the user always sees real-time prices, stock limits, and active status,
 * completely decoupled from the static database cart state.
 */
export interface ICartResponse {
  /** The unique identifier of the Cart document */
  _id: Types.ObjectId;

  /** The unique identifier of the Cart owner */
  user: Types.ObjectId;

  /** The dynamically populated and calculated list of cart items */
  items: {
    /** Real-time snapshot of the product at the exact moment of the request */
    product: {
      _id: Types.ObjectId;
      title: string;
      price: number;
      images: { url: string; altText?: string }[];
      inStock: boolean;
      stockQuantity: number;
      productType: string;
    } | null;

    /** The quantity requested by the user */
    quantity: number;

    /** The user's polymorphic selections (e.g., size, color) */
    selectedAttributes?: Record<string, AttributeValue>;

    /** The calculated cost for this specific line item (price * safeQuantity) */
    itemTotal: number;

    /**
     * Contextual error messaging for this specific item.
     * Populated if the product is deleted, inactive, or requested quantity exceeds stock.
     */
    error?: string;
  }[];

  /** The real-time calculated total cost of all valid items in the cart */
  subtotal: number;

  /** The total number of valid physical units in the cart */
  totalQuantity: number;
}
