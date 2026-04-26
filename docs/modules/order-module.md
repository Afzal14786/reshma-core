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

## Overview

The Order Module (`src/modules/orders/`) is the financial core of the Reshma platform. It orchestrates the transition of volatile cart data into immutable financial records. It is engineered with a "Security-First" mindset, utilizing MongoDB sessions for atomic integrity and cryptographic HMAC handshakes to prevent financial fraud.

---

## Core Architectural Pillars

### 1. ACID-Compliant Transactions
To guarantee financial integrity, the checkout process is wrapped in a **MongoDB Multi-Document Transaction** (`mongoose.startSession`).
* **Atomic Boundary:** Stock deduction, Order document creation, and Cart clearing occur as a single unit of work.
* **Auto-Rollback:** If any step fails (e.g., an item goes out of stock at the last millisecond), the entire database state is mathematically rolled back.

### 2. Historical Immutability (Snapshotting)
Unlike other modules that rely on live references, this module utilizes **Deep-Copy Snapshotting**. At the moment of purchase, the system captures:
* **Captured Data:** `priceAtPurchase`, `sku`, `name`, `selectedAttributes`, and `imageSnapshot`.
* **Audit Integrity:** If an Admin changes a product's price later, the user's historical receipt remains 100% accurate.

### 3. Atomic Stock Reservation
We utilize a "Find-and-Update" firewall pattern using MongoDB `$inc` and `$gte` operators within the session.
* **Race-Condition Defense:** Stock is only deducted if `currentStock >= requestedQuantity`. This prevents "Overselling" during high-traffic flash sales.

---

## Schema Architecture

The `Order` schema defines the financial and logistical state of a transaction, divided into four data boundaries.

### 1. Order Identification & Ownership
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `user` | ObjectId | Required, Index | Reference to the `User` who placed the order. |
| `orderNumber` | String | Unique, Index | Human-readable ID generated via `pre-save` hook (e.g., ORD-7B9F1A). |
| `items` | Array | Sub-document | Historical snapshots of products purchased. |

### 2. Financials & Payments
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `pricing` | Object | Nested Fields | Tracks `subTotal`, `shippingCost`, `taxAmount`, and `totalAmount`. |
| `paymentMethod`| Enum | `RAZORPAY`, `COD` | The financial gateway selected by the user. |
| `paymentStatus`| Enum | `PENDING`, `PAID` | Current state of the financial transaction. |
| `gatewayOrderId`| String | Sparse Index | The unique ID returned by the Razorpay API. |

### 3. Logistics & Fulfillment
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `orderStatus` | Enum | State Machine | Progression from `PENDING` to `DELIVERED`. |
| `shippingAddress`| Object | Strict DTO | The validated E.164 phone and PIN code destination. |
| `trackingNumber` | String | Optional | Attached by Admin when status moves to `SHIPPED`. |

---

## Technical Implementations

### On-the-Fly PDF Invoicing
Invoices are generated in real-time using `pdfkit`.
* **Memory Management:** PDFs are generated as binary `Buffers` in RAM and streamed directly to the user. We avoid disk I/O to maximize performance.
* **IDOR Protection:** Every request ensures the `order.user` strictly matches `req.user._id`.

### Automated Logistics Hook
The module is integrated with the **Notification Engine Facade**:
* When status moves to `SHIPPED`, a BullMQ job is dispatched to fire an async email.
* This provides a dual-channel alert: Transactional email and a persistent In-App notification.

---

## API & Security Firewalls

* **`checkoutLimiter`**: Extremely strict rate limiting to prevent card-testing bots.
* **`verifyRazorpaySignature`**: Mathematically verifies HMAC SHA-256 signatures to prevent spoofing.
* **`zod.strict()`**: Acts as a physical firewall, dropping NoSQL injection or Prototype Pollution attempts at the boundary.

---  

**Standard Documentation | Reshma-Core Architecture**