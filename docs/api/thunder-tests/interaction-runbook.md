# Thunder Client Runbook: Interactions Module

**Base URL:** `{{API_URL}}/api/v1/interactions`

## 1. The "Happy Path" (Sequential Test Suite)

### Test 1: Create a Product Review
* **Method:** `POST`
* **Endpoint:** `/`
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
* **Body (JSON):**
  
```json
  {
    "productId": "<VALID_PRODUCT_ID>",
    "type": "REVIEW",
    "rating": 5,
    "content": "Absolutely love this product! Highly recommended."
  }
  ```  

* **Expected Result:** 201 Created. Copy the _id of the created interaction.  

### Test 2: Reply to a Review (Comment)  
* **Method:** `POST`  
* **Endpoint:** `/`
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>` 
* **Body (JSON):** 
    ```json
        {
        "productId": "<VALID_PRODUCT_ID>",
        "type": "COMMENT",
        "parentId": "<INTERACTION_ID_FROM_TEST_1>",
        "content": "Thanks for the detailed review, this helped me decide!"
        }
    ```  
* **Expected Result:** `201 Created`.  

### Test 3: Upvote a Review  

* **Method:** `PATCH`
* **Endpoint:** `/<INTERACTION_ID_FROM_TEST_1>/vote`
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
* **Body (JSON):**  
    ```json
        {
        "action": "LIKE"
        }
    ```  

* **Expected Result:** `200 OK`.  

### Test 4: Fetch Paginated Reviews (Public)  

* **Method:** `GET`
* **Endpoint:** `/product/<VALID_PRODUCT_ID>?page=1&limit=10` 
* **Auth:** None required.
* **Expected Result:** `200 OK`. Should return a paginated list of top-level reviews.  

--- 

## 2. Security & Edge Case Testing (Negative Tests)

* **Edge Case 1: Anti-Spam Firewall**

    - Resend Test 1 exactly as is.
    - **Expected:** `409 Conflict` ("You have already submitted a review...").

* **Edge Case 2: Zod Dynamic Validation**

    - Send Test 2 (Comment), but inject `"rating": 4` into the JSON body.
    - **Expected:** `400 Bad Request` ("Security Violation: Ratings are forbidden on threaded COMMENTS").

* **Edge Case 3: Memory Exhaustion Protection**

    - Send Test 4, but set the limit to a massive number: `?limit=999999`.
    - **Expected:** `200 OK`, but the pagination object will prove the `limit` was forced down to `50` by the controller.