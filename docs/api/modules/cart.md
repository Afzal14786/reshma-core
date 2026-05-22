<div align="center">

  # Cart Module
  
  **The ACID‑compliant shopping cart – real‑time pricing, stock validation, and seamless guest‑to‑user merge.**

  [![ACID](https://img.shields.io/badge/MongoDB-ACID_Transactions-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Coupons](https://img.shields.io/badge/Coupons-Promotional_Code_Engine-FF6B6B?style=flat)](#)
  [![Rate Limit](https://img.shields.io/badge/Rate_Limit-100/15min-FF6B6B?style=flat)](#)
  [![Merge](https://img.shields.io/badge/Guest_Merge-Seamless-3448C5?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /](#get-)
  - [POST /merge](#post-merge)
  - [POST /add](#post-add)
  - [PATCH /update](#patch-update)
  - [DELETE /item/:productId](#delete-itemproductid)
  - [DELETE /clear](#delete-clear)
  - [POST /coupon/apply](#post-couponapply)
  - [DELETE /coupon/remove](#delete-couponremove)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route : `/api/v1/carts`  


All endpoints are **private** (require a valid access token) and are rate‑limited (100 requests per 15 minutes per IP). The guest cart is managed on the frontend and merged after login.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Fetch the user's current cart with live prices, stock, and coupon application |
| `POST` | `/merge` | Merge a guest cart (from localStorage) into the user's database cart after login |
| `POST` | `/add` | Add an item to the cart (increments quantity if already exists) |
| `PATCH` | `/update` | Override the exact quantity of a specific cart item |
| `DELETE` | `/item/:productId` | Remove a product entirely from the cart |
| `DELETE` | `/clear` | Empty the entire cart (used after successful checkout) |
| `POST` | `/coupon/apply` | Apply a promotional coupon code to the cart |
| `DELETE` | `/coupon/remove` | Remove the currently applied coupon |

> All endpoints are protected by `standardLimiter` and `protect` middleware.

---

## Endpoint Details

### `GET /`

Fetch the current user's cart with populated product details, live prices, stock availability, and applied coupon calculations.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cart retrieved successfully",
  "data": {
    "_id": "64a7b...",
    "user": "...",
    "items": [
      {
        "product": {
          "_id": "...",
          "name": "Bridal Glass Bangle Set",
          "sku": "BAN-001",
          "basePrice": 450,
          "discount": 10,
          "currentStock": 50,
          "images": ["https://res.cloudinary.com/..."]
        },
        "quantity": 2,
        "selectedAttributes": { "size": "M", "color": "Red" }
      }
    ],
    "subtotal": 900,
    "discount": 50,
    "total": 850,
    "appliedCoupon": {
      "code": "DIWALI500",
      "discountValue": 50,
      "discountType": "FLAT"
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

### `POST /merge`  

Merge a guest cart (from frontend localStorage) into the user's database cart after login. Items with the same productId and selectedAttributes are combined (quantities summed). No duplication.  

**Headers:** `Authorization: Bearer <access_token>`  

**Request body:**  

```json
{
  "items": [
    {
      "productId": "64a7b...",
      "quantity": 2,
      "selectedAttributes": { "size": "M" }
    },
    {
      "productId": "64a7c...",
      "quantity": 1,
      "selectedAttributes": {}
    }
  ]
}
```  

**Response (200 OK):** Returns the merged cart (same structure as `GET /`).  

### `POST /add`  

Add an item to the cart. If the same product + selectedAttributes already exist, the quantity is incremented by the requested quantity (not replaced). Validates stock availability before adding.  

**Headers:** `Authorization: Bearer <access_token>`  

**Request body:**  
```json
{
  "productId": "64a7b...",
  "quantity": 1,
  "selectedAttributes": { "size": "M", "color": "Red" }
}
```  

> `quantity` defaults to `1` if not provided.  

**Response (200 OK):** Returns the updated cart.  

**Error cases:**  
- Product not found or inactive → `404 Not Found`
- Insufficient stock → `409 Conflict` with `"Requested quantity exceeds available stock"`  

### `PATCH /update`  

Override the exact quantity of a cart item. If quantity is `0`, the item is removed. If the new quantity exceeds available stock, the request is rejected.  

**Headers:** `Authorization: Bearer <access_token>`  

**Request body:**  
```json
{
  "productId": "64a7b...",
  "quantity": 3,
  "selectedAttributes": { "size": "M" }
}
```  

> `selectedAttributes` must match exactly the attributes of the item you want to update.  

**Response (200 OK):** Returns the updated cart.  

### `DELETE /item/:productId`  

Remove a specific product (with matching attributes) from the cart. If the same product exists with different attributes, only the matching combination is removed.  

**URL Parameter:** `productId` – the product ObjectId.  

**Request body (optional):** You can include `selectedAttributes` to target a specific variant.  

```json
{
  "selectedAttributes": { "size": "M" }
}
```  

If `selectedAttributes` is omitted, all entries of that `productId` are removed.  

**Response (200 OK):** Returns the updated cart.  

### `DELETE /clear`  

Empty the entire cart (remove all items). Typically called after a successful checkout.  
**Headers:** `Authorization: Bearer <access_token>`  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cart cleared successfully",
  "data": { "items": [] },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  

###  `POST /coupon/apply`  

Apply a promotional coupon code to the cart. The coupon is validated against the cart total (`subtotal`), expiration date, usage limits, and product eligibility.  

**Headers:** `Authorization: Bearer <access_token>`  
**Request body:**  

```json
{
  "code": "DIWALI500"
}
```  

**Response (200 OK):** Returns the updated cart with `appliedCoupon` and recalculated `total`.  

**Error cases:**  

- Coupon not found or expired → `404 Not Found`
- Cart subtotal below minCartValue → `400 Bad Request`
- Usage limit exceeded → `409 Conflict`  

### `DELETE /coupon/remove`  

Remove the currently applied coupon from the cart. The cart total reverts to the original subtotal.  

**Headers:** `Authorization: Bearer <access_token>`  

**Response (200 OK):** Returns the cart with `appliedCoupon: null` and `total` reset to `subtotal`.  

---  

## Validation Rules (Zod)  

| Endpoint | Field | Rules |
|----------|-------|-------|
| `/merge` | `items` | array, required |
| | `items[].productId` | valid ObjectId (24 hex chars), required |
| | `items[].quantity` | integer ≥ 1, default 1 |
| | `items[].selectedAttributes` | object, optional |
| `/add` | `productId` | valid ObjectId, required |
| | `quantity` | integer ≥ 1, default 1 |
| | `selectedAttributes` | object of string/number/boolean values, optional |
| `/update` | `productId` | valid ObjectId, required |
| | `quantity` | integer ≥ 0 (0 removes), required |
| | `selectedAttributes` | object, optional (must match existing) |
| `/coupon/apply` | `code` | string, 1‑50 chars, required, trimmed uppercase |  

> All schemas use `.strict()` – extra fields are rejected.  

---  

## Error Responses  

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Quantity must be at least 1"` | Zod validation fails |
| 404 | `NOT_FOUND` | `"Product not found"` | Invalid productId or inactive product |
| 409 | `CONFLICT` | `"Requested quantity exceeds available stock"` | Insufficient stock |
| 409 | `CONFLICT` | `"This coupon has reached its usage limit"` | Coupon max redemptions exceeded |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing or invalid token |  

See [**Error Handling Guide**](../error-codes.md) for full details.  

---  

### Runbook  

For manual testing with Thunder Client / Postman, see `../../testing/cart-runbook.md`. The runbook covers:  

- Adding items with attributes
- Merging guest cart after login
- Updating quantities
- Applying and removing coupons
- Stock validation edge cases  

---  

## Related Documentation  

- [Products Module](./products.md) – product catalog for cart population.
- [Coupons Module](./coupons.md) – coupon creation and management.
- [Orders Module](./orders.md) – checkout flow that consumes the cart.
- [Authentication Guide](../authentication.md) – token requirements.  

--- 

<div align="center">

Atomic, real‑time, and coupon‑ready – the Reshma‑Core shopping cart engine.
</div>  
