<div align="center">

  # Search Module
  
  **The sub‑50ms, RAM‑based discovery engine – typo‑tolerant, faceted, and built on Typesense.**

  [![Typesense](https://img.shields.io/badge/Typesense-RAM_Cluster-000000?style=flat&logo=typesense&logoColor=white)](#)
  [![Typo Tolerance](https://img.shields.io/badge/Typo_Tolerance-num_typos:2-FF6B6B?style=flat)](#)
  [![Facets](https://img.shields.io/badge/Facets-Counts_for_UI-47A248?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoint Overview](#endpoint-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /](#get-)
- [Query Parameters](#query-parameters)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Response Structure](#response-structure)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/search`  

The search endpoint is **public** (no authentication required) and is rate‑limited to protect the Typesense RAM cluster.

---

## Endpoint Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Public | Execute typo‑tolerant, faceted product search against the Typesense index |

> Rate limit: `standardLimiter` (100 requests per 15 minutes per IP). See [Rate Limiting Guide](../rate-limiting.md).

---

## Endpoint Details

### `GET /`

Search for products using Typesense. The index is kept in‑sync with MongoDB via event‑driven sync and a BullMQ retry queue for eventual consistency.

**Query parameters:** See [Query Parameters](#query-parameters) below.

**Example request (typo‑tolerant):**
```text
GET /api/v1/search?q=sre&itemType=BANGLE&limit=20
```  

**Example request (wildcard – all products):**  
```text
GET /api/v1/search?q=*
```  

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search results retrieved successfully",
  "data": {
    "hits": [
      {
        "id": "64a7b...",
        "name": "Bridal Glass Bangle Set",
        "sku": "BAN-001",
        "description": "Beautiful red glass bangles...",
        "basePrice": 450,
        "itemType": "BANGLE",
        "mainCategory": "Bangles",
        "images": ["https://res.cloudinary.com/..."],
        "tags": ["bridal", "glass", "bangle"]
      }
    ],
    "facet_counts": {
      "itemType": [
        { "value": "BANGLE", "count": 124 },
        { "value": "APPAREL", "count": 87 }
      ],
      "mainCategory": [
        { "value": "Bangles", "count": 124 },
        { "value": "Sarees", "count": 45 }
      ]
    },
    "meta": {
      "found": 124,
      "page": 1,
      "limit": 20,
      "search_time_ms": 12
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

---  

## Query Parameters

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `q` | string | `"*"` | – | Search query. `*` returns all products. Typos allowed (up to 2). |
| `page` | integer | `1` | – | Page number (1‑based) |
| `limit` | integer | `20` | `100` | Items per page (hard cap to prevent memory exhaustion) |
| `itemType` | string | – | – | Filter by product type (`BANGLE`, `APPAREL`, etc.) |
| `mainCategory` | string | – | – | Filter by main category |
| `minPrice` | number | – | – | Minimum base price (inclusive) |
| `maxPrice` | number | – | – | Maximum base price (inclusive) |
| `sortBy` | string | `_text_match:desc` | – | `basePrice:asc`, `basePrice:desc`, `createdAt:desc` |

**Important notes:**

- All string filters are **exact matches** (not partial).
- Price range filters are applied **before** sorting.
- The `q` parameter with `*` returns all products (useful for browsing).  

---  

## Validation Rules (Zod)

The `SearchQuerySchema` in `search.dto.ts` enforces:

| Field | Rules |
|-------|-------|
| `q` | string, optional (default `"*"`) |
| `page` | integer ≥ 1, default `1` |
| `limit` | integer between 1 and 100, default `20` |
| `itemType` | optional, string |
| `mainCategory` | optional, string |
| `minPrice` | optional, number ≥ 0 |
| `maxPrice` | optional, number ≥ 0 |
| `sortBy` | optional, enum `["basePrice:asc", "basePrice:desc", "createdAt:desc"]` |

**Coercion:** All numeric parameters are coerced using `z.coerce.number()`. Invalid values (e.g., `NaN`, negative) are rejected.

> The schema uses `.strict()` – extra query parameters are silently ignored (not rejected) to allow future extensions.  

---  

## Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `hits` | array | Array of matching products (only indexed fields) |
| `hits[].id` | string | MongoDB ObjectId (as string) |
| `hits[].name` | string | Product name |
| `hits[].sku` | string | Unique SKU |
| `hits[].description` | string | Product description |
| `hits[].basePrice` | number | Current price |
| `hits[].itemType` | string | `BANGLE`, `APPAREL`, etc. |
| `hits[].mainCategory` | string | Category for faceting |
| `hits[].images` | array | Cloudinary URLs (`index: false` – not searchable) |
| `facet_counts` | object | Counts per facet field (for UI filters) |
| `meta.found` | number | Total number of matching products |
| `meta.page` | number | Current page |
| `meta.limit` | number | Items per page |
| `meta.search_time_ms` | number | Typesense query time in milliseconds |

> The `images` field is `index: false` in Typesense – it is returned but not searchable. Deeply nested variant data is omitted to preserve RAM.

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"limit must be between 1 and 100"` | Zod validation fails |
| 400 | `BAD_REQUEST` | `"minPrice must be a non-negative number"` | Invalid price filter |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | `"Search engine temporarily unavailable"` | Typesense cluster unreachable |

> If Typesense is down, the API returns `500` (not fallback to MongoDB) because the product catalog is too large for ad‑hoc text search. The health endpoint can be used to monitor Typesense availability.  

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/search-runbook.md`. The runbook covers:

- Wildcard search (`q=*`)
- Typo‑tolerant search (`q=sre` for "saree")
- Faceted filtering (`itemType=BANGLE&minPrice=500`)
- Pagination and sorting
- Edge cases: invalid `limit`, negative price, NoSQL injection attempts

---

## Synchronisation Architecture (Admin / Background)

Product changes (create, update, delete, stock update) are automatically synced to Typesense via:

- **Inline sync** – On product save, the `ProductService` attempts to index/update the document in Typesense.
- **BullMQ retry queue** – If Typesense is temporarily unreachable, the operation is queued in `search-sync-queue` with exponential backoff (10 retries).
- **Dead letter queue** – After 10 failures, the job is marked failed and logged for manual intervention.

This ensures **eventual consistency** without blocking the admin HTTP response.

---

## Related Documentation

- [Products Module](./products.md) – product catalog and sync triggers.
- [Rate Limiting Guide](../rate-limiting.md) – public endpoint limits.
- [Error Handling Guide](../error-codes.md) – 5xx handling for Typesense failures.  

---  

<div align="center">

Lightning fast, typo‑forgiving – the Reshma‑Core search engine.
</div>  
