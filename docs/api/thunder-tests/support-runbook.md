# Thunder Client Runbook: Customer Support Module

**Base URL:** `{{API_URL}}/api/v1/support`

## 1. The "Happy Path" (Sequential Test Suite)

### Test 1: Create a Ticket (Customer)
* **Method:** `POST`
* **Endpoint:** `/tickets`
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
* **Body (Form-Data):**
  * `subject`: "Missing item in delivery"
  * `category`: "ORDER_ISSUE"
  * `message`: "I only received 1 bangle set instead of 2."
  * `linkedEntity[entityType]`: "ORDER"
  * `linkedEntity[entityId]`: "<VALID_ORDER_ID_BELONGING_TO_USER>"
  * `images`: [File Upload - Optional]
* **Expected Result:** `201 Created`. Copy the `ticketId` from the response.

### Test 2: Fetch Customer Tickets (Customer)
* **Method:** `GET`
* **Endpoint:** `/tickets/me`
* **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
* **Expected Result:** `200 OK`. Returns a paginated list of the user's tickets.

### Test 3: Admin Replies to Ticket (Admin)
* **Method:** `POST`
* **Endpoint:** `/admin/tickets/{{TICKET_ID}}/reply`
* **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
* **Body (JSON / Form-Data):**
  ```json
  {
    "message": "We apologize for the inconvenience. We are checking the warehouse cameras now."
  }
  ```  

* **Expected Result:** `200 OK`. 
* **Side-Effect Check:** Check the database. The ticket `status` should have automatically shifted to `WAITING_ON_CUSTOMER`. BullMQ should have dispatched an email alert to the user.  

### Test 4: Update Ticket State (Admin)  

* **Method:** `PATCH`
* **Endpoint:** `/admin/tickets/{{TICKET_ID}}/state`
* **Headers: Authorization:** `Bearer <ADMIN_ACCESS_TOKEN>`
* **Body (JSON):**
    ```json
    {
    "status": "CLOSED",
    "priority": "HIGH"
    }
    ```

* **Expected Result:** `200 OK`.  

# 2. Security & Edge Case Testing  

* **Edge Case 1: IDOR Protection (Linked Entity)**
    * Attempt Test 1, but provide an `entityId` of an Order that belongs to a different user.
    * **Expected:** `404 Not Found` ("The specified order could not be found or does not belong to you").

* **Edge Case 2: Dead Ticket Revival** 
    * Attempt to reply to the ticket we closed in Test 4.
    * **Expected:** `403 Forbidden` ("This ticket has been closed").