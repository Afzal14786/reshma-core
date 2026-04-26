<div align="center">

  # Cart Module Architecture
  
  **The volatile, write‑heavy pre‑checkout sandbox bridging anonymous browsing to authenticated payment pipelines for the Reshma‑Core platform.**

  [![MongoDB](https://img.shields.io/badge/MongoDB-Atomic_Updates-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Mongoose](https://img.shields.io/badge/Mongoose-Populate_Strategy-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![Zod](https://img.shields.io/badge/Zod-Strict_DTO-3068b7?style=flat)](https://zod.dev/)
  [![JWT](https://img.shields.io/badge/JWT-Guest_to_User_Merge-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)

</div>

---

## Overview
The Cart Module serves as the highly volatile, write-heavy pre-checkout sandbox for Reshma-Core. Unlike the Product catalog (which is read-heavy), the Cart must actively defend against race conditions, out-of-stock anomalies, and malicious mathematical payloads (e.g., negative quantities).

This module bridges the gap between the Anonymous Frontend User and the Authenticated Checkout Pipeline.

## Architectural Decision Records (ADRs)

### 1. Zero-Price Persistence
**Context:** Storing product prices directly inside the Cart document creates stale data if the Admin updates the catalog price while the item is sitting in a user's cart.
**Decision:** We strictly store ONLY the `productId` and `quantity`. 
**Consequence:** The `cartTotal` and `weightGrams` are calculated dynamically at runtime via Mongoose `.populate()`. The user is guaranteed to always see the live, millisecond-accurate price.

### 2. The Self-Healing Mechanism
**Context:** If a user adds an item to their cart, and the Admin subsequently deletes or deactivates (`isActive: false`) that product, fetching the cart will crash or display ghost items.
**Decision:** The `CartService.getCart()` method implements a self-healing loop. 
**Consequence:** Upon fetch, the service scans populated items. If an item returns `null` or `isActive: false`, the service silently drops the item from the array, recalculates the totals, saves the healed cart to MongoDB, and returns the sanitized version to the frontend.

### 3. Deterministic Variant Hashing
**Context:** The catalog is polymorphic. A user might add `{ size: 'M', color: 'Red' }` and later add `{ color: 'Red', size: 'M' }`. The database should treat these as the same item and simply increment `quantity` to 2.
**Decision:** We implemented `generateItemSignature()`, a cryptographic-style hashing method that sorts attribute keys alphabetically before joining them.
**Consequence:** Prevents cart bloat and ensures mathematically identical variants merge flawlessly.

### 4. The Guest-to-User Merge Flow
**Context:** Industry standards dictate that users should not be forced to log in simply to browse and add items to a cart.
**Decision:** 1. The frontend manages anonymous carts entirely in browser `localStorage`.
2. All backend `/cart` routes are strictly protected by JWT auth.
3. Upon login, the frontend fires a one-time sync to `POST /api/v1/cart/merge`.
**Consequence:** The database is protected from millions of abandoned anonymous bot carts, saving database compute and storage costs. The backend gracefully merges the local storage items into the official user cart, capping quantities if stock is low.

## Security & Validation Firewalls

All inbound payloads are intercepted by strict Zod Data Transfer Objects (`cart.dto.ts`):
* **NoSQL Injection:** `productId` is regex-validated to guarantee a strict 24-character MongoDB Hex string.
* **Negative Math Exploit:** `quantity` is strictly typed as an integer with `.min(1)`. This guarantees a malicious actor cannot pass `{ quantity: -5 }` to artificially drop their order subtotal.
* **Type Strictness:** `selectedAttributes` utilizes a strict `Record<string, AttributeValue>` to prevent deep-nested object injection.  

---
**Standard Documentation | Reshma-Core Architecture**