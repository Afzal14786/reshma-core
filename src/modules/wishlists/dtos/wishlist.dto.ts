import { z } from "zod";

/**
 * @constant objectIdValidator
 * @description A strictly typed, reusable regex validator for MongoDB ObjectIds.
 * Prevents malformed strings from causing database cast errors or NoSQL injection.
 */
const objectIdValidator = z
  .string({ message: "Product ID is required and must be a string" })
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid Product ID format. Must be a 24-character Hex string.",
  );

/**
 * @constant attributeValueValidator
 * @description Strictly defines the allowed primitive types for polymorphic product attributes.
 * Reused from the Cart module to maintain cross-module consistency.
 */
const attributeValueValidator = z.union([z.string(), z.number(), z.boolean()]);

/**
 * @schema AddWishlistItemSchema
 * @description Validates the payload when a customer adds a product to their wishlist.
 * Target: POST /wishlist/add
 */
export const AddWishlistItemSchema = z.object({
  body: z
    .object({
      productId: objectIdValidator,
    })
    .strict(),
});

/**
 * @schema RemoveWishlistItemSchema
 * @description Validates the URL parameters when removing a single item from the wishlist.
 * Target: DELETE /wishlist/remove/:productId
 */
export const RemoveWishlistItemSchema = z.object({
  params: z
    .object({
      productId: objectIdValidator,
    })
    .strict(),
});

/**
 * @schema MoveToCartSchema
 * @description Validates the payload when transferring an item from the Wishlist to the Cart.
 * ARCHITECTURE NOTE: Because the Wishlist does not store `selectedAttributes` (like Size: M),
 * the frontend must prompt the user for these details when moving the item to the cart,
 * passing them securely through this payload.
 * Target: POST /wishlist/move-to-cart/:productId
 */
export const MoveToCartSchema = z.object({
  params: z
    .object({
      productId: objectIdValidator,
    })
    .strict(),
  body: z
    .object({
      quantity: z
        .number({ message: "Quantity must be a valid number" })
        .int("Quantity must be a whole number")
        .min(1, "Quantity must be at least 1")
        .default(1), // Default to 1 if the frontend doesn't explicitly send it
      selectedAttributes: z
        .record(z.string(), attributeValueValidator)
        .optional()
        .describe("Dynamically selected attributes like size or color"),
    })
    .strict(),
});

/**
 * @description Extracted TypeScript interfaces generated dynamically from the Zod schemas.
 * These guarantee strict compile-time safety when passing data to the WishlistService.
 */
export type AddWishlistItemInput = z.infer<
  typeof AddWishlistItemSchema
>["body"];
export type MoveToCartInput = z.infer<typeof MoveToCartSchema>["body"];
