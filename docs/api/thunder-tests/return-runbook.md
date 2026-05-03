# Thunder Client Runbook: Returns Module

## 1. Overview
This document outlines the sequential testing flow for the RMA (Returns) State Machine. You will need both a `USER` access token (to initiate the return) and an `ADMIN` access token (to arbitrate and process it).

**Base URL:** `{{API_URL}}/api/v1/returns`

---

## 2. The "Happy Path" (Sequential Test Suite)

### Test 1: Initiate Return (Customer)
* **Method:** `POST`
* **Endpoint:** `/{{ORDER_ID}}/initiate` *(Replace with a valid Order ID that has status DELIVERED)*
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
* **Body (JSON):**
  ```json
  {
    "items": [
      {
        "productId": "64a7b...",
        "quantity": 1,
        "reason": "DEFECTIVE",
        "customerNote": "The bangle was cracked."
      }
    ],
    "images": ["[https://res.cloudinary.com/](https://res.cloudinary.com/)..."]
  }
  ``` 

* **Expected Result:** `201 Created`. Copy the `_id` of the generated return from the response.  

### Test 2: Arbitrate Return (Admin)  

* **Method:** `PATCH`
* **Endpoint:** `/admin/{{RETURN_ID}}/arbitrate` 
* **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
* **Body (JSON):**
    ```json
        {
            "status": "APPROVED"
        }
    ```  
* **Expected Result:** `200 OK`. Status updates to `APPROVED`.  

### Test 3: Process Refund & Restock (Admin)  

* **Method:** `POST`
* **Endpoint:** `/admin/{{RETURN_ID}}/process`
* **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
* **Expected Result:** `200 OK`.
* **Side-Effect Check:** Check your Razorpay Dashboard; the refund should appear. Check the product catalog; the stock should have incremented by 1.  

--- 

## 3. Security & Edge Case Testing (Negative Tests)  

* **Edge Case 1: The 7-Day TTL**
    * Change an order's `updatedAt` date in MongoDB to 10 days ago. Try to initiate a return.
    * **Expected:** `400 Bad Request` ("The 7-day return policy window has expired").

* **Edge Case 2: Hygiene Policy Block**  
    * Try to initiate a return on an order containing an `itemType: "INNERWEAR"`.
    * **Expected:** `403 Forbidden` ("Hygiene Policy Violation").

* **Edge Case 3: Admin Rejection Enforcement**  
    * Send Test 2, but set `"status": "REJECTED"` without providing an `adminRejectionReason`.
    * **Expected:** `400 Bad Request` (Zod will block it, demanding a reason for the customer email).