<div align="center">

  # Order & Checkout Module
  
  **The high-stakes financial engine managing cart finalization, payment verification, and immutable order records for the Reshma-Core platform.**

  [![MongoDB Transactions](https://img.shields.io/badge/MongoDB-ACID_Transactions-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Razorpay](https://img.shields.io/badge/Razorpay-Payment_Gateway-0C0C0C?style=flat&logo=razorpay&logoColor=white)](https://razorpay.com/)
  [![BullMQ](https://img.shields.io/badge/BullMQ-Async_Queue-FF6B6B?style=flat&logo=redis&logoColor=white)](https://bullmq.io/)
  [![PDFKit](https://img.shields.io/badge/PDFKit-Invoice_Generation-FF6347?style=flat)](https://pdfkit.org/)
  [![Zod](https://img.shields.io/badge/Zod-Validation-3068b7?style=flat)](https://zod.dev/)

</div>

---

## 1. Overview

The Order Module (`src/modules/orders/`) is the financial source of truth for the Reshma platform[cite: 2]. It orchestrates the transition of volatile cart data into immutable financial records[cite: 2]. It is engineered with a "Security-First" mindset, utilizing MongoDB sessions for atomic integrity and cryptographic HMAC handshakes to prevent financial fraud[cite: 2].

---

## 2. Core Architectural Pillars

### ACID-Compliant Transactions
To guarantee financial integrity, the checkout process is wrapped in a **MongoDB Multi-Document Transaction** (`mongoose.startSession`)[cite: 2].
*   **Atomic Boundary:** Stock deduction, Order document creation, and Cart clearing occur as a single unit of work[cite: 2].
*   **Auto-Rollback:** If any step fails (e.g., an item goes out of stock at the last millisecond), the entire database state is mathematically rolled back[cite: 2].

### Historical Immutability (Snapshotting)
Unlike other modules that rely on live references, this module utilizes **Deep-Copy Snapshotting**[cite: 2]. At the moment of purchase, the system captures:
*   **Captured Data:** `priceAtPurchase`, `sku`, `name`, `selectedAttributes`, and `imageSnapshot`[cite: 2].
*   **Audit Integrity:** If an Admin changes a product's price later, the user's historical receipt remains 100% accurate[cite: 2].

### Atomic Stock Reservation
We utilize a "Find-and-Update" firewall pattern using MongoDB `$inc` and `$gte` operators within the session[cite: 2].
*   **Race-Condition Defense:** Stock is only deducted if `currentStock >= requestedQuantity`[cite: 2]. This prevents "Overselling" during high-traffic flash sales[cite: 2].

---

## 3. Financial Business Rules

The engine enforces strict logic to ensure tax compliance and shipping profitability:
*   **GST Implementation:** A flat **18% Tax Amount** is calculated on the subtotal for all orders[cite: 2].
*   **Shipping Threshold:** A flat **₹50 shipping fee** is applied if the subtotal is under **₹2000**[cite: 2]. Orders above ₹2000 qualify for free shipping[cite: 2].
*   **Currency Precision:** All amounts are converted to **Paise** (amount * 100) before being sent to Razorpay to avoid floating-point math errors[cite: 2].

---

## 4. Lifecycle & Operations

### Inventory Defragmentation (Cron Orchestration)
To prevent "Inventory Leaks" caused by abandoned checkouts, the module relies on an automated background orchestrator (`node-cron`)[cite: 2].
*   **The Problem:** When a user initiates checkout, stock is atomically decremented[cite: 2]. If they close their browser without paying, that stock remains locked indefinitely[cite: 2].
*   **The Solution:** A worker sweeps the `Order` collection every 15 minutes. It isolates documents where `orderStatus` is `PENDING` and the `createdAt` timestamp is older than 30 minutes[cite: 2].
*   **Atomic Restoration:** For each abandoned order, the worker opens a new transaction, marks the order as `CANCELLED`, and executes an `$inc` operation to return the quantity to the catalog[cite: 2].

### Order State Machine
The module tracks the progression of an order through strictly defined states[cite: 2]:
*   **Standard Flow:** `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`[cite: 2].
*   **Exception/RMA Flow:** `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`[cite: 2].

---

## 5. Technical Implementations

### Webhook Cryptographic Verification
To verify Razorpay server-to-server pings, the system implements a **Raw Body Interceptor**[cite: 2]:
*   **The Challenge:** Standard JSON parsing alters the original payload string, causing HMAC signature mismatches[cite: 2].
*   **The Fix:** A global `verify` hook in `app.ts` captures the `req.rawBody` as a UTF-8 string specifically for webhook routes[cite: 2].
*   **Validation:** The `OrderService` uses `crypto.createHmac` to compare the `x-razorpay-signature` against the `rawBody`[cite: 2].

### Automated Communications Hook
The module is integrated with the **Notification Engine Facade** for real-time customer updates[cite: 1, 2]:
*   **Order Placed:** Triggers a BullMQ job for an async confirmation email (with PDF attachment) and an in-app "Bell Icon" alert[cite: 1, 2].
*   **Order Cancelled:** Automated triggers for both user-initiated and cron-initiated cancellations[cite: 1, 2].
*   **Order Shipped:** Dispatches shipping details and tracking numbers via async worker[cite: 1, 2].

---

## 6. API & Security Firewalls

*   **`checkoutLimiter`**: Extremely strict rate limiting to prevent card-testing bots[cite: 2].
*   **Taint Chain Severing:** The service layer manually maps `shippingAddress` fields from `req.body` to prevent Object Injection or Mass Assignment[cite: 2].
*   **`zod.strict()`**: Acts as a physical firewall, dropping NoSQL injection or Prototype Pollution attempts at the boundary[cite: 2].

## 7. Logistics & Fulfillment Engine (Shiprocket)

To bridge the digital transaction with the physical delivery of goods, the Order Module integrates with **Shiprocket**, a Third-Party Logistics (3PL) aggregator. This entirely automates the generation of Airway Bills (AWBs), courier allocation, and package tracking.

### A. The Rolling Auth Manager
Shiprocket relies on a JWT that expires every 10 days. To prevent the Reshma-Core server from executing an expensive login HTTP request on every single order dispatch, we implemented a **Rolling Auth Manager** (`src/config/shiprocket.ts`).
* **Caching:** The token is requested once and cached in Redis with an 8-day TTL.
* **Autonomous Refresh:** On the 8th day, the Redis key expires, gracefully forcing the next dispatch request to seamlessly negotiate a fresh 10-day token.

### B. The Dispatch Orchestrator (`shiprocket.service.ts`)
The `dispatchOrder` service is a distributed orchestrator. It bridges our ACID-compliant database with the highly volatile Shiprocket API.
* **Idempotency Firewall:** The service actively checks if `orderStatus === 'SHIPPED'` or if a `trackingNumber` already exists. This physically guarantees an Admin cannot double-click the "Dispatch" button, which would generate two tracking numbers and double-bill the company wallet.
* **Taint-Severing Boundary:** We do not blindly pass the Mongoose `Order` document to Shiprocket. The service explicitly maps only the required fields into Shiprocket's strict JSON schema, preventing internal data leaks.
* **Network-First Updates:** MongoDB is *only* updated with the AWB and Shipment ID *after* the entire 3-step Shiprocket handshake (Create -> Generate Label -> Schedule Pickup) resolves successfully.

### C. The Webhook Automation Loop
Once the courier picks up the physical package, the system relies on server-to-server Webhooks to track its journey.
1. **The Ping:** When a delivery agent marks a package as "Delivered" on their handheld device, Shiprocket fires a `POST` request to our `/api/v1/orders/shiprocket-webhook` endpoint.
2. **Cryptographic Validation:** The endpoint is completely unauthenticated (no JWTs). Instead, it relies on a static `x-api-key` header mapped to `SHIPROCKET_WEBHOOK_SECRET` to verify the payload's origin.
3. **State Machine Sync:** The service translates Shiprocket's micro-statuses into our macro database enums (e.g., converting "RTO ACKNOWLEDGED" to `RETURNED`).
4. **Asynchronous Notification:** Upon a successful transition to `DELIVERED`, the system triggers the `NotificationService` to queue a final "Order Delivered" email to the customer via BullMQ.  


---  

**Standard Documentation | Reshma-Core Architecture**