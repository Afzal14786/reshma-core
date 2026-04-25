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
 * Prevents the frontend from injecting complex nested objects or malicious scripts into the attribute map.
 */
const attributeValueValidator = z.union([z.string(), z.number(), z.boolean()]);

/**
 * @schema AddItemToCartSchema
 * @description Validates the payload when a customer adds a new item to their cart.
 * Target: POST /cart/add
 */
export const AddItemToCartSchema = z.object({
  body: z.object({
    productId: objectIdValidator,

    // supported 'message' property to satisfy TypeScript in all Zod versions.
    quantity: z
      .number({ message: "Quantity is required and must be a valid number" })
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1"), // Absolute firewall against negative quantity math exploits

    selectedAttributes: z
      .record(z.string(), attributeValueValidator)
      .optional()
      .describe(
        'A map of dynamically selected attributes like size or color (e.g., {"bangleSize": "2.4"})',
      ),
  }),
});

/**
 * @schema UpdateCartItemSchema
 * @description Validates the payload when a customer updates an existing item in their cart.
 * Target: PATCH /cart/update
 */
export const UpdateCartItemSchema = z.object({
  body: z
    .object({
      productId: objectIdValidator,

      // Quantity is optional here because the user might only want to update the 'selectedAttributes'
      quantity: z
        .number({ message: "Quantity must be a valid number" })
        .int("Quantity must be a whole number")
        .min(1, "Quantity must be at least 1")
        .optional(),

      selectedAttributes: z
        .record(z.string(), attributeValueValidator)
        .optional(),
    })
    .refine(
      (data) =>
        data.quantity !== undefined || data.selectedAttributes !== undefined,
      {
        message:
          "You must provide either a new quantity or new selectedAttributes to update.",
      },
    ),
});

/**
 * @schema RemoveCartItemSchema
 * @description Validates the URL parameters when removing a single item from the cart.
 * Target: DELETE /cart/item/:productId
 */
export const RemoveCartItemSchema = z.object({
  params: z.object({
    productId: objectIdValidator,
  }),
});

/**
 * @schema MergeCartSchema
 * @description Validates the payload when the frontend sends a LocalStorage guest cart
 * to be merged into the user's database cart upon login.
 * Target: POST /cart/merge
 */
export const MergeCartSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: objectIdValidator,
          quantity: z
            .number({ message: "Quantity must be a valid number" })
            .int("Quantity must be a whole number")
            .min(1, "Quantity must be at least 1"),
          selectedAttributes: z
            .record(z.string(), attributeValueValidator)
            .optional(),
        }),
      )
      .max(
        50,
        "Cannot merge more than 50 unique items at once to prevent payload abuse",
      ),
  }),
});

/**
 * @type AddItemToCartInput
 * @type UpdateCartItemInput
 * @type MergeCartInput
 * @description Extracted TypeScript interfaces generated dynamically from the Zod schemas.
 * These guarantee strict compile-time safety when passing data to the CartService.
 */
export type AddItemToCartInput = z.infer<typeof AddItemToCartSchema>["body"];
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>["body"];
export type MergeCartInput = z.infer<typeof MergeCartSchema>["body"];
