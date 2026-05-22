<div align="center">

  # Database Design & Polymorphic Catalog
  
  **The scalable NoSQL data modeling strategy for the diverse Reshma-Core inventory.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Mongoose](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](#)

</div>

---

## 1. The Polymorphic Strategy (Single Collection)

In a traditional SQL database, handling completely different item types (like Glass Bangles versus Unstitched Fabrics) requires complex JOIN tables or the Entity-Attribute-Value pattern. Both approaches severely degrade read performance as the catalog grows.

Reshma-Core utilizes **Mongoose Discriminators**, a polymorphic NoSQL pattern. All products, regardless of category, live inside one single `products` collection. This allows global text searches, universal pagination, and unified category filtering to operate in milliseconds.

At the application layer, Mongoose enforces unique validation schemas based on the `itemType` discriminator key. The database will physically reject a query if an Apparel item attempts to save a Bangle‑specific property.

---

## 1.1 Architecture Decision Record: Why Polymorphism?

Before settling on Mongoose Discriminators, we evaluated two other common e‑commerce database patterns.

**Rejected Alternative 1: Multiple Collections**
- **Idea:** Create a separate collection for each category (`Apparel`, `Bangles`, `Fabrics`).
- **Why it fails:** A customer search for the colour "Red" would require querying multiple collections, merging pagination in Node.js memory – slow and non‑scalable.

**Rejected Alternative 2: The EAV Pattern (Entity‑Attribute‑Value)**
- **Idea:** Store custom fields in a generic array (`attributes: [{ key: 'size', value: 'XL' }]`).
- **Why it fails:** No type safety; the database cannot prevent storing a bangle size on a saree. Indexing dynamic keys is inefficient.

**The Winning Solution: Single Collection Polymorphism**
- **How it works:** All items live in one collection, discriminated by `itemType`. Mongoose applies the correct sub‑schema at the application layer.
- **Benefits:** Lightning‑fast global searches, strict per‑type validation, easy addition of new types without schema changes.

---

## 2. Base Product Schema

Every product – regardless of type – includes these fields. They are defined in `base-product.model.ts` and `base-product.interface.ts`.

| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `itemType` | String (enum) | Required | Discriminator key: `"BANGLE"`, `"APPAREL"`, `"FABRIC"`, `"INNERWEAR"`, `"ACCESSORY"` |
| `sku` | String | Required, unique, uppercase, trimmed | Stock Keeping Unit (warehouse barcode). |
| `name` | String | Required, trimmed | Display title. |
| `mainCategory` | String (enum) | Required | One of: `Sarees`, `Apparel`, `Accessories`, `Innerwear`, `Bangles` |
| `subCategory` | String | Required, trimmed | e.g., “Handloom”, “Kurti”, “Glass Bangles” |
| `material` | String | Required, trimmed | Material composition. |
| `sellingUnit` | String (enum) | Required | `Single Piece`, `Meter`, `Set`, `Pair`, `Dozen`, `Pack` |
| `colors` | String[] | Optional, default `[]` | Array of colour names. |
| `basePrice` | Number | Required, min 0 | Raw price before discount and taxes. |
| `discount` | Number | Default 0, min 0, max 100 | Percentage discount. |
| `currentStock` | Number | Required, min 0 | Current inventory level. |
| `weightGrams` | Number | Required, min 0 | Physical weight – used for shipping calculations. |
| `isFragile` | Boolean | Required | If `true`, returns require photographic evidence. |
| `images` | String[] | Required, min 1 | Cloudinary URLs (auto‑cleaned on delete). |
| `hsnCode` | String | Required, 4‑8 digits | HSN code for Indian GST. |
| `taxProfile` | String (enum) | Required | One of the `TaxProfile` values (e.g., `IMITATION_JEWELLERY`, `STITCHED_APPAREL`). |
| `ratingsMetadata` | Object | Auto‑managed | Aggregated reviews: `averageRating`, `totalReviews`, `ratingDistribution` (1‑5 stars). |
| `tags` | String[] | Optional, default `[]` | Search keywords. |
| `isActive` | Boolean | Default `true` | Soft‑delete flag – never hard‑delete products to preserve historical orders. |
| `createdAt` / `updatedAt` | Date | Auto | Timestamps. |

> **Note:** The `description` field is **not** part of the base interface (it is present in the seeding script but not enforced in the model). Product descriptions are handled via a separate `details` field or not stored in the database.

---

## 3. Discriminator Sub‑Schemas

Each product type adds its own fields. These are defined in separate model files (e.g., `bangle.model.ts`, `apparel.model.ts`) and inherit the base schema.

### 3.1 Bangle Schema (`itemType: "BANGLE"`)

**Used for:** Glass, metal, lac bangles.

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `bangleSizes` | String[] | Required, at least one, enum: `"2.2"`, `"2.4"`, `"2.6"`, `"2.8"` | Traditional Indian bangle diameters. |
| `packSize` | Number | Default 12, min 1 | Often sold by the dozen. |

**Example (from `bangle.model.ts`):**
```typescript
bangleSizes: { type: [String], required: true, enum: ["2.2","2.4","2.6","2.8"] },
packSize: { type: Number, default: 12, min: 1 }
```  

### 3.2 Apparel Schema (`itemType: "APPAREL"`)

**Used for:** Sarees, kurtis, suits, lehengas, readymade garments.

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `sizes` | `String[]` | Required, at least one, enum: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`, `"XXL"`, `"Free Size"`, `"34"`, `"36"`, `"38"`, `"40"` | Supports both letter and numeric sizes. |
| `customTailoring` | `Boolean` | Default `false` | If true, checkout collects custom measurements. |
| `careInstructions` | `String` | Optional, trimmed | Wash care details. |  

### 3.3 Fabric Schema (`itemType: "FABRIC"`)

**Used for:** Unstitched fabric sold by length.

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `lengthMeters` | `Number` | Required, min 0.1 | Length in metres. |
| `customTailoring` | `Boolean` | Default `true` | Unstitched fabric usually requires tailoring. |

---

### 3.4 Innerwear Schema (`itemType: "INNERWEAR"`)

**Used for:** Bras, panties, shapewear.  
**Hygiene policy:** Non‑returnable – enforced at schema level.

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `cupSizes` | `String[]` | Required, at least one, enum: `"32B"`, `"34B"`, `"36C"`, `"34C"`, `"36D"` | Common Indian bra sizes. |
| `isReturnable` | `Boolean` | Forced `false` (`set: () => false`) | Cannot be overridden. |

---

### 3.5 Accessory Schema (`itemType: "ACCESSORY"`)

**Used for:** Jewellery, bags, bindis, hair accessories.

| Field | Type | Rules | Notes |
|-------|------|-------|-------|
| `sizeDetails` | `String` | Required, trimmed | Free‑text size description (e.g., “Adjustable”, “One Size”). |  

---  

## 4. Indexing & Performance Strategy

To ensure the catalog scales to tens of thousands of items, the following indexes are created at the MongoDB layer (see `base-product.model.ts`):  

```javascript
// Text search index – global search bar (name, tags, subCategory)
BaseProductSchema.index({ name: "text", tags: "text", subCategory: "text" });

// Compound index for filtered listing – active → type → category → newest
BaseProductSchema.index({
  isActive: 1,
  itemType: 1,
  mainCategory: 1,
  createdAt: -1,
});

// Unique index on SKU – prevents duplicate warehouse identifiers
BaseProductSchema.index({ sku: 1 }, { unique: true });
```  
- The **text index** enables fast keyword searches without an external search engine (though Typesense is also used for typo‑tolerant search).
- The **compound index** covers common queries like “show all active bangles, newest first” and prevents full collection scans.
- The **unique index on SKU** acts as a database‑level firewall.

---  

## 5. Automatic Cloudinary Cleanup

When a product is **hard‑deleted** (using `findOneAndDelete`), a Mongoose `pre('findOneAndDelete')` hook runs. It retrieves the document, extracts the `images` array, and calls `deleteFromCloudinary()` for each URL. This prevents orphaned images from incurring costs.

> **Soft deletion** (`isActive = false`) does **not** delete images – the product remains in the database for historical order integrity.  

---  

## 6. Zod Validation (Admin DTO)

The `CreateProductSchema` in `product.admin.dto.ts` uses a **Zod discriminated union** to enforce the correct fields based on `itemType`. For example:  

```typescript
const BangleSchema = BaseProductSchema.extend({
  itemType: z.literal("BANGLE"),
  bangleSizes: z.array(z.enum(["2.2","2.4","2.6","2.8"])).min(1),
  packSize: z.number().int().min(1).default(12),
});
```  

If an admin tries to create a bangle with `cupSizes` (an innerwear field), Zod rejects the request with `400 Bad Request`. This is the **first firewall** before the database.  

---  

## 7. Related Files

| File | Purpose |
|------|---------|
| `src/modules/products/interfaces/base-product.interface.ts` | TypeScript interface for base product. |
| `src/modules/products/models/base-product.model.ts` | Mongoose schema, indexes, pre‑delete hook. |
| `src/modules/products/interfaces/*.ts` | Discriminator interfaces. |
| `src/modules/products/models/*.model.ts` | Discriminator models. |
| `src/modules/products/dtos/product.admin.dto.ts` | Zod validation for admin creation/update. |
| `src/modules/orders/tax.utils.ts` | TaxProfile enum. |  

---  

## Next Steps

- Explore the [Product Catalog Schema](./product-catalog.md) for detailed field‑by‑field mapping and examples.
- Understand the [Product Module](../modules/product-module.md) for CRUD operations and Cloudinary integration.
- See the [Tax Engine](./legal-tax-compliance.md) for how `hsnCode` and `taxProfile` are used.  

---  

*The Reshma-Core Team*