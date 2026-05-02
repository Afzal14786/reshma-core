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
The Cart Module serves as the highly volatile, write-heavy pre-checkout sandbox for Reshma-Core[cite: 2]. Unlike the Product catalog (which is read-heavy), the Cart must actively defend against race conditions, out-of-stock anomalies, and malicious mathematical payloads (e.g., negative quantities)[cite: 2].

This module bridges the gap between the Anonymous Frontend User and the Authenticated Checkout Pipeline[cite: 2].

## Architectural Decision Records (ADRs)

### 1. Zero-Price Persistence
**Context:** Storing product prices directly inside the Cart document creates stale data if the Admin updates the catalog price while the item is sitting in a user's cart[cite: 2].
**Decision:** We strictly store ONLY the `productId` and `quantity`[cite: 2]. 
**Consequence:** The `cartTotal` and `weightGrams` are calculated dynamically at runtime via Mongoose `.populate()`[cite: 2]. The user is guaranteed to always see the live, millisecond-accurate price[cite: 2].

### 2. The Self-Healing Mechanism
**Context:** If a user adds an item to their cart, and the Admin subsequently deletes or deactivates (`isActive: false`) that product, fetching the cart will crash or display ghost items[cite: 2].
**Decision:** The `CartService.getCart()` method implements a self-healing loop[cite: 2]. 
**Consequence:** Upon fetch, the service scans populated items[cite: 2]. If an item returns `null` or `isActive: false`, the service silently drops the item, recalculates totals, and saves the healed cart to MongoDB[cite: 2].

### 3. Deterministic Variant Hashing
**Context:** The catalog is polymorphic. A user might add `{ size: 'M', color: 'Red' }` and later add `{ color: 'Red', size: 'M' }`. The database should treat these as the same item[cite: 2].
**Decision:** We implemented `generateItemSignature()`, a cryptographic-style hashing method that sorts attribute keys alphabetically before joining them[cite: 2].
**Consequence:** Prevents cart bloat and ensures mathematically identical variants merge flawlessly[cite: 2].

### 4. The Guest-to-User Merge Flow
**Context:** Industry standards dictate that users should not be forced to log in simply to browse and add items to a cart[cite: 2].
**Decision:** 1. The frontend manages anonymous carts in `localStorage`[cite: 2]. 2. All backend `/cart` routes are strictly protected by JWT auth[cite: 2]. 3. Upon login, the frontend fires a one-time sync to `POST /api/v1/cart/merge`[cite: 2].
**Consequence:** The database is protected from millions of abandoned anonymous bot carts[cite: 2]. The backend gracefully merges local items into the official cart, capping quantities based on stock[cite: 2].

## Security & Validation Firewalls

All inbound payloads are intercepted by strict Zod Data Transfer Objects (`cart.dto.ts`)[cite: 2]:
* **NoSQL Injection:** `productId` is regex-validated to guarantee a strict 24-character MongoDB Hex string[cite: 2].
* **Negative Math Exploit:** `quantity` is strictly typed as an integer with `.min(1)`, preventing subtotal manipulation[cite: 2].
* **Type Strictness:** `selectedAttributes` utilizes a strict `Record<string, AttributeValue>` to prevent deep-nested object injection[cite: 2].
* **Rate Limiting:** (New) `standardLimiter` is applied before authentication to neutralize DoS vectors before expensive DB lookups[cite: 2].

---
**Standard Documentation | Reshma-Core Architecture**