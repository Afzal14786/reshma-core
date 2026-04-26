<div align="center">

  # Product Domain Module
  
  **The polymorphic catalog engine powering CRUD operations, category‑specific validation, and Cloudinary image management for the Reshma‑Core platform.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Atomic_Stock-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Cloudinary](https://img.shields.io/badge/Cloudinary-Image_Pipeline-3448C5?style=flat&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
  [![Zod](https://img.shields.io/badge/Zod-Discriminated_Unions-3068b7?style=flat)](https://zod.dev/)
  [![Mongoose](https://img.shields.io/badge/Mongoose-Polymorphic_Models-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)

</div>

---

## 1. Overview
The Product module is the core catalog engine of Reshma-Core. It is responsible for handling the CRUD operations of our polymorphic inventory, validating complex category-specific payloads, and managing the Cloudinary image pipeline.

**Base Route:** `/api/v1/products`

---

## 2. Controller Architecture & API Endpoints
To avoid massive, unmaintainable files and strictly enforce security boundaries, the presentation layer is split by Actor (Admin vs. Public).

### Public Controller (Customer Facing)
Heavily optimized for read-heavy operations, utilizing MongoDB compound indexes, text search, and `.lean()` execution to strip Mongoose hydration overhead.
* **`GET /`** - Fetch all products. Supports pagination (`?page=1&limit=20`), filtering (`?itemType=BANGLE`), and global text search (`?q=red`).
* **`GET /:id`** - Fetch a single product by ObjectId.

### Admin Controller (Internal Operations)
Requires a valid Two-Token session AND the user must have the `ADMIN` role.
* **`POST /`** - Create a new product. Accepts `multipart/form-data` for image uploads.
* **`PATCH /:id`** - Partially update product details.
* **`DELETE /:id`** - Soft-delete a product (`isActive: false`). *We never hard-delete products to preserve historical order receipts.*

---

## 3. Zod Validation Strategy (Discriminated Unions)

Because the API accepts multiple types of products at the same `POST /` endpoint, the Zod payload firewall must be incredibly smart. Instead of a standard `z.object()`, the Admin DTO utilizes **Zod Discriminated Unions** (`z.discriminatedUnion`). 

**How it works:**
1. Zod inspects the `itemType` string in the incoming `req.body`.
2. If `itemType === 'BANGLE'`, Zod dynamically switches to the Bangle validation rules and guarantees the payload contains `bangleSizes`.
3. If an attacker tries to send `cupSizes` while `itemType === 'BANGLE'`, Zod instantly strips the invalid data and throws a `400 Bad Request`.

---

## 4. Business Logic & Services (`product.service.ts`)

The Service layer isolates the database operations from the HTTP controllers and handles distributed transactions.

**Key Service Methods & Failsafes:**
* **`createProduct`:** 1. Uploads memory buffers to Cloudinary concurrently via `Promise.all`.
  2. Saves the polymorphic document to MongoDB.
  3. **Cloudinary Rollback:** If MongoDB fails (e.g., Duplicate SKU constraint), the service automatically catches the error and deletes the newly uploaded images from Cloudinary to prevent orphaned asset storage bloat.
* **`reserveStock`:** Utilizes MongoDB's atomic `$inc` combined with a `$gte` query firewall. This prevents Race Conditions if multiple users attempt to purchase the final inventory item at the exact same millisecond.  

---  

**Standard Documentation | Reshma-Core Architecture**