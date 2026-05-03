<div align="center">
  
  # Return & RMA Module  
  
  **The strict, 3-stage reverse-logistics engine managing customer returns, financial refunds, and atomic inventory restocking.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-ACID_Transactions-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Razorpay](https://img.shields.io/badge/Razorpay-Refund_API-0C0C0C?style=flat&logo=razorpay&logoColor=white)](#)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Firewalls-3068b7?style=flat)](#)
</div>

## 1. Overview
The Return Module (`src/modules/returns/`) handles the complex lifecycle of reversing an order. Because a return involves moving money backward and restoring inventory, it operates on a strictly enforced State Machine.

**Base Route:** `/api/v1/returns`

## 2. The 3-Stage State Machine

### Stage 1: Initiation (Customer)
A user requests a return. The system runs them through a strict eligibility firewall before saving the request to the database.
* **IDOR Protection:** Verifies the user actually owns the order.
* **7-Day TTL:** Mathematically rejects the request if it has been more than 7 days since the order was marked `DELIVERED`.
* **Hygiene Policy:** Automatically blocks returns if the product discriminator is `INNERWEAR`.
* **Photographic Proof:** If the product is `isFragile: true` (e.g., Glass Bangles), the payload must contain Cloudinary image URLs proving damage.
* **Result:** The return is saved as `PENDING_APPROVAL`. 

### Stage 2: Arbitration (Admin)
An admin reviews the request and either approves or rejects it.
* **Rejection:** The admin *must* provide a reason (enforced by Zod). The order reverts to `DELIVERED`.
* **Approval:** The return moves to `APPROVED`, and the customer is emailed shipping instructions.

### Stage 3: Process Refund & Restock (Admin)
Once the physical item arrives at the warehouse, the admin finalizes the return.
* **Razorpay Handshake:** The system calls the Razorpay Refund API using the historical `priceAtPurchase` to prevent refund amount manipulation.
* **Atomic Restock:** An ACID transaction uses `$inc` to return the specific quantity back to the live catalog.
* **Result:** The return becomes `REFUNDED` and the Order becomes `RETURNED`.

## 3. Distributed System Architecture Note
When processing the final refund (Stage 3), we communicate with two external systems: Razorpay and MongoDB. 

**Rule:** We *never* hold a MongoDB transaction open while waiting for the Razorpay HTTP ping. Doing so causes database connection pool starvation. We ping Razorpay first. If the gateway succeeds, we open the MongoDB transaction to safely sync our internal database state.

## 4. Financial Taint Severing
The system completely ignores the live catalog price when calculating refunds. If a user buys a bangle for ₹500, and the admin later raises the live catalog price to ₹700, the system looks deeply into the historical `Order` snapshot to refund exactly ₹500. This neutralizes price-hike exploitation.

---
*Standard Documentation | Reshma-Core Architecture*