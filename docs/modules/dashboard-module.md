<div align="center">
  # Admin Analytics Dashboard Module
  **The read-heavy mathematical engine powering financial reporting, fulfillment metrics, and inventory alerts.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Aggregation_Pipelines-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Architecture](https://img.shields.io/badge/Architecture-Read--Heavy-blue?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Temporal_Firewalls-3068b7?style=flat)](#)
</div>

## 1. Executive Summary & Scope
The Dashboard Module (`src/modules/dashboard/`) serves as the command center for platform administrators. It is strictly a **Read-Heavy Mathematical Engine** that computes business health metrics without maintaining its own database collections.

**Scope of Tracking (Database Truths):**
*   Realized Revenue and Average Order Value (AOV) based on `DELIVERED` orders.
*   Order fulfillment distribution (Pending, Shipped, Returned).
*   Top-selling products ranked by volume and generated revenue.
*   Low stock inventory alerts (`currentStock < 10`).
* Active Arbitration Queue (Count of Support Tickets currently OPEN or WAITING_ON_CUSTOMER).

**Out of Scope (Delegated to External Tools):**
*   Anonymous pageviews, bounce rates, and session durations. These metrics cause severe MongoDB heap bloat and are strictly delegated to Time-Series tools like Google Analytics (GA4) or Mixpanel.

**Base Route:** `/api/v1/dashboard`

## 2. Architectural Workflow & Data Flow
When an administrator requests a date range, the module executes a highly optimized data pipeline to prevent Node.js memory exhaustion.

1.  **Temporal Firewall (Zod):** The `DateRangeQuerySchema` coerces URL query strings into native JavaScript `Date` objects. It mathematically guarantees that `startDate` occurs before `endDate`, neutralizing NoSQL date-injection payloads before they reach the database.
2.  **Parallel Execution:** The service utilizes `Promise.all()` to query the Orders, Products, and Users collections concurrently, drastically reducing API latency.
3.  **The `$facet` Operator:** For the heavy Order metrics, the engine uses MongoDB's `$facet` operator. This allows the database to run three isolated pipelines (Financial Totals, Fulfillment Counts, Top Products) in a *single database read*, bypassing the need to pull thousands of documents into the Node.js memory heap.

## 3. Mathematical Constraints & Failsafes
*   **Zero-Division Protection:** When calculating Average Order Value (AOV), if `totalOrders` equals 0 in the given date range, the system mathematically defaults to `0` rather than returning `NaN`, preventing frontend UI crashes.
*   **The `$lookup` Join:** The Top Products pipeline uses `$lookup` to join the active `orders` collection directly with the `products` collection at the C++ storage layer. This eliminates the "N+1 Query Problem" that occurs when looping through IDs in JavaScript.
*   **Strict Compiler Satisfaction:** Queries against the User model use inline literals (`{ role: "USER" }`) to satisfy Mongoose 9's strict `FilterQuery` types without causing TypeScript 6 type-widening errors.

## 4. Security Boundaries
Financial data is the most sensitive information in the system. The dashboard router strictly enforces the following middleware stack:
1.  `standardLimiter`: Prevents malicious actors from triggering continuous heavy aggregations (DoS attacks).
2.  `protect`: Ensures the request has a mathematically verified JWT.
3.  `restrictTo("ADMIN")`: Acts as the final physical gateway, dropping the request instantly if the user's role is not administrative.