<div align="center">

  # Wishlist Module
  
  **The read‑optimized, concurrency‑safe sandbox for deferred purchase intent and customer retention.**

  [![Atomic](https://img.shields.io/badge/Atomic-$push_&_$pull-47A248?style=flat)](#)
  [![Self-Healing](https://img.shields.io/badge/Self_Healing-Ghost_Item_Purge-FF6B6B?style=flat)](#)
  [![Capacity](https://img.shields.io/badge/Capacity-100_Items_Limit-3448C5?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /](#get-)
  - [POST /add](#post-add)
  - [POST /move-to-cart/:productId](#post-move-to-cartproductid)
  - [DELETE /item/:productId](#delete-itemproductid)
  - [DELETE /clear](#delete-clear)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/wishlists`  

All endpoints are **private** (require a valid access token) and are rate‑limited (100 requests per 15 minutes per IP). The `protect` middleware guarantees a valid JWT.

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Private | Fetch the user's wishlist (self‑healing – removes ghost products) |
| `POST` | `/add` | Private | Add a product to the wishlist (enforces 100‑item capacity limit) |
| `POST` | `/move-to-cart/:productId` | Private | Transfer item to cart (atomic cross‑module) |
| `DELETE` | `/item/:productId` | Private | Remove a specific product from the wishlist |
| `DELETE` | `/clear` | Private | Empty the entire wishlist |

---

## Endpoint Details

### `GET /`

Fetch the user's wishlist with live product data populated from the catalog. The endpoint **self‑heals** – if any product in the wishlist is inactive, deleted, or out of stock, it is silently removed.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Wishlist retrieved successfully",
  "data": {
    "items": [
      {
        "product": {
          "_id": "64a7b...",
          "name": "Bridal Glass Bangle Set",
          "sku": "BAN-001",
          "basePrice": 450,
          "discount": 10,
          "currentStock": 50,
          "images": ["https://res.cloudinary.com/..."],
          "isActive": true
        },
        "addedAt": "2026-05-20T10:00:00.000Z"
      }
    ]
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

> If the wishlist does not exist (new user), the API returns `{ "items": [] }`.  

**Self‑healing behaviour:**  
- For each item, the product is populated.
- If the product is `null`, `isActive: false`, or `currentStock === 0`, it is considered a "ghost".
- Ghost items are removed from the wishlist atomically using `$pull`.
- The user receives only valid items – no action required.  

### `POST /add`

Add a product to the wishlist. If the product already exists, the request is idempotent (no duplicate). Capacity is limited to 100 items.

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`  

**Request body:**  
```json
{
  "productId": "64a7b..."
}
```    

**Response (200 OK):**  Returns the updated wishlist (same shape as `GET /`).  

**Business rules:**  
- Product must exist and be active (`isActive: true`).
- If wishlist does not exist, it is **lazily initialised**.
- Duplicate products are silently ignored (no error).
- Capacity limit: 100 items maximum.  

> The endpoint uses atomic `updateOne` with `$push` and a query guard `"items.product": { $ne: productId }` to prevent duplicates even under concurrent requests.  


### `POST /move-to-cart/:productId`

Transfer an item from the wishlist to the cart. This is an atomic cross‑module operation:

1. Verifies the item exists in the wishlist.
2. Calls `CartService.addItem` (which handles stock validation, ACID transaction, and coupon recalculation).
3. If cart addition succeeds, removes the item from the wishlist using `$pull`.
4. If cart addition fails (e.g., out of stock), the wishlist is unchanged.

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`  

**URL Parameter:**  
- `productId` – valid MongoDB ObjectId of the product.  

**Request body:**  
```json
{
  "quantity": 2,
  "selectedAttributes": {
    "size": "M",
    "color": "Red"
  }
}
```  

> `quantity` defaults to `1` if not provided. `selectedAttributes` is optional but recommended if the product has variants.  

**Response (200 OK):** Returns the updated wishlist (after removal).  


### `DELETE /item/:productId`

Remove a specific product from the wishlist. If the same product exists multiple times (should not happen due to idempotency), all are removed.

**Headers:** `Authorization: Bearer <access_token>`  
**URL Parameter:**  
- `productId` – valid MongoDB ObjectId.

**Response (200 OK):** Returns the updated wishlist.  


### `DELETE /clear`

Empty the entire wishlist. Removes all items at once.

**Headers:** `Authorization: Bearer <access_token>`  

**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Wishlist cleared successfully",
  "data": null,
  "timestamp": "2026-05-22T10:45:00.000Z"
}
```  

---  

## Validation Rules (Zod)

| Endpoint | Field | Rules |
|----------|-------|-------|
| `POST /add` | `productId` | valid 24‑hex ObjectId, required |
| `POST /move-to-cart/:productId` | `productId` (params) | valid ObjectId, required |
| | `quantity` | integer ≥ 1, default 1 |
| | `selectedAttributes` | object of string/number/boolean values, optional |
| `DELETE /item/:productId` | `productId` (params) | valid ObjectId, required |

> All schemas use `.strict()` – extra fields are rejected.
>
> **ObjectId validator regex:** `/^[0-9a-fA-F]{24}$/` – prevents NoSQL injection.  

---  

## Validation Rules (Zod)

| Endpoint | Field | Rules |
|----------|-------|-------|
| `POST /add` | `productId` | valid 24‑hex ObjectId, required |
| `POST /move-to-cart/:productId` | `productId` (params) | valid ObjectId, required |
| | `quantity` | integer ≥ 1, default 1 |
| | `selectedAttributes` | object of string/number/boolean values, optional |
| `DELETE /item/:productId` | `productId` (params) | valid ObjectId, required |

> All schemas use `.strict()` – extra fields are rejected.
>
> ObjectId validator regex: `/^[0-9a-fA-F]{24}$/` – prevents NoSQL injection.

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Wishlist capacity limit (100) reached"` | Adding 101st item |
| 400 | `BAD_REQUEST` | `"Invalid Product ID format. Must be a 24‑character Hex string."` | Zod validation fails |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing/invalid token |
| 404 | `NOT_FOUND` | `"Product not found or currently inactive"` | Adding non‑existent product |
| 404 | `NOT_FOUND` | `"Wishlist not found"` | User has no wishlist (rare, but possible) |
| 404 | `NOT_FOUND` | `"This item is no longer in your wishlist"` | Move‑to‑cart on already removed item |
| 409 | `CONFLICT` | `"Requested quantity exceeds available stock"` | Cart addition fails |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/wishlist-runbook.md`. The runbook covers:

- Fetching empty wishlist (lazy initialisation)
- Adding items (idempotency test)
- Self‑healing: deleting a product from the catalog and seeing it vanish from wishlist
- Moving item to cart (with selectedAttributes)
- Removing specific item
- Clearing entire wishlist
- Capacity limit test (100 items)

---  

## Related Documentation

- [Cart Module](./cart.md) – cart service used by `move-to-cart`.
- [Products Module](./products.md) – product catalog and `isActive` flag.
- [Users Module](./users.md) – account deletion triggers `deleteUserWishlist`.
- [Authentication Guide](../authentication.md) – token requirements.
- [Error Handling Guide](../error-codes.md) – 409 conflict handling.  

---  

<div align="center">

Atomic, self‑healing, and concurrency‑safe – the Reshma‑Core wishlist engine.
</div>  
