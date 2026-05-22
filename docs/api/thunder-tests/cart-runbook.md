# Thunder Client Runbook: Cart Module

**Base URL:** `{{API_URL}}/api/v1/carts`  
**Auth Requirement:** All endpoints require a valid `Bearer {{JWT_TOKEN}}` in the Authorization header.

---

## 1. The "Happy Path" (Sequential Test Suite)

### Test 1: Fetch Empty Cart (Initial State)

- **Method:** `GET /`
- **Headers:** `Authorization: Bearer {{USER_ACCESS_TOKEN}}`
- **Expected Result:** `200 OK`. Response should contain `{ "items": [] }` (empty cart).

---

### Test 2: Add Item to Cart

- **Method:** `POST /add`
- **Headers:** `Authorization: Bearer {{USER_ACCESS_TOKEN}}`
- **Body (JSON):**
    ```json
    {
        "productId": "<VALID_PRODUCT_ID>",
        "quantity": 2,
        "selectedAttributes": { "size": "M" }
    }
    ```  

* **Expected Result:** `200 OK`. Response shows the added item with quantity 2.  

---   

### Test 3: Add Another Item (Different Product)  

- **Method:** `POST /add`  
- **Body (JSON):**  
    ```json
    {
    "productId": "<ANOTHER_VALID_PRODUCT_ID>",
    "quantity": 1
    }
    ```  

- **Expected Result:** `200 OK`. Cart now contains two items.  

---  

### Test 4: Update Quantity of First Item  

- **Method:** `PATCH /update`  
- **Body (JSON):**  

    ```json
    {
    "productId": "<PRODUCT_ID_FROM_TEST_2>",
    "quantity": 5,
    "selectedAttributes": { "size": "M" }
    }
    ```   
* **Expected Result:** `200 OK`. Quantity of that item updates to 5.  

---  

### Test 5: Remove One Item  

- **Method:** `DELETE /item/<PRODUCT_ID_FROM_TEST_3>`
- **Expected Result:** `200 OK`. Cart now contains only the first item.  

---  

### Test 6: Apply a Coupon  

- **Pre-requisite:** Create a coupon via admin endpoint (e.g., `DIWALI500` with minCartValue 1000). Ensure cart subtotal >= minCartValue.
- **Method:** `POST /coupon/apply`
- **Body (JSON):**  

    ```json
    {
    "code": "DIWALI500"
    }
    ```  

- **Expected Result:** `200 OK`. Cart response includes appliedCoupon and recalculated total.  

---  

### Test 7: Remove Applied Coupon  

- **Method:** `DELETE /coupon/remove`
- **Expected Result:** `200 OK`. Cart no longer has appliedCoupon and total equals subtotal.  

---  

### Test 8: Clear Cart  

- **Method:** `DELETE /clear`
- **Expected Result:** `200 OK`. Cart becomes empty (items array empty).  

---  

## 2. Guest Cart Merge Flow  

### Test 9: Merge Guest Cart After Login  

- **Pre-requisite:** Before logging in, the frontend maintains a guest cart in localStorage.
- **Action:** After login, send the guest cart payload to merge.
- **Method:** `POST /merge`
- **Headers:** `Authorization: Bearer {{USER_ACCESS_TOKEN}}`
- **Body (JSON):**  
    ```json
    {
    "items": [
        {
        "productId": "<PRODUCT_ID>",
        "quantity": 1,
        "selectedAttributes": { "color": "Red" }
        }
    ]
    }
    ```  

* **Expected Result:** `200 OK`. Cart now contains the merged items (combined with any existing items – quantities sum if same product+attributes).

---  

## 3. Security & Edge Case Testing (Negative Tests)

### Edge Case 1: Duplicate Item Addition (Idempotency)
- **Action:** Send `POST /add` twice with the exact same `productId` and attributes.
- **Expected Result:** `200 OK` both times, but cart still has only one entry (quantity increments, not duplicate).

### Edge Case 2: Exceeding Stock (409 Conflict)
- **Action:** Add an item with quantity > available stock.
- **Expected Result:** `409 Conflict` with message `"Requested quantity exceeds available stock"`.

### Edge Case 3: Invalid Product ID (NoSQL Injection Attempt)
- **Action:** Send `POST /add` with `"productId": "{ $ne: null }"`.
- **Expected Result:** `400 Bad Request` – Zod validation catches invalid 24‑hex format.

### Edge Case 4: Apply Expired Coupon
- **Action:** Apply a coupon that has expired or does not exist.
- **Expected Result:** `404 Not Found` with `"Coupon not found or expired"`.

### Edge Case 5: Coupon Min Cart Value Not Met
- **Action:** Apply a coupon with `minCartValue` higher than current cart subtotal.
- **Expected Result:** `400 Bad Request` with `"Cart value does not meet minimum requirement for this coupon"`.

### Edge Case 6: Negative Quantity
- **Action:** Send `PATCH /update` with `"quantity": -1`.
- **Expected Result:** `400 Bad Request` – Zod rejects negative numbers.

### Edge Case 7: Remove Non‑Existent Item
- **Action:** `DELETE /item/<INVALID_OR_NONEXISTENT_PRODUCT_ID>`
- **Expected Result:** `200 OK` (no error, cart unchanged – idempotent).

### Edge Case 8: Update Item with Wrong SelectedAttributes
- **Action:** Attempt to update quantity of an item but provide `selectedAttributes` that do not match the existing item.
- **Expected Result:** `404 Not Found` (no item with that combination found).

---

## 4. Checklist for Manual Testing

| Test | Passed? | Notes |
|------|---------|-------|
| Fetch empty cart | ☐ | |
| Add item | ☐ | |
| Add second item | ☐ | |
| Update quantity | ☐ | |
| Remove one item | ☐ | |
| Apply coupon | ☐ | |
| Remove coupon | ☐ | |
| Clear cart | ☐ | |
| Merge guest cart | ☐ | |
| Duplicate addition (idempotency) | ☐ | |
| Stock validation (409) | ☐ | |
| NoSQL injection (400) | ☐ | |
| Expired coupon (404) | ☐ | |
| Min cart value failure (400) | ☐ | |
| Negative quantity (400) | ☐ | |
| Remove non‑existent item (200) | ☐ | |
| Wrong attributes on update (404) | ☐ | |  

---  

**Maintained by Reshma‑Core QA**  
