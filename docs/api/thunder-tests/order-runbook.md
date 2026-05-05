# Thunder Client Runbook: Order & Logistics Module

**Base URL:** `{{API_URL}}/api/v1/orders`

## 1. Logistics: The Dispatch Pipeline

### Test 1: Dispatch an Order (Admin)
* **Method:** `POST`
* **Endpoint:** `/admin/{{ORDER_ID}}/dispatch`
* **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
* **Body (JSON):**
  ```json
  {
    "length": 15,
    "breadth": 10,
    "height": 5,
    "weight": 0.5
  }
  ```  
* **Expected Result:** `200 OK`. The response should contain the updated order with `orderStatus: "SHIPPED"` and an active `trackingNumber` (AWB).  

* **Idempotency Check:** Fire the request a second time. It should fail with `409 Conflict` ("This order has already been dispatched"), proving our double-billing firewall works.  

### Test 2: Simulate the Delivery Webhook (Public)  

* **Method:** `POST`
* **Endpoint:** `/shiprocket-webhook`
* **Headers:**  
    * `x-api-key: <YOUR_SHIPROCKET_WEBHOOK_SECRET>` 
* **Body (JSON):**  
    ```json
    {
    "awb": "<PASTE_AWB_GENERATED_IN_TEST_1>",
    "courier_name": "Delhivery",
    "current_status": "DELIVERED",
    "current_status_id": 7,
    "shipment_status": "Delivered",
    "channel_order_id": "<PASTE_ORDER_NUMBER>"
    }
    ```
* **Expected Result:** `200 OK` `{"status": "success", "received": true}`.  
* **Side-Effect Check:** Check your MongoDB instance. The order status should now be `DELIVERED`. Check your BullMQ dashboard or local terminal; the "Order Delivered" email job should have been successfully dispatched to the queue.  

## 2. Edge Case Security Tests  

### Edge Case 1: Webhook Auth Bypass  
* **Action:** Send Test 2 again, but omit the `x-api-key` header entirely.

* **Expected Result:** `401 Unauthorized`. This proves malicious actors cannot forge delivery statuses. 

### Edge Case 2: Zod Dimensions Firewall  
* **Action:** Send Test 1 (Dispatch), but set `"weight": -2`.
* **Expected Result:** `400 Bad Request`. Zod must drop the request, protecting the Shiprocket API from crashing on negative physical dimensions.