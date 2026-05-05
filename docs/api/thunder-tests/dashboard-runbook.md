# Thunder Client Runbook: Dashboard Module

**Base URL:** `{{API_URL}}/api/v1/dashboard`
**Auth Requirement:** All endpoints strictly require a valid `Bearer {{JWT_TOKEN}}` with an `ADMIN` role.

## 1. The "Happy Path" (Standard Retrieval)

### Test 1: Fetch 30-Day Default Metrics
*   **Method:** `GET /metrics`
*   **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
*   **Expected Result:** `200 OK`. The JSON response should contain populated `financials`, `orderFulfillment`, and `userMetrics`. The `dateRange` object will automatically reflect the last 30 days.

### Test 2: Fetch Specific Date Range
*   **Method:** `GET /metrics?startDate=2026-04-01&endDate=2026-04-30`
*   **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
*   **Expected Result:** `200 OK`. The data returned should be restricted to the specified April timeframe.

## 2. Security & Edge Case Testing

*   **Edge Case 1: RBAC Firewall (Unauthorized Role)**
    *   **Action:** Send Test 1, but use a standard `USER` access token.
    *   **Expected:** `403 Forbidden`. Message must indicate insufficient permissions.

*   **Edge Case 2: Temporal Firewall (Zod Logic Failure)**
    *   **Action:** Send `GET /metrics?startDate=2026-12-01&endDate=2026-01-01` (Start date is AFTER end date).
    *   **Expected:** `400 Bad Request`. Zod must catch the logical impossibility and return a validation error on the `startDate` path.

*   **Edge Case 3: NoSQL Type Injection**
    *   **Action:** Send `GET /metrics?startDate[$gte]=invalid`
    *   **Expected:** `400 Bad Request`. Zod will fail to coerce this object into a valid Date string and reject the payload.
