# Order & Checkout Module Architecture

## Overview
The Order Module is the financial core of the Reshma platform. It handles the transition of items from the dynamic Cart to an immutable, historical Order document. It is responsible for orchestrating stock reservation, payment gateway synchronization, and lifecycle management.

## Core Principles

### 1. Historical Immutability
Products in the catalog are highly dynamic; prices change, and items get deactivated. However, a user's financial receipt must never change. 
* **Design Decision:** The `Order` model does not merely reference the `Product` ID. It creates a deep-copy snapshot of the item's `name`, `sku`, `price at time of purchase`, and `selectedAttributes`. 

### 2. Atomic Stock Reservation
To prevent Race Conditions (e.g., two users trying to buy the last available bangle simultaneously), the checkout pipeline relies on atomic MongoDB `$inc` and `$gte` operators.
* **Flow:** The system verifies stock -> Atomically decrements the catalog -> Generates the Payment Order -> Clears the user's Cart. If stock is insufficient, the transaction aggressively aborts before any financial gateway is contacted.

### 3. State Machine (Lifecycle)
An order adheres strictly to the following progression:
1. **PENDING:** The user has clicked "Checkout", stock is reserved, and the payment gateway order is generated, but payment has not been confirmed.
2. **PAID:** The payment gateway webhook has successfully fired, and the cryptographic signature is verified.
3. **PROCESSING:** The warehouse is preparing the physical items.
4. **SHIPPED:** The package is handed to the logistics partner (Tracking ID attached).
5. **DELIVERED:** The customer has received the package.
6. **CANCELLED:** Can occur if the user abandons the checkout, or an Admin refunds the order. Reserved stock is atomically restored to the catalog.

## Security Constraints

* **Webhook Forgery Protection:** All incoming payment success notifications must pass an HMAC SHA-256 signature verification matching the Payment Gateway's secret key before the order state is updated to `PAID`.
* **Idempotency:** Webhook endpoints must be idempotent. If the payment gateway retries a "Success" webhook due to a network timeout, the system must not process the order twice or decrement stock a second time.
* **Access Control:** Customers can only read orders bound to their exact `userId`. Admins have global read/write access to update shipping statuses.

## Integration Points
* **Cart Module:** Polled to calculate the final checkout total and cleared upon successful initialization.
* **Product Module:** Interacted with to securely reserve physical inventory.
* **Notification Module:** Dispatches Email and In-App alerts for `Order Confirmed` and `Order Shipped` events.