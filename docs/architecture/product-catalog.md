<div align="center">

  # Product Catalog Schema Mapping

  **The polymorphic discriminator strategy mapping real‑world bangles, apparel, innerwear, fabrics, and accessories into strict Mongoose schemas.**

  [![Mongoose](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Schema_Design-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Polymorphic_Models-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 1. Overview

This document maps the real‑world product catalog (bangles, apparel, fabrics, innerwear, accessories) into strict Mongoose polymorphic schemas. All products share a **base schema** (defined in `base-product.model.ts`) and each product type adds its own **discriminator** fields. The system also uses **Zod discriminated unions** (see `product.admin.dto.ts`) to validate payloads at the API boundary.

All discriminators save into the same `products` collection, enabling fast global search, pagination, and unified filtering.

---

## 2. Base Product Schema

Every product – regardless of category – must include these fields. They are defined in `IBaseProduct` and enforced by the base Mongoose schema.

| Field | Type | Validation / Notes | Source (if from Google Sheet) |
| :--- | :--- | :--- | :--- |
| `itemType` | enum | `"BANGLE"`, `"APPAREL"`, `"FABRIC"`, `"INNERWEAR"`, `"ACCESSORY"` | *Inferred from category* |
| `sku` | string | Required, unique, uppercase, trimmed | `SKU` |
| `name` | string | Required, trimmed | `Product Name` |
| `mainCategory` | enum | `"Sarees"`, `"Apparel"`, `"Accessories"`, `"Innerwear"`, `"Bangles"` | `Main Category` |
| `subCategory` | string | Required, trimmed | `Sub-Category` |
| `material` | string | Required, trimmed | `Material / Fabric` |
| `sellingUnit` | enum | `"Single Piece"`, `"Meter"`, `"Set"`, `"Pair"`, `"Dozen"`, `"Pack"` | `Selling Unit` |
| `colors` | string[] | Default `[]` | `Available Colors` |
| `basePrice` | number | Required, ≥ 0 | `Base Price (₹)` |
| `discount` | number | Default 0, 0–100 | Percentage discount |
| `currentStock` | number | Required, ≥ 0 | `Current Stock` |
| `weightGrams` | number | Required, ≥ 0 | `Weight (in Grams)` |
| `isFragile` | boolean | Required | `Is Fragile?` (if true, returns require image proof) |
| `images` | string[] | Required, at least one URL | Cloudinary URLs (uploaded via API) |
| `hsnCode` | string | Required, 4–8 digits | HSN code for Indian GST |
| `taxProfile` | enum | Required – see `TaxProfile` in `tax.utils.ts` | GST classification |
| `ratingsMetadata` | object | Auto‑managed (average rating, total reviews, distribution) | *System‑generated* |
| `tags` | string[] | Default `[]` | Search keywords |
| `isActive` | boolean | Default `true` (soft‑delete) | *Internal* |

> **Important:** The base schema also has indexes: text index on `name`, `tags`, `subCategory`; compound index on `isActive`, `itemType`, `mainCategory`, `createdAt`; unique index on `sku`.

---

## 3. Discriminator Sub‑Schemas (Category‑Specific Fields)

Each discriminator inherits all base fields and adds its own.

### 3.1 Bangle (`itemType: "BANGLE"`)

**Used for:** Glass, metal, lac bangles.  
**Mongoose model:** `bangle.model.ts`  
**Zod schema:** `BangleSchema` in `product.admin.dto.ts`

| Field | Type | Rules | Notes |
| :--- | :--- | :--- | :--- |
| `bangleSizes` | string[] | Required, at least one, enum: `"2.2"`, `"2.4"`, `"2.6"`, `"2.8"` | Traditional diameters. |
| `packSize` | number | Default 12, min 1 | Often sold by the dozen. |

**Example admin creation payload:**

```json
{
  "itemType": "BANGLE",
  "sku": "GL-RED-001",
  "name": "Red Glass Bangle Set",
  "mainCategory": "Bangles",
  "subCategory": "Glass Bangles",
  "material": "GLASS",
  "sellingUnit": "Dozen",
  "colors": ["Red"],
  "basePrice": 450,
  "currentStock": 100,
  "weightGrams": 350,
  "isFragile": true,
  "hsnCode": "7117",
  "taxProfile": "IMITATION_JEWELLERY",
  "bangleSizes": ["2.4", "2.6"],
  "packSize": 12
}
```  

### 3.2 Apparel (`itemType: "APPAREL"`)

**Used for:** Sarees, kurtis, suits, lehengas, readymade garments.  
**Mongoose model:** `apparel.model.ts`  
**Zod schema:** `ApparelSchema`

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `sizes` | `string[]` | Required, at least one, enum: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`, `"XXL"`, `"Free Size"`, `"34"`, `"36"`, `"38"`, `"40"` | Supports both letter and numeric sizes. |
| `customTailoring` | `boolean` | Default `false` | If true, checkout will collect measurements. |
| `careInstructions` | `string` | Optional, trimmed | Wash/dry care details. |  

**Example:**  
```json
{
  "itemType": "APPAREL",
  "sku": "SAR-GEO-001",
  "name": "Georgette Saree",
  "mainCategory": "Sarees",
  "subCategory": "Georgette",
  "material": "Georgette",
  "sellingUnit": "Single Piece",
  "colors": ["Red", "Gold"],
  "basePrice": 2500,
  "currentStock": 50,
  "weightGrams": 800,
  "isFragile": false,
  "hsnCode": "6204",
  "taxProfile": "STITCHED_APPAREL",
  "sizes": ["Free Size"],
  "customTailoring": true,
  "careInstructions": "Dry clean only"
}
```  

### 3.3 Fabric (`itemType: "FABRIC"`)

**Used for:** Unstitched fabric sold by length.  
**Mongoose model:** `fabric.model.ts`  
**Zod schema:** `FabricSchema`

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `lengthMeters` | `number` | Required, ≥ 0.1 | Length in metres. |
| `customTailoring` | `boolean` | Default `true` | Unstitched fabric usually requires tailoring. |  

**Example:**  

```json
{
  "itemType": "FABRIC",
  "sku": "FAB-SILK-001",
  "name": "Raw Silk Fabric",
  "mainCategory": "Apparel",
  "subCategory": "Silk Fabric",
  "material": "Silk",
  "sellingUnit": "Meter",
  "colors": ["Cream"],
  "basePrice": 850,
  "currentStock": 200,
  "weightGrams": 250,
  "isFragile": false,
  "hsnCode": "5007",
  "taxProfile": "UNSTITCHED_FABRIC",
  "lengthMeters": 5.5,
  "customTailoring": true
}
```  

### 3.4 Innerwear (`itemType: "INNERWEAR"`)

**Used for:** Bras, panties, shapewear. Hygiene policy – non‑returnable.  
**Mongoose model:** `innerwear.model.ts`  
**Zod schema:** `InnerwearSchema`

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `cupSizes` | `string[]` | Required, at least one, enum: `"32B"`, `"34B"`, `"36C"`, `"34C"`, `"36D"` | Common Indian sizes. |
| `isReturnable` | `boolean` | Forced `false` (schema uses `set: () => false`) | Cannot be overridden. |  

**Example:**  
```json
{
  "itemType": "INNERWEAR",
  "sku": "INW-BRA-001",
  "name": "Cotton Bra",
  "mainCategory": "Innerwear",
  "subCategory": "Bras",
  "material": "Cotton",
  "sellingUnit": "Single Piece",
  "colors": ["White", "Black"],
  "basePrice": 450,
  "currentStock": 150,
  "weightGrams": 60,
  "isFragile": false,
  "hsnCode": "6212",
  "taxProfile": "GENERAL_ACCESSORY",
  "cupSizes": ["34B", "36C"],
  "isReturnable": false
}
```  

### 3.5 Accessory (`itemType: "ACCESSORY"`)

**Used for:** Jewellery, bags, bindis, hair accessories.  
**Mongoose model:** `accessory.model.ts`  
**Zod schema:** `AccessorySchema`

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `sizeDetails` | `string` | Required, trimmed | Free‑text size description (e.g., “Adjustable”, “One Size”, “Length 18 cm”). |  

**Example:**  
```json
{
  "itemType": "ACCESSORY",
  "sku": "ACC-NECK-001",
  "name": "Gold Plated Necklace",
  "mainCategory": "Accessories",
  "subCategory": "Necklaces",
  "material": "Metal",
  "sellingUnit": "Single Piece",
  "colors": ["Gold"],
  "basePrice": 1200,
  "currentStock": 30,
  "weightGrams": 45,
  "isFragile": true,
  "hsnCode": "7113",
  "taxProfile": "IMITATION_JEWELLERY",
  "sizeDetails": "Adjustable chain length 42-48 cm"
}
```  

---   

## 4. Zod Discriminated Union – The Payload Firewall

The admin creation endpoint uses a **Zod discriminated union** to enforce the correct fields based on `itemType`. Defined in `product.admin.dto.ts`:  

```typescript
export const CreateProductSchema = z.object({
  body: z.discriminatedUnion("itemType", [
    BangleSchema,
    ApparelSchema,
    FabricSchema,
    InnerwearSchema,
    AccessorySchema,
  ]),
});
```  

This guarantees:

- A bangle cannot be created with `cupSizes`.
- An apparel cannot be created with `bangleSizes`.
- All required base fields (including `hsnCode`, `taxProfile`) are enforced across all types.

If validation fails, the API returns `400 Bad Request` with a comma‑separated list of errors.

---  

## 5. Public Listing & Query Validation

The public `GET /api/v1/products` endpoint uses `GetProductsQuerySchema` from `product.public.dto.ts`:  

```typescript
export const GetProductsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(15),
    itemType: z.enum(["BANGLE","APPAREL","FABRIC","INNERWEAR","ACCESSORY"]).optional(),
    mainCategory: z.enum(["Sarees","Apparel","Accessories","Innerwear","Bangles"]).optional(),
    subCategory: z.string().trim().optional(),
    sort: z.string().optional(),
    q: z.string().trim().optional(),
  }),
});
```  

- The `limit` is capped at **50** to prevent memory exhaustion.
- `itemType` and `mainCategory` are optional enums.
- `q` provides full‑text search across `name`, `tags`, and `subCategory` (using MongoDB text index).  

---  

## 6. Related Files

| File | Purpose |
|------|---------|
| `src/modules/products/interfaces/*.ts` | TypeScript interfaces for base and discriminators. |
| `src/modules/products/models/*.model.ts` | Mongoose discriminator models. |
| `src/modules/products/dtos/product.admin.dto.ts` | Zod validation for admin creation/update. |
| `src/modules/products/dtos/product.public.dto.ts` | Query validation for public listing. |
| `src/modules/orders/tax.utils.ts` | `TaxProfile` enum. |
| `src/modules/products/product.service.ts` | Business logic (creation, search, Typesense sync). |

---  

## Next Steps

- Understand how the [Product Module](../modules/product-module.md) uses these schemas for CRUD, image uploads, and Typesense synchronisation.
- See how the [Tax Engine](./legal-tax-compliance.md) uses `hsnCode` and `taxProfile`.
- Explore the [Cart Module](../modules/cart-module.md) for dynamic pricing based on live product data.  

---  

*The Reshma-Core Team*  