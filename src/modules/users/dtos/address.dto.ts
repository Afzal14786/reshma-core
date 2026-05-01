import { z } from "zod";

/**
 * Address Creation Schema
 * Validates embedded logistics data before pushing to the User document array.
 */
export const AddAddressSchema = z.object({
  body: z
    .object({
      street: z.string().min(5, "Street address must be specific").max(100),
      city: z.string().min(2, "City name is required").max(50),
      state: z.string().min(2, "State is required").max(50),
      // Standard Indian 6-digit postal code validation
      pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Invalid 6-digit Pincode"),
      label: z.enum(["HOME", "WORK", "OTHER"]),
      isDefault: z.boolean().optional().default(false),
    })
    .strict(),
});

/**
 * Address Update Schema
 * Leverages Zod's `.partial()` to allow updating single fields (e.g., just changing the pincode)
 * without needing to send the entire address object again.
 */
export const UpdateAddressSchema = z.object({
  body: AddAddressSchema.shape.body.partial().strict(),
});

export type AddAddressInput = z.infer<typeof AddAddressSchema>["body"];
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>["body"];
