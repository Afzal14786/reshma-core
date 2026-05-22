<div align="center">

  # Dashboard Module
  
  **The admin analytics engine – aggregated business metrics, order fulfillment, inventory alerts, and support ticket counts.**

  [![Aggregations](https://img.shields.io/badge/MongoDB-Aggregation_Pipeline-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Admin](https://img.shields.io/badge/RBAC-Admin_Only-3448C5?style=flat)](#)
  [![$facet](https://img.shields.io/badge/$facet-Parallel_Queries-FF6B6B?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /metrics](#get-metrics)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Response Structure](#response-structure)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route : `/api/v1/dashboards`  


All endpoints are **admin‑only** and require a valid access token with the `ADMIN` role. Rate limiting applies (100 requests per 15 minutes per IP).

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/metrics` | Admin | Fetch aggregated business metrics: revenue, order fulfillment, top products, inventory alerts, user growth, pending support tickets |

> Optional query parameters `startDate` and `endDate` (ISO 8601) define the reporting period. Defaults to a 30‑day rolling window.

---

## Endpoint Details

### `GET /metrics`

Retrieve a complete dashboard snapshot for the authenticated admin. All metrics are computed via MongoDB aggregation pipelines directly at the database layer for optimal performance.

**Headers:** `Authorization: Bearer <admin_access_token>`

**Query parameters (optional):**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `startDate` | ISO 8601 string | 30 days before `endDate` | Start of reporting period (inclusive) |
| `endDate` | ISO 8601 string | current date | End of reporting period (inclusive) |

**Example request:**

```text
GET /api/v1/dashboards/metrics?startDate=2026-05-01&endDate=2026-05-31
```  

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard metrics retrieved successfully.",
  "data": {
    "dateRange": {
      "start": "2026-05-01T00:00:00.000Z",
      "end": "2026-05-31T23:59:59.999Z"
    },
    "financials": {
      "totalRevenue": 1250000,
      "totalOrders": 450,
      "averageOrderValue": 2778
    },
    "orderFulfillment": {
      "PENDING": 12,
      "PROCESSING": 25,
      "SHIPPED": 80,
      "DELIVERED": 300,
      "CANCELLED": 8,
      "RETURN_REQUESTED": 5,
      "RETURNED": 20
    },
    "topSellingProducts": [
      {
        "productId": "64a7b...",
        "sku": "BAN-001",
        "name": "Bridal Glass Bangle Set",
        "totalSold": 150,
        "revenueGenerated": 67500
      }
    ],
    "inventoryAlerts": [
      {
        "productId": "64a7c...",
        "sku": "APP-045",
        "name": "Cotton Saree",
        "currentStock": 3
      }
    ],
    "userMetrics": {
      "totalRegisteredUsers": 1250,
      "newSignupsInPeriod": 45
    },
    "pendingSupportTickets": 8
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  
---  

## Validation Rules (Zod)

The `DateRangeQuerySchema` validates query parameters:

| Field | Type | Rules |
|-------|------|-------|
| `startDate` | ISO 8601 string (coerced to Date) | optional, must be ≤ `endDate` if both provided |
| `endDate` | ISO 8601 string (coerced to Date) | optional, must be ≥ `startDate` if both provided |

**Refinement:** If both dates are present, `startDate` must be before or equal to `endDate`. Returns `400 Bad Request` otherwise.

> The schema uses `.strict()` – extra query parameters are rejected.  

---  

## Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `dateRange.start` | string (ISO) | Start of the reporting period (UTC midnight) |
| `dateRange.end` | string (ISO) | End of the reporting period (UTC 23:59:59) |
| `financials.totalRevenue` | number | Sum of `totalAmount` for delivered orders in period |
| `financials.totalOrders` | number | Count of delivered orders in period |
| `financials.averageOrderValue` | number | `totalRevenue / totalOrders` (rounded) |
| `orderFulfillment` | object | Counts per order status (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`) |
| `topSellingProducts` | array | Top 5 products by `totalSold` (from delivered orders) |
| `inventoryAlerts` | array | Active products with `currentStock < 10`, up to 10 results |
| `userMetrics.totalRegisteredUsers` | number | All users with role `USER` |
| `userMetrics.newSignupsInPeriod` | number | New `USER` registrations within the date range |
| `pendingSupportTickets` | number | Tickets with status `OPEN` or `WAITING_ON_CUSTOMER` |  

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Logical Error: startDate must occur before or at the exact same time as endDate."` | Invalid date range |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing or invalid token |
| 403 | `FORBIDDEN` | `"You do not have permission to perform this action"` | Non‑admin user attempts to access |
| 500 | `INTERNAL_SERVER_ERROR` | `"Failed to compute dashboard aggregations. Please contact engineering."` | Aggregation pipeline failure |  

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/dashboard-runbook.md`. The runbook covers:

- Fetching default 30‑day metrics
- Custom date ranges
- RBAC firewall (standard user gets 403)
- Temporal firewall (startDate after endDate)
- NoSQL injection attempts via date parameters

## Related Documentation

- [Orders Module](./orders.md) – order statuses and fulfillment data.
- [Products Module](./products.md) – inventory and top‑selling products.
- [Support Module](./support.md) – ticket statuses for pending count.
- [Authentication Guide](../authentication.md) – admin token requirements.
- [Error Handling Guide](../error-codes.md) – status codes.

---  

<div align="center">

Real‑time insights, aggregation‑optimised – the Reshma‑Core dashboard engine.
</div>  
