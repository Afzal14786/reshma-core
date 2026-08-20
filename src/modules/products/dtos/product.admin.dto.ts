import { z } from "zod";
import { TaxProfile } from "@modules/orders/tax.utils";

/**
 * Admin Product DTOs (Data Transfer Objects)
 *
 * ARCHITECTURE NOTE:
 * We isolate Admin payloads from Public payloads. The Admin DTO strictly validates
 * the complex JSON body required to create or update products.
 * We use `z.discriminatedUnion` to guarantee polymorphic type safety.
 *
 * COERCION HELPERS:
 * Because the frontend sends `multipart/form-data` (for image uploads), all
 * numbers, booleans, and arrays arrive as strings. These helpers transform
 * them into the proper JavaScript types before Zod validation.
 */

//  Coercion utilities

const coerceNumber = (val: unknown): number => {
  if (typeof val === "string") return parseFloat(val);
  return val as number;
};

const coerceBoolean = (val: unknown): boolean => {
  if (typeof val === "string") return val === "true" || val === "1";
  return Boolean(val);
};

const coerceArray = (val: unknown): unknown[] => {
  if (typeof val === "string" && val.startsWith("[")) {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val as unknown[];
};

//  Base product schema – common to all types

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
  subCategory: z.string().min(2, "Sub‑category is required").trim(),
  material: z.string().min(2, "Material is required").trim(),
  sellingUnit: z.enum([
    "Single Piece",
    "Meter",
    "Set",
    "Pair",
    "Dozen",
    "Pack",
  ]),
  colors: z.preprocess(coerceArray, z.array(z.string()).default([])),
  basePrice: z.preprocess(
    coerceNumber,
    z.number().min(0, "Price cannot be negative"),
  ),
  discount: z.preprocess(coerceNumber, z.number().min(0).max(100).default(0)),
  currentStock: z.preprocess(
    coerceNumber,
    z.number().int().min(0, "Stock cannot be negative"),
  ),
  weightGrams: z.preprocess(
    coerceNumber,
    z.number().min(0, "Weight is required for shipping"),
  ),
  isFragile: z.preprocess(coerceBoolean, z.boolean()),
  // Images are added by the service layer; this field is optional in the request body
  images: z.array(z.string().url()).optional(),
  tags: z.preprocess(coerceArray, z.array(z.string()).default([])),
  isActive: z.preprocess(coerceBoolean, z.boolean().default(true)),
  hsnCode: z
    .string()
    .regex(/^[0-9]{4,8}$/, "HSN code must be 4‑8 numeric digits"),
  taxProfile: z.nativeEnum(TaxProfile, {
    message:
      "Invalid or missing tax profile. Please select a legally valid Indian GST profile.",
  }),
};

const BaseProductSchema = z.object(BaseProductRules);

//  Type‑specific schemas (discriminators)

const BangleSchema = BaseProductSchema.extend({
  itemType: z.literal("BANGLE"),
  bangleSizes: z.preprocess(
    coerceArray,
    z
      .array(z.enum(["2.2", "2.4", "2.6", "2.8"]))
      .min(1, "At least one size is required"),
  ),
  packSize: z.preprocess(coerceNumber, z.number().int().min(1).default(12)),
});

const ApparelSchema = BaseProductSchema.extend({
  itemType: z.literal("APPAREL"),
  sizes: z.preprocess(
    coerceArray,
    z
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
      .min(1, "At least one size is required"),
  ),
  customTailoring: z.preprocess(coerceBoolean, z.boolean().default(false)),
  careInstructions: z.string().optional(),
});

const FabricSchema = BaseProductSchema.extend({
  itemType: z.literal("FABRIC"),
  lengthMeters: z.preprocess(
    coerceNumber,
    z.number().min(0.1, "Length must be greater than 0"),
  ),
  customTailoring: z.preprocess(coerceBoolean, z.boolean().default(true)),
});

const InnerwearSchema = BaseProductSchema.extend({
  itemType: z.literal("INNERWEAR"),
  cupSizes: z.preprocess(
    coerceArray,
    z
      .array(z.enum(["32B", "34B", "36C", "34C", "36D"]))
      .min(1, "At least one cup size is required"),
  ),
  isReturnable: z.preprocess(coerceBoolean, z.boolean().default(false)),
});

const AccessorySchema = BaseProductSchema.extend({
  itemType: z.literal("ACCESSORY"),
  sizeDetails: z.string().min(2, "Size details are required").trim(),
});

//  Create Product – discriminated union

export const CreateProductSchema = z.object({
  body: z.discriminatedUnion("itemType", [
    BangleSchema,
    ApparelSchema,
    FabricSchema,
    InnerwearSchema,
    AccessorySchema,
  ]),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>["body"];

//  Update Product – partial update with coercion

// Re‑define the same fields (with coercion) that are specific to each type,
// but now they are all optional because we use `.partial()` below.
// We extend BaseProductSchema (which already has coercion for base fields)
// and then add the optional type‑specific fields with their own coercion.

const UpdateBodySchema = BaseProductSchema.extend({
  // Bangle fields
  bangleSizes: z.preprocess(
    coerceArray,
    z.array(z.enum(["2.2", "2.4", "2.6", "2.8"])).optional(),
  ),
  packSize: z.preprocess(coerceNumber, z.number().int().min(1).optional()),

  // Apparel & Fabric fields
  sizes: z.preprocess(
    coerceArray,
    z
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
      .optional(),
  ),
  customTailoring: z.preprocess(coerceBoolean, z.boolean().optional()),
  careInstructions: z.string().optional(),
  lengthMeters: z.preprocess(coerceNumber, z.number().min(0.1).optional()),

  // Innerwear fields
  cupSizes: z.preprocess(
    coerceArray,
    z.array(z.enum(["32B", "34B", "36C", "34C", "36D"])).optional(),
  ),
  isReturnable: z.preprocess(coerceBoolean, z.boolean().optional()),

  // Accessory fields
  sizeDetails: z.string().min(2).trim().optional(),
}).partial(); // Makes all type‑specific fields optional – perfect for PATCH

export const UpdateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ID"),
  }),
  body: UpdateBodySchema,
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>["body"];
