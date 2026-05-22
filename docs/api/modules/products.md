<div align="center">

  # Products Module
  
  **The polymorphic product catalog – single collection, multiple types, discriminators, and Cloudinary image pipeline.**

  [![Polymorphic](https://img.shields.io/badge/Mongoose-Discriminators-880000?style=flat&logo=mongoose&logoColor=white)](#)
  [![Cloudinary](https://img.shields.io/badge/Cloudinary-Image_Uploads-3448C5?style=flat&logo=cloudinary&logoColor=white)](#)
  [![Cache](https://img.shields.io/badge/Caching-Redis-47A248?style=flat&logo=redis&logoColor=white)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Polymorphic Types](#polymorphic-types)
- [Endpoint Details](#endpoint-details)
  - [Public Endpoints](#public-endpoints)
    - [GET /](#get-)
    - [GET /:id](#get-id)
  - [Admin Endpoints](#admin-endpoints)
    - [POST /](#post-)
    - [PATCH /:id](#patch-id)
    - [DELETE /:id](#delete-id)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/products`  


Public endpoints are open to all. Admin endpoints require a valid access token with the `ADMIN` role.

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Public | List products with pagination, filtering, and text search |
| `GET` | `/:id` | Public | Fetch a single product by ID (populates all polymorphic fields) |
| `POST` | `/` | Admin (Bearer) | Create a new product (multipart/form-data with images) |
| `PATCH` | `/:id` | Admin (Bearer) | Update product details (text fields only) |
| `DELETE` | `/:id` | Admin (Bearer) | Soft‑delete a product (sets `isActive: false`) |

> Rate limits: `standardLimiter` (100/15min) on all endpoints.

---

## Polymorphic Types

Products are stored in a single MongoDB collection using Mongoose discriminators. Each type has required fields:

| `itemType` | Required Fields (in addition to base) |
|------------|----------------------------------------|
| `BANGLE` | `bangleSizes` (number[]), `packSize` (number), `material`, `weightGrams`, `isFragile` |
| `APPAREL` | `sizes` (string[]), `fabric`, `washingCare` (string), `gender` |
| `FABRIC` | `lengthMeters` (number), `widthCm` (number), `fabricType`, `pattern` |
| `INNERWEAR` | `sizes` (string[]), `fabric`, `packSize` (number) |
| `ACCESSORY` | `material`, `weightGrams`, `isFragile` (boolean), `dimensions` (object) |

All types share base fields: `name`, `sku`, `description`, `mainCategory`, `subCategory`, `basePrice`, `currentStock`, `images`, `isActive`, `tags`.

---

## Endpoint Details

### Public Endpoints

#### `GET /`

List all active products with pagination, filtering, and text search (MongoDB text index on `name`, `description`, `tags`).

**Query parameters (optional):**

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | `1` | – | Page number (1‑based) |
| `limit` | integer | `20` | `100` | Items per page |
| `q` | string | – | – | Text search query (searches name, description, tags) |
| `itemType` | string | – | – | Filter by product type (`BANGLE`, `APPAREL`, etc.) |
| `mainCategory` | string | – | – | Filter by main category |
| `minPrice` | number | – | – | Minimum base price |
| `maxPrice` | number | – | – | Maximum base price |
| `sortBy` | string | `createdAt:desc` | – | `basePrice:asc`, `basePrice:desc`, `createdAt:desc` |

**Example request:**

```text
GET /api/v1/products?page=2&limit=15&itemType=BANGLE&minPrice=500&sortBy=basePrice:asc
```  

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "_id": "64a7b...",
        "itemType": "BANGLE",
        "sku": "BAN-001",
        "name": "Bridal Glass Bangle Set",
        "mainCategory": "Bangles",
        "subCategory": "Glass Bangles",
        "basePrice": 450,
        "discount": 10,
        "currentStock": 50,
        "images": ["https://res.cloudinary.com/..."],
        "bangleSizes": [2.4, 2.6],
        "packSize": 12,
        "isActive": true
      }
    ],
    "meta": {
      "total": 500,
      "limit": 15,
      "page": 2
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

> The response includes type‑specific fields only for the corresponding `itemType`.  

### `GET /:id`

Fetch a single product by its MongoDB ObjectId. Returns all fields (including polymorphic ones).

**URL Parameter:**  
- `id` – valid 24‑hex ObjectId.

**Response (200 OK):** Same shape as product object in the list.

**Error (404):** `"Product not found"` (if ID invalid or product soft‑deleted).  

## Admin Endpoints

### `POST /`

Create a new product. Requires `multipart/form-data` with at least one image. The request is validated against the polymorphic schema based on `itemType`.

**Headers:**  
- `Authorization: Bearer <admin_access_token>`
- `Content-Type: multipart/form-data`

**Form fields (text):**

| Field | Required | Example |
|-------|----------|---------|
| `itemType` | Yes | `BANGLE` |
| `sku` | Yes | `BAN-001` |
| `name` | Yes | `Bridal Glass Bangle Set` |
| `description` | Yes | `Beautiful red glass bangles...` |
| `mainCategory` | Yes | `Bangles` |
| `subCategory` | Yes | `Glass Bangles` |
| `basePrice` | Yes | `450` |
| `currentStock` | Yes | `50` |
| ... plus type‑specific fields (see validation table) | | |

**File field:**  
- `images` – array of images (max 5 files, each ≤ 10MB).  

**Response (201 Created):**  

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "_id": "64a7b...",
    "sku": "BAN-001",
    "name": "Bridal Glass Bangle Set",
    "images": ["https://res.cloudinary.com/..."]
  },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  

> Images are uploaded to Cloudinary, converted to WebP, and stored as URLs.  

### `PATCH /:id`

Update product text fields (cannot update images via this endpoint – separate endpoint exists for appending images). All fields are optional.

**Headers:**  - `Authorization: Bearer <admin_access_token>`  
**Content-Type:** `application/json`  

**Request body (JSON):**  

```json
{
  "basePrice": 499,
  "currentStock": 45
}
```  

**Response (200 OK):** Returns the updated product.  

### `DELETE /:id`

Soft‑delete a product – sets `isActive: false`. The product remains in the database for order history but is hidden from public endpoints.

**Headers:**  
`Authorization: Bearer <admin_access_token>`  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Product successfully removed from catalog",
  "data": null,
  "timestamp": "2026-05-22T10:40:00.000Z"
}
```  

> To permanently delete, a separate admin script is required (not exposed via API).  

---  

## Validation Rules (Zod)

### Base validation for all products

| Field | Rules |
|-------|-------|
| `sku` | string, 3‑50 chars, unique |
| `name` | string, 3‑150 chars |
| `description` | string, 10‑2000 chars |
| `mainCategory` | string, required |
| `subCategory` | string, required |
| `basePrice` | number ≥ 0 |
| `currentStock` | integer ≥ 0 |
| `images` | array of URLs (auto‑generated) |

### Type‑specific required fields (examples)

| `itemType` | Additional required fields |
|------------|---------------------------|
| `BANGLE` | `bangleSizes` (array of numbers), `packSize` (integer), `material`, `weightGrams`, `isFragile` |
| `APPAREL` | `sizes` (array of strings: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`), `fabric`, `washingCare`, `gender` |

> All schemas use `.strict()` – extra fields for the given `itemType` are rejected.  

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Validation Failed: bangleSizes: Required for BANGLE type"` | Missing polymorphic required field |
| 400 | `BAD_REQUEST` | `"Image file is required"` | No image in POST request |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing/invalid token on admin route |
| 403 | `FORBIDDEN` | `"You do not have permission to perform this action"` | Non‑admin user tries admin endpoint |
| 404 | `NOT_FOUND` | `"Product not found"` | Invalid ID or soft‑deleted product |
| 409 | `CONFLICT` | `"Product with this SKU already exists"` | Duplicate SKU on creation |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |  

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/product-runbook.md`. The runbook covers:

- Creating a Bangle product with image upload (multipart/form-data)
- Fetching catalog with filters
- Updating inventory and price
- Soft‑deleting a product
- Edge cases: wrong polymorphic fields, duplicate SKU, file size limits

---  

## Related Documentation

- [Search Module](./search.md) – product search via Typesense (sync on product changes).
- [Cart Module](./cart.md) – cart adds products.
- [Orders Module](./orders.md) – order items reference products (price snapshots).
- [Authentication Guide](../authentication.md) – admin token requirements.
- [Error Handling Guide](../error-codes.md) – 409 conflict handling.  

---  

<div align="center">

One collection, infinite types – the Reshma‑Core polymorphic product engine.
</div>  
