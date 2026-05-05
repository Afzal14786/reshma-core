# Thunder Client Runbook: Search Module

**Base URL:** `{{API_URL}}/api/v1/search`

## 1. The "Happy Path" (Public Discovery)

### Test 1: Standard Wildcard Search
*   **Method:** `GET /`
*   **Expected Result:** `200 OK`. Returns the first 20 active products, plus facet counts for categories.

### Test 2: Typo-Tolerant Search
*   **Method:** `GET /?q=sre` *(Intentional typo for "saree")*
*   **Expected Result:** `200 OK`. Should successfully return "Saree" products utilizing the `num_typos: 2` configuration.

### Test 3: Faceted Filtering & Sorting
*   **Method:** `GET /?itemType=BANGLE&minPrice=100&sortBy=basePrice:asc`
*   **Expected Result:** `200 OK`. Returns only Bangles over ₹100, sorted cheapest to most expensive.

## 2. Security & Edge Case Testing

*   **Edge Case 1: Memory Exhaustion Prevention (Zod)**
    *   **Action:** Send `GET /?limit=5000`
    *   **Expected:** `400 Bad Request`. Zod restricts the limit to a maximum of 100.
*   **Edge Case 2: Negative Math Exploits**
    *   **Action:** Send `GET /?page=-1&minPrice=-50`
    *   **Expected:** `400 Bad Request`. Negative integers are stripped and rejected by the Zod coercer.