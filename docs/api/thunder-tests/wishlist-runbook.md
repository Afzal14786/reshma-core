# Thunder Client Runbook: Wishlist Module

**Base URL:** `{{API_URL}}/api/v1/wishlists`
**Auth Requirement:** All endpoints require a valid `Bearer {{JWT_TOKEN}}` in the Authorization header.

## 1. The "Happy Path" (Sequential Test Suite)

### Test 1: Fetch Wishlist (Lazy Initialization Check)
* **Method:** `GET /`
* **Expected Result:** `200 OK`. If the user is new, it should simply return `{"success": true, "data": { "items": [] }}`.

### Test 2: Add Item to Wishlist
* **Method:** `POST /add`
* **Body (JSON):**
  ```json
  {
    "productId": "<VALID_PRODUCT_ID>"
  }
  ```  

* **Expected Result:** `200 OK`. The database will now initialize the document and push the item.
* **Idempotency Test:** Hit "Send" 5 more times rapidly. The array should still only contain exactly one instance of this product.  

### Test 3: Move Item to Cart  

* **Method:** `POST /move-to-cart/<VALID_PRODUCT_ID>`
* **Body (JSON):**
    ```json
    {
        "quantity": 1,
        "selectedAttributes": {
            "size": "M"
        }
    }
    ```  
* **Expected Result:** `200 OK`. 
* **Side-Effect Check:** Call `GET /api/v1/cart`. The item should now be in the cart. Call `GET /api/v1/wishlists`. The item should be completely removed from the wishlist.  

### Test 4: Remove Specific Item
* **Method:** `DELETE /item/<VALID_PRODUCT_ID>`
* **Expected Result:** `200 OK`.

### Test 5: Clear Entire Wishlist
* **Method:** `DELETE /clear`
* **Expected Result:** `200 OK`.

## 2. Security & Edge Case Testing

* **Edge Case 1: Zod Payload Firewall (NoSQL Injection)**
  * Send `POST /add` with `"productId": "{ $ne: null }"`.
  * **Expected:** `400 Bad Request` ("Invalid Product ID format. Must be a 24-character Hex string.").

* **Edge Case 2: Ghost Item Self-Healing**
  * Add a valid item to the wishlist.
  * Open MongoDB Compass, find that product in the `Products` collection, and change `isActive` to `false`.
  * Send `GET /`.
  * **Expected:** The API returns `200 OK` with an empty array. The backend should have silently dropped the ghost item from the database.  

  