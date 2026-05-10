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

The Order Module (`src/modules/orders/`) is the financial source of truth for the Reshma platform. It orchestrates the transition of volatile cart data into immutable financial records. It is engineered with a "Security-First" mindset, utilizing MongoDB sessions for atomic integrity and cryptographic HMAC handshakes to prevent financial fraud.

---

## 2. Core Architectural Pillars

### ACID-Compliant Transactions
To guarantee financial integrity, the checkout process is wrapped in a **MongoDB Multi-Document Transaction** (`mongoose.startSession`).
*   **Atomic Boundary:** Stock deduction, Order document creation, and Cart clearing occur as a single unit of work.
*   **Auto-Rollback:** If any step fails (e.g., an item goes out of stock at the last millisecond), the entire database state is mathematically rolled back.

### Historical Immutability & Tax Snapshotting
Unlike other modules that rely on live references, this module utilizes **Deep-Copy Snapshotting** to guarantee legal compliance for Indian GST audits. At the exact millisecond of purchase, the system captures:
* **Product Data:** `priceAtPurchase`, `sku`, `name`, `selectedAttributes`, and `imageSnapshot`.
* **Immutable Tax Data:** `hsnCode`, `taxableValue`, `gstRate`, `cgst`, `sgst`, and `igst`.
* **Audit Integrity:** Tax laws change and products get deleted. By freezing the exact Central, State, and Integrated tax amounts at the line-item level, the user's historical receipt and the company's financial ledgers remain 100% mathematically accurate forever.

### Atomic Stock Reservation
We utilize a "Find-and-Update" firewall pattern using MongoDB `$inc` and `$gte` operators within the session.
*   **Race-Condition Defense:** Stock is only deducted if `currentStock >= requestedQuantity`. This prevents "Overselling" during high-traffic flash sales.

---

## 3. Financial & Tax Compliance Engine (GST)

The engine has abandoned standard flat-tax calculations to strictly enforce Indian e-commerce tax law via a **Two-Pass Calculation**:

* **Proportional Discounting:** If a coupon is applied, the discount is mathematically distributed across all line items based on their weight in the cart. GST is then calculated on this new, lower *Transaction Value*. This prevents margin loss during partial refunds.
* **Dynamic GST Brackets:** Utilizing the `TaxEngine`, products dynamically resolve their tax brackets. For example, `STITCHED_APPAREL` calculates at 18% GST, but if a coupon drops its transaction value below ₹2,500, the engine automatically shifts the tax bracket to 5%.
* **State Arbitration (CGST/SGST vs IGST):** The system hardcodes the business origin to **West Bengal**. During checkout, it evaluates the customer's shipping state:
  * *Intra-State (West Bengal):* Tax is split 50/50 into `cgst` and `sgst`.
  * *Inter-State (Outside WB):* 100% of the tax is allocated to `igst`.
* **Logistics Service Tax:** Shipping is free over ₹2000; otherwise, a ₹100 fee applies. The engine legally isolates this by extracting the mandated 18% service tax from the final shipping cost (`shippingTaxableValue` and `shippingTax`).

---

## 4. Lifecycle & Operations

### Inventory Defragmentation (Cron Orchestration)
To prevent "Inventory Leaks" caused by abandoned checkouts, the module relies on an automated background orchestrator (`node-cron`).
*   **The Problem:** When a user initiates checkout, stock is atomically decremented. If they close their browser without paying, that stock remains locked indefinitely.
*   **The Solution:** A worker sweeps the `Order` collection every 15 minutes. It isolates documents where `orderStatus` is `PENDING` and the `createdAt` timestamp is older than 30 minutes.
*   **Atomic Restoration:** For each abandoned order, the worker opens a new transaction, marks the order as `CANCELLED`, and executes an `$inc` operation to return the quantity to the catalog.

### Order State Machine
The module tracks the progression of an order through strictly defined states:
*   **Standard Flow:** `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`.
*   **Exception/RMA Flow:** `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`.

---

## 5. Technical Implementations

### Webhook Cryptographic Verification
To verify Razorpay server-to-server pings, the system implements a **Raw Body Interceptor**:
*   **The Challenge:** Standard JSON parsing alters the original payload string, causing HMAC signature mismatches.
*   **The Fix:** A global `verify` hook in `app.ts` captures the `req.rawBody` as a UTF-8 string specifically for webhook routes.
*   **Validation:** The `OrderService` uses `crypto.createHmac` to compare the `x-razorpay-signature` against the `rawBody`.  

### Legal PDF Tax Invoices (In-Memory)
The platform bypasses standard text receipts to produce legally compliant PDF Tax Invoices using `PDFKit`.
* **Zero Disk I/O:** The PDF is generated entirely as an in-memory `Buffer`. It strictly avoids `fs.writeFile` to prevent storage bloat and synchronous Event Loop blocking during high-traffic checkouts.
* **Compliance:** Unpacks the Immutable Tax Snapshot to render a full Indian GST Table featuring columns for HSN, Taxable Value, CGST, SGST, and IGST, originating from the Kolkata address.

### Automated Communications Hook
The module is integrated with the **Notification Engine Facade** for real-time customer updates[cite: 1, 2]:
*   **Order Placed:** Triggers a BullMQ job for an async confirmation email (with PDF attachment) and an in-app "Bell Icon" alert[cite: 1, 2].
*   **Order Cancelled:** Automated triggers for both user-initiated and cron-initiated cancellations[cite: 1, 2].
*   **Order Shipped:** Dispatches shipping details and tracking numbers via async worker[cite: 1, 2].

---

## 6. API & Security Firewalls

*   **`checkoutLimiter`**: Extremely strict rate limiting to prevent card-testing bots.
*   **Taint Chain Severing:** The service layer manually maps `shippingAddress` fields from `req.body` to prevent Object Injection or Mass Assignment.
*   **`zod.strict()`**: Acts as a physical firewall, dropping NoSQL injection or Prototype Pollution attempts at the boundary.

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