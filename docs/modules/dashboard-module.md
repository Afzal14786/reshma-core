<div align="center">
  # Admin Analytics Dashboard Module
  **The read-heavy mathematical engine powering financial reporting, fulfillment metrics, and inventory alerts.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Aggregation_Pipelines-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Architecture](https://img.shields.io/badge/Architecture-Read--Heavy-blue?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Temporal_Firewalls-3068b7?style=flat)](#)
  [![Security](https://img.shields.io/badge/RBAC-Admin_Only-red?style=flat)](#)
</div>

## 1. Executive Summary & Scope

The Dashboard Module (`src/modules/dashboard/`) serves as the command center for platform administrators. It is strictly a **Read‑Heavy Mathematical Engine** that computes business health metrics without maintaining its own database collections.

**Scope of Tracking (Database Truths):**
- Realized Revenue and Average Order Value (AOV) based on `DELIVERED` orders.
- Order fulfillment distribution (Pending, Shipped, Returned).
- Top‑selling products ranked by volume and generated revenue.
- Low stock inventory alerts (`currentStock < 10`).
- Active Arbitration Queue (count of support tickets with status `OPEN` or `WAITING_ON_CUSTOMER`).

**Out of Scope (Delegated to External Tools):**
- Anonymous pageviews, bounce rates, and session durations – delegated to Google Analytics (GA4) or Mixpanel.

**Base Route:** `/api/v1/dashboard`

---

## 2. Architectural Workflow & Data Flow

When an administrator requests a date range, the module executes a highly optimised data pipeline:

1. **Temporal Firewall (Zod)** – `DateRangeQuerySchema` coerces query strings into native `Date` objects and guarantees `startDate ≤ endDate`, neutralising NoSQL date‑injection.
2. **Parallel Execution** – Uses `Promise.all()` to query Orders, Products, and Users collections concurrently, reducing API latency.
3. **MongoDB `$facet` Operator** – Runs three isolated pipelines (Financial Totals, Fulfillment Counts, Top Products) in a **single database read**, avoiding Node.js memory exhaustion.
4. **Distributed Cron Locking** – Maintenance cron jobs (e.g., abandoned order recovery) use a Redis `SET NX` lock to prevent duplicate executions across multiple containers.

---

## 3. Mathematical Constraints & Failsafes

- **Zero‑Division Protection** – AOV defaults to `0` if `totalOrders === 0` (avoids `NaN`).
- **`$lookup` Join** – Top Products pipeline joins `orders` and `products` at the C++ storage layer, eliminating the N+1 query problem.
- **Strict Compiler Satisfaction** – User model queries use inline literals (`{ role: "USER" }`) to satisfy Mongoose 9’s strict `FilterQuery` types.
- **Cron Idempotency Firewall** – Redis lock with 60‑second expiration prevents “The Multiplier Bug”.

---

## 4. Security Boundaries

Financial data is the most sensitive information. The dashboard router enforces a strict middleware stack:

| Middleware | Purpose |
|------------|---------|
| `standardLimiter` | Prevents DoS via heavy aggregations. |
| `protect` | Cryptographically verifies JWT. |
| `restrictTo("ADMIN")` | Drops requests from non‑admin users (`403 Forbidden`). |

All endpoints are protected by all three layers.

---

## 5. Related Files

| File | Purpose |
|------|---------|
| `src/modules/dashboard/dashboard.controller.ts` | HTTP layer – extracts validated date range, calls service. |
| `src/modules/dashboard/dashboard.service.ts` | Core aggregation logic – `$facet`, `$lookup`, inventory alerts. |
| `src/modules/dashboard/dashboard.routes.ts` | Route definition with rate limiting, auth, and RBAC. |
| `src/modules/dashboard/dtos/date-range.dto.ts` | Zod validation for start/end dates. |
| `src/modules/dashboard/interfaces/dashboard.interface.ts` | Strict TypeScript interfaces for metrics. |

---

## 6. See Also

- [Background Jobs & Cron](../architecture/background-jobs-and-cron.md) – distributed locks for cron jobs.
- [Security Hardening](../architecture/security-hardening.md) – rate limiting and RBAC details.
- [Order Module](./order-module.md) – source of order status data.
- [Support Module](./support-module.md) – ticket status for arbitration queue.

---

*The Reshma-Core Team*