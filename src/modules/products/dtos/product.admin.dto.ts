import { z } from "zod";

/**
 * Admin Product DTOs (Data Transfer Objects)
 * * * ARCHITECTURE NOTE:
 * We isolate the Admin payloads from the Public payloads. The Admin DTO is responsible
 * for strictly validating the complex JSON body required to create or update products.
 * We utilize `z.discriminatedUnion` to guarantee polymorphic type safety.
 */

// Define the shared properties every product must have
const BaseProductRules = {
  sku: z
    .string()
    .min(3, "SKU must be at least 3 characters")
    .trim()
    .toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  mainCategory: z.enum([
    "Sarees",
    "Apparel",
    "Accessories",
    "Innerwear",
    "Bangles",
  ]),
  subCategory: z.string().min(2).trim(),
  material: z.string().min(2).trim(),
  sellingUnit: z.enum([
    "Single Piece",
    "Meter",
    "Set",
    "Pair",
    "Dozen",
    "Pack",
  ]),
  colors: z.array(z.string()).default([]),
  basePrice: z.number().min(0, "Price cannot be negative"),
  discount: z.number().min(0).max(100).default(0),
  currentStock: z.number().int().min(0, "Stock cannot be negative"),
  weightGrams: z
    .number()
    .min(0, "Weight is required for shipping calculations"),
  isFragile: z.boolean(),
  // NOTE: 'images' are typically appended by the Service layer after Cloudinary upload,
  // but if the Admin is sending existing URLs, we validate them here.
  images: z
    .array(z.string().url())
    .min(1, "At least one image URL is required")
    .optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
};

const BaseProductSchema = z.object(BaseProductRules);

// Define the exact rules for each category by extending the Base Schema
const BangleSchema = BaseProductSchema.extend({
  itemType: z.literal("BANGLE"),
  bangleSizes: z
    .array(z.enum(["2.2", "2.4", "2.6", "2.8"]))
    .min(1, "At least one size is required"),
  packSize: z.number().int().min(1).default(12),
});

const ApparelSchema = BaseProductSchema.extend({
  itemType: z.literal("APPAREL"),
  sizes: z
    .array(
      z.enum([
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "Free Size",
        "34",
        "36",
        "38",
        "40",
      ]),
    )
    .min(1),
  customTailoring: z.boolean().default(false),
  careInstructions: z.string().optional(),
});

const FabricSchema = BaseProductSchema.extend({
  itemType: z.literal("FABRIC"),
  lengthMeters: z.number().min(0.1, "Length must be greater than 0"),
  customTailoring: z.boolean().default(true),
});

const InnerwearSchema = BaseProductSchema.extend({
  itemType: z.literal("INNERWEAR"),
  cupSizes: z.array(z.enum(["32B", "34B", "36C", "34C", "36D"])).min(1),
  isReturnable: z.boolean().default(false), // Re-enforced here before reaching DB
});

const AccessorySchema = BaseProductSchema.extend({
  itemType: z.literal("ACCESSORY"),
  sizeDetails: z.string().min(2).trim(),
});

// The Discriminated Union Firewall
// Zod looks at the 'itemType' field in req.body and applies the corresponding schema.
export const CreateProductSchema = z.object({
  body: z.discriminatedUnion("itemType", [
    BangleSchema,
    ApparelSchema,
    FabricSchema,
    InnerwearSchema,
    AccessorySchema,
  ]),
});

// Export the inferred TypeScript type for the Controller to use
export type CreateProductInput = z.infer<typeof CreateProductSchema>["body"];

// Update Schema (Making all fields optional except the discriminator)
// For PATCH requests, we don't require the entire object, just the fields being changed.
export const UpdateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID"),
  }),
  body: BaseProductSchema.extend({
    // Bangle Fields
    bangleSizes: z.array(z.enum(["2.2", "2.4", "2.6", "2.8"])),
    packSize: z.number().int().min(1),

    // Apparel & Fabric Fields
    sizes: z.array(
      z.enum([
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "Free Size",
        "34",
        "36",
        "38",
        "40",
      ]),
    ),
    customTailoring: z.boolean(),
    careInstructions: z.string(),
    lengthMeters: z.number().min(0.1),

    // Innerwear Fields
    cupSizes: z.array(z.enum(["32B", "34B", "36C", "34C", "36D"])),
    isReturnable: z.boolean(),

    // Accessory Fields
    sizeDetails: z.string().min(2).trim(),
  }).partial(), // .partial() makes every single field in this unified object optional
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>["body"];
