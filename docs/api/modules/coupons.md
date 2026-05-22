<div align="center">

  # Coupons Module
  
  **The promotional engine – create, validate, and apply discounts with strict business rules.**

  [![Coupons](https://img.shields.io/badge/Discounts-Flat_&_Percentage-FF6B6B?style=flat)](#)
  [![Admin](https://img.shields.io/badge/RBAC-Admin_Only-3448C5?style=flat)](#)
  [![Validation](https://img.shields.io/badge/Validation-Zod-3068b7?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [Admin Endpoints](#admin-endpoints)
    - [POST /](#post-)
    - [PATCH /:id](#patch-id)
    - [GET /](#get-)
  - [Public Endpoints](#public-endpoints)
    - [GET /available](#get-available)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  : `/api/v1/coupons`  


All endpoints require authentication. Admin endpoints (`POST /`, `PATCH /:id`, `GET /`) are restricted to `ADMIN` role. The public endpoint `/available` is accessible to any authenticated user (`USER` or `ADMIN`).

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/` | Admin | Create a new coupon |
| `PATCH` | `/:id` | Admin | Update an existing coupon (toggle `isActive`, change limits, etc.) |
| `GET` | `/` | Admin | Fetch all coupons with pagination and filtering |
| `GET` | `/available` | Authenticated User | Fetch coupons that are active, not expired, and valid for the current cart value |

> Rate limits: `standardLimiter` applies (100 requests per 15 minutes per IP). No specific coupon limiter.

---

## Endpoint Details

### Admin Endpoints

#### `POST /`

Create a new promotional coupon.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Request body:**

```json
{
  "code": "DIWALI500",
  "discountType": "FLAT",
  "discountValue": 500,
  "minCartValue": 2500,
  "startDate": "2026-05-01T00:00:00.000Z",
  "expiryDate": "2026-12-31T23:59:59.000Z",
  "usageLimit": 100
}
```  

**Discount types:**  

- `FLAT` – fixed amount off (e.g., ₹500 off)
- `PERCENTAGE` – percentage off (max 100%)  

**Response (201 Created):**  

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Coupon created successfully",
  "data": {
    "_id": "...",
    "code": "DIWALI500",
    "discountType": "FLAT",
    "discountValue": 500,
    "minCartValue": 2500,
    "startDate": "2026-05-01T00:00:00.000Z",
    "expiryDate": "2026-12-31T23:59:59.000Z",
    "usageLimit": 100,
    "usedCount": 0,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

#### `PATCH /:id`  

Update an existing coupon. All fields are optional. Useful for:  
- Changing the discount value or minimum cart value.
- Extending the expiry date.
- Disabling a coupon (`isActive: false`) without deleting it.
- Increasing the `usageLimit`.  

**Headers:** `Authorization: Bearer <admin_access_token>`  
**URL Parameter:** `id` – coupon ObjectId  

**Request body (partial):**  

```json
{
  "discountValue": 600,
  "expiryDate": "2027-01-31T23:59:59.000Z",
  "isActive": false
}
```  

**Response (200 OK):** Returns the updated coupon.  

> To reactivate a coupon, set `isActive: true`. Expired coupons (`expiryDate` in the past) cannot be reactivated unless the date is also updated.  

#### `GET /`  

Fetch all coupons with pagination and optional filtering (by `isActive`, `discountType`, etc.). Admin dashboard use only.  

**Headers:** `Authorization: Bearer <admin_access_token>`  
**Query parameters (optional):**  

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |
| `isActive` | boolean | – | Filter by active/inactive |
| `discountType` | string | – | `FLAT` or `PERCENTAGE` |

**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Coupons fetched successfully",
  "data": {
    "coupons": [ ... ],
    "meta": {
      "total": 50,
      "limit": 20,
      "page": 1
    }
  },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  

---  

### Public Endpoint  

#### `GET /available`

Fetch coupons that are active, not expired, and valid for the current cart value. The frontend uses this to show available discounts before the user applies a code.

**Headers:** `Authorization: Bearer <user_access_token>`

**Query parameter:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `cartValue` | number | Yes | The current cart subtotal (used to filter by `minCartValue`) |  

**Example request:**  

```text
GET /api/v1/coupons/available?cartValue=3000
```  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Available coupons retrieved",
  "data": {
    "coupons": [
      {
        "_id": "...",
        "code": "DIWALI500",
        "discountType": "FLAT",
        "discountValue": 500,
        "minCartValue": 2500,
        "expiryDate": "2026-12-31T23:59:59.000Z"
      },
      {
        "_id": "...",
        "code": "SUMMER10",
        "discountType": "PERCENTAGE",
        "discountValue": 10,
        "minCartValue": 1000,
        "expiryDate": "2026-08-31T23:59:59.000Z"
      }
    ]
  },
  "timestamp": "2026-05-22T10:40:00.000Z"
}
```  

> Only coupons with `isActive: true`, `expiryDate` in the future, and `minCartValue ≤ cartValue` are returned.  

---  

### Validation Rules (Zod)

| Endpoint | Field | Rules |
|----------|-------|-------|
| `POST /` | `code` | string, 1‑50 chars, uppercase alphanumeric + underscore, required |
| | `discountType` | enum `["FLAT", "PERCENTAGE"]`, required |
| | `discountValue` | number > 0, required. For `PERCENTAGE`: ≤ 100 |
| | `minCartValue` | number ≥ 0, default 0 |
| | `startDate` | ISO 8601 datetime, required |
| | `expiryDate` | ISO 8601 datetime, must be after `startDate`, required |
| | `usageLimit` | integer ≥ 1, optional (default `null` = unlimited) |
| `PATCH /:id` | All fields optional, same rules as above | |
| `GET /available` | `cartValue` | number ≥ 0, required (coerced from query string) |

> All schemas use `.strict()` – extra fields are rejected.  

--- 

### Error Response 

| Status | Code | Example `message` | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"discountValue for PERCENTAGE cannot exceed 100"` | Validation fails |
| 400 | `BAD_REQUEST` | `"expiryDate must be after startDate"` | Date logic error |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing or invalid token |
| 403 | `FORBIDDEN` | `"You do not have permission to perform this action"` | Non‑admin tries admin endpoint |
| 404 | `NOT_FOUND` | `"Coupon not found"` | Invalid coupon ID in `PATCH /:id` |
| 409 | `CONFLICT` | `"Coupon code already exists"` | Duplicate code on creation |
| 409 | `CONFLICT` | `"This coupon has expired"` | Applying expired coupon to cart |  

---  

### Runbook  

For manual testing with Thunder Client / Postman, see `../../testing/coupon-runbook.md`. The runbook covers:  

- Admin creating flat and percentage coupons
- Public `GET /available` filtering by cart value
- Applying coupons to cart (via cart module)
- Edge cases: expired coupons, usage limits, min cart value  

---  

### Related Documentation  

- [Cart Module](./cart.md) – coupon application endpoints (`/cart/coupon/apply` and `/cart/coupon/remove`).
- [Error Handling Guide](../error-codes.md) – status codes.
- [Authentication Guide](../authentication.md) – admin vs user tokens.

---  

<div align="center">

Flexible discounts, strict limits – the Reshma‑Core coupon engine.
</div>  