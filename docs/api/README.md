<img src="../../src/assets/banner.png" alt="Reshma Bangles & Boutique - API Core" style="width: 100%; display: block; margin: 0;" />

<br/>  

<div align="center">

  # Reshma‑Core API Reference
  
  **The enterprise REST API powering the Reshma Bangles & Boutique e‑commerce platform.**

  [![API Version](https://img.shields.io/badge/API_Version-v1-3448C5?style=flat&logo=server&logoColor=white)](#)
  [![Format](https://img.shields.io/badge/Format-JSON-000000?style=flat&logo=json&logoColor=white)](#)
  [![Auth](https://img.shields.io/badge/Auth-Two_Token_JWT-DC382D?style=flat)](#)
  [![Rate Limit](https://img.shields.io/badge/Rate_Limit-100/15min-FF6B6B?style=flat)](#)
  [![Validation](https://img.shields.io/badge/Validation-Zod-3068b7?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base URLs](#base-urls)
- [Standard Response Shapes](#standard-response-shapes)
- [Authentication Summary](#authentication-summary)
- [Common Headers](#common-headers)
- [Pagination](#pagination)
- [Rate Limiting](#rate-limiting)
- [Module Endpoints](#module-endpoints)
- [Error Handling](#error-handling)
- [Testing Runbooks](#testing-runbooks)

---

## Base URLs

| Environment | Base URL | Usage |
| :--- | :--- | :--- |
| **Development** | `http://localhost:5000/api/v1` | Local testing & frontend integration |
| **Production** | `https://api.reshmabangles.com/api/v1` | Live customer traffic |

> All endpoints are versioned under `/api/v1`. Future breaking changes will introduce `/api/v2`.

---

## Standard Response Shapes

Every API response follows a consistent JSON structure – no exceptions.

### ✅ Success Response (2xx)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Catalog retrieved successfully",
  "data": { ... },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` for successful requests |
| `statusCode` | `number` | HTTP status code (200, 201, 204, etc.) |
| `message` | `string` | Human‑readable summary |
| `data` | `object` / `array` / `null` | The actual payload (can be `null` for 204) |
| `timestamp` | `string` (ISO 8601) | Server time when the response was generated |  

### ❌ Error Response (4xx / 5xx)  

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed: email: Invalid email format, password: Password too weak",
  "data": null,
  "timestamp": "2026-05-22T10:30:05.000Z",
  "stack": "..."   // ONLY included when NODE_ENV=development
}
```  

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `false` for errors |
| `statusCode` | `number` | HTTP status code (400, 401, 403, etc.) |
| `message` | `string` | Frontend‑friendly error description |
| `data` | `null` | Always `null` for errors |
| `stack` | `string` | Development only – never shown in production |

> **Frontend tip:** Use `response.data.success` to determine success/failure. Do not rely solely on HTTP status codes.  

---  

## Authentication Summary  

Most endpoints require a **Bearer token** (Access Token).  
The token is obtained after login or OTP verification.  

**Header:**  
```text
Authorization: Bearer <your_access_token>
```  

**Refresh token** is stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie – you never need to read or send it manually.  
| Token | Storage | Lifetime | Purpose |
|-------|---------|----------|---------|
| Access Token | React memory (Zustand/Context) | 15 minutes (`JWT_ACCESS_EXPIRES_IN`) | Authorise API requests |
| Refresh Token | HttpOnly cookie (invisible to JS) | 7 days (`JWT_REFRESH_EXPIRES_IN`) | Obtain new access tokens without re‑entering credentials |  

For the complete flow (registration, login, refresh, logout), see the [**Authentication Guide**](./authentication.md).  

---  

## Common Headers  

| Header | Required for | Example |
|--------|--------------|---------|
| `Authorization` | All protected endpoints | `Bearer eyJhbGciOiJIUzI1...` |
| `Content-Type` | `POST`/`PUT`/`PATCH` with JSON | `application/json` |
| `x-api-key` | Shiprocket webhook only | `your_webhook_secret` |  

---  

## Pagination  

Endpoints that return lists support pagination via query parameters:  

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | `1` | – | Page number (1‑based) |
| `limit` | integer | `10` – `20` | `100` | Items per page (capped to 100) |  

**Response includes a `meta` object:**  

```json
"meta": {
  "total": 500,
  "limit": 20,
  "skip": 0,
  "page": 1
}
```  

**Example request:**  
```text
GET /api/v1/products?page=2&limit=15
```  

---  

## Rate Limiting  

All endpoints are protected to prevent abuse and DoS attacks.  

| Scope | Limit | Per |
|-------|-------|-----|
| Global (all endpoints) | 100 requests | 15 minutes |
| Auth endpoints (`/auth/*`) | 10 requests | 15 minutes |
| Checkout (`/orders/checkout`) | 5 requests | 15 minutes |
| Health (`/health`) | 3000 requests | 15 minutes (for load balancers) |

> Exceeding a limit returns `429 Too Many Requests` with a `Retry-After` header.  
> See [**Rate Limiting Details**](./rate-limiting.md).  

---  

## Module Endpoints  

Click on any module to see full endpoint documentation:  

| Module | Base Route | Description |
|--------|------------|-------------|
| [Auth](./modules/auth.md) | `/auth` | Registration, login, OTP, logout, token refresh |
| [Users](./modules/users.md) | `/users` | Profile, address book, avatar, password change, account deletion, data export |
| [Products](./modules/products.md) | `/products` | Public catalog & admin CRUD (polymorphic discriminators) |
| [Cart](./modules/cart.md) | `/carts` | Get, add, update, merge, clear, coupon apply/remove |
| [Orders](./modules/orders.md) | `/orders` | Checkout, payment verification, invoice, admin dispatch & status |
| [Returns](./modules/returns.md) | `/returns` | Initiate return, admin arbitration, refund & restock |
| [Interactions](./modules/interactions.md) | `/interactions` | Reviews & comments, voting (like/dislike) |
| [Coupons](./modules/coupons.md) | `/coupons` | Admin create/update, public available coupons |
| [Wishlist](./modules/wishlist.md) | `/wishlists` | Add, move to cart, remove, clear, self‑healing read |
| [Search] | `/search` | Typo‑tolerant, faceted search via Typesense RAM cluster |
| [Dashboard](./modules/dashboard.md) | `/dashboards` | Admin metrics (financials, order fulfilment, low‑stock alerts) |
| [Support](./modules/support.md) | `/support` | Tickets, threaded replies, admin state machine |
| [Notifications](./modules/notifications.md) | `/notifications` | In‑app alerts, mark as read |
| [Health](./modules/health.md) | `/health` | Liveness probe for load balancers (MongoDB/Redis/Typesense) |  

---  

## Error Handling  
All errors return a consistent shape (see above). Common status codes:  

| Code | Meaning | Typical message example |
|------|---------|------------------------|
| 400 | Validation failed | `"Validation Failed: email: Invalid email format"` |
| 401 | Unauthorized | `"Invalid or expired token. Please login again."` |
| 403 | Forbidden | `"You do not have permission to perform this action"` |
| 404 | Not Found | `"Product not found"` |
| 409 | Conflict | `"Email already registered. Please login instead."` |
| 429 | Too Many Requests | `"Too many requests, please try again later."` |
| 500 | Internal Server Error | `"Something went wrong on our side."` |  

For a complete list and frontend handling, see [**Error Handling Guide**](./error-codes.md).  

---  

## Testing Runbooks  

Manual test sequences (Thunder Client / Postman) are available in the [/testing](./thunder-tests/) folder:  

| Runbook | Module |
|---------|--------|
| [auth-runbook.md](./thunder-tests/auth-runbook.md) | Authentication flow |
| [product-runbook.md](./thunder-tests/product-runbook.md) | Product CRUD & polymorphic validation |
| [cart-runbook.md](./thunder-tests/cart-runbook.md) | Cart operations & coupon application |
| [order-runbook.md](./thunder-tests/order-runbook.md) | Checkout, webhooks, dispatch |
| [return-runbook.md](./thunder-tests/return-runbook.md) | Return initiation & admin processing |
| [interaction-runbook.md](./thunder-tests/interaction-runbook.md) | Reviews, comments, voting |
| [coupon-runbook.md](./thunder-tests/coupon-runbook.md) | Coupon creation & availability |
| [wishlist-runbook.md](./thunder-tests/wishlist-runbook.md) | Wishlist add/move/remove |
| [search-runbook.md](./thunder-tests/search-runbook.md) | Typo‑tolerant & faceted search |
| [dashboard-runbook.md](./thunder-tests/dashboard-runbook.md) | Admin metrics |
| [support-runbook.md](./thunder-tests/support-runbook.md) | Ticket creation & admin replies |
| [user-runbook.md](./thunder-tests/user-runbook.md) | Profile, address, password change |  

> These runbooks are intended for **internal QA and developers**, not for external API consumers.  

---  

## Need Help?  

- Check the [Authentication Guide](./authentication.md) for token issues.
- Review [Error Handling](./error-codes.md) for status‑code specific actions.
- For rate limiting details, see [Rate Limiting](./rate-limiting.md).
- If a bug is found, report it with the request/response and timestamp.  

---  

*The Reshma-Core Team*  