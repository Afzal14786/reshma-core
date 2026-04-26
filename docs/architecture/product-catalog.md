<div align="center">

  # Product Catalog Schema Mapping (Phase 2 Blueprint)
  
  **The polymorphic discriminator strategy mapping real‑world bangles, apparel, innerwear, and accessories into strict Mongoose schemas for the Reshma‑Core platform.**

  [![Mongoose](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Schema_Design-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Polymorphic_Models-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 1. Overview
This document maps the real-world business data from the Reshma Bangles & Boutique catalog into strict Mongoose Polymorphic Schemas. The system utilizes a Base Schema for shared e-commerce attributes, and specific Discriminators for category-unique validation.

## 2. Base Schema (`Product`)
Every item in the database, regardless of category, will enforce these fields.

| Database Field | Type | Sourced From (Google Sheet) | Validation / Notes |
| :--- | :--- | :--- | :--- |
| `itemType` | `String` | *Inferred from Category* | **Discriminator Key**: `APPAREL`, `BANGLE`, `INNERWEAR`, `ACCESSORY` |
| `sku` | `String` | `SKU` | Required, Unique, Trimmed. |
| `name` | `String` | `Product Name` | Required. |
| `mainCategory` | `String` | `Main Category` | Enum: `['Sarees', 'Apparel', 'Accessories', 'Innerwear', 'Bangles']` |
| `subCategory` | `String` | `Sub-Category` | String (e.g., "Handloom", "Kurti", "Jewelry"). |
| `material` | `String` | `Material / Fabric` | String. |
| `sellingUnit` | `String` | `Selling Unit` | Enum: `['Single Piece', 'Meter', 'Set', 'Pair', 'Dozen', 'Pack']` |
| `colors` | `[String]` | `Available Colors` | Array of strings. |
| `basePrice` | `Number` | `Base Price (₹)` | Minimum: `0`. |
| `currentStock`| `Number` | `Current Stock` | Minimum: `0`. Drives the `Stock Status`. |
| `weightGrams` | `Number` | `Weight (in Grams)` | Required. Essential for the dynamic shipping math engine. |
| `isFragile` | `Boolean`| `Is Fragile?` | If true, returns require Cloudinary image proof. |
| `images` | `[String]` | *New Field* | Array of Cloudinary URLs. |
| `isActive` | `Boolean`| *New Field* | Soft-delete flag. Default: `true`. |

---

## 3. The Discriminators (Sub-Schemas)

These schemas inherit the Base Schema. They handle the complex variations in sizing and tailoring requirements.

### A. Apparel Discriminator (`itemType: 'APPAREL'`)
*Used for: Sarees, Kurtis, Suits, Lehenga, Fabrics*
| Database Field | Type | Sourced From | Validation / Notes |
| :--- | :--- | :--- | :--- |
| `sizes` | `[String]` | `Available Sizes` | Allowed values: `['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size', '34', '36', '38', '40']` |
| `customTailoring` | `Boolean` | `Custom Tailoring Required?` | If `true`, checkout flow must render the measurement form. |

### B. Bangle Discriminator (`itemType: 'BANGLE'`)
*Used for: Glass Bangles, Metal Bangles*
| Database Field | Type | Sourced From | Validation / Notes |
| :--- | :--- | :--- | :--- |
| `bangleSizes` | `[String]` | `Available Sizes` | Allowed values: `['2.2', '2.4', '2.6', '2.8']` |

### C. Innerwear Discriminator (`itemType: 'INNERWEAR'`)
*Used for: Bras, Panties, Shapewear*
| Database Field | Type | Sourced From | Validation / Notes |
| :--- | :--- | :--- | :--- |
| `cupSizes` | `[String]` | `Available Sizes` | Allowed values: `['32B', '34B', '36C', '34C', '36D']` |
| `isReturnable` | `Boolean` | *Business Logic* | Hardcoded to `false` at the schema level for hygiene policies. |

### D. Accessory Discriminator (`itemType: 'ACCESSORY'`)
*Used for: Jewelry, Bags, Bindis*
| Database Field | Type | Sourced From | Validation / Notes |
| :--- | :--- | :--- | :--- |
| `sizeDetails` | `String` | `Available Sizes` | Usually 'Free Size' or 'Adjustable'. Stored as a flat string. |

---  

**Standard Documentation | Reshma-Core Architecture**