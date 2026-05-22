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

The Cart Module serves as the volatile, write‑heavy pre‑checkout sandbox. Unlike the read‑heavy product catalog, the cart actively defends against race conditions, out‑of‑stock anomalies, and malicious mathematical payloads (e.g., negative quantities).

It bridges the gap between anonymous frontend users (cart stored in `localStorage`) and the authenticated checkout pipeline. All backend `/cart` routes are protected by JWT; guest carts are merged upon login.

---

## Architectural Decision Records (ADRs)

### 1. Zero‑Price Persistence
- **Context:** Storing product prices inside the Cart document creates stale data if an admin updates the catalog price while the item is in a cart.
- **Decision:** Store only `productId` and `quantity`.
- **Consequence:** Prices are calculated at runtime via Mongoose `.populate()`. The user always sees live, millisecond‑accurate prices.

### 2. Self‑Healing Mechanism
- **Context:** If an admin deactivates (`isActive: false`) or deletes a product, fetching the cart would crash or show ghost items.
- **Decision:** `CartService.getCart()` scans populated items and silently drops those that are `null` or `isActive: false`.
- **Consequence:** The cart is always clean, and the healed cart is saved back to MongoDB.

### 3. Deterministic Variant Hashing
- **Context:** Polymorphic products allow custom attributes (e.g., `{ size: 'M', color: 'Red' }`). Adding the same variant in different orders should not create duplicate line items.
- **Decision:** `generateItemSignature()` sorts attribute keys alphabetically and concatenates them with the product ID.
- **Consequence:** Prevents cart bloat; identical variants merge flawlessly.

### 4. Guest‑to‑User Merge Flow
- **Context:** Users should not be forced to log in before browsing and adding items.
- **Decision:**  
  - Frontend manages anonymous carts in `localStorage`.  
  - Backend `/cart` routes require JWT (no anonymous database carts).  
  - On login, frontend calls `POST /cart/merge` to sync.
- **Consequence:** Database protected from millions of abandoned bot carts; merge caps quantities by live stock.

### 5. Strict Type Satisfaction (Mongoose 9 / TypeScript 6)
- **Context:** Mongoose `.create()` inside transactions expects an array, triggering `exactOptionalPropertyTypes` warnings.
- **Decision:** Use intermediate assignment and explicit check:
```typescript
  const newCarts = await Cart.create([{ user: safeUserId, items: [] }], { session });
  const createdCart = newCarts[0];
  if (!createdCart) throw new AppError(...);
```  

- **Consequence:** Compiler retains full type information; no runtime surprises.  

## The Two‑Pass Financial Engine (Dynamic GST)

`CartService` generates dynamic tax calculations before checkout, complying with Indian GST (tax on Transaction Value, not MRP). The algorithm runs three passes:

| Pass | Operation |
|------|-----------|
| 1 – Aggregation | Computes raw subtotal, total weight, fragile flags. |
| 2 – Proportional Taxation & Discounting | Distributes coupon discount across line items based on weight; passes discounted unit price to `TaxEngine` to resolve GST brackets (e.g., stitched apparel shifts from 18% to 5% if discounted price ≤ ₹2,500). Injects `financials` object per item for frontend transparency. |
| 3 – Logistics | Applies free‑shipping threshold (> ₹2,000), extracts 18% inclusive GST from shipping charge. |  

---  

## Security & Validation Firewalls

All inbound payloads are intercepted by strict Zod DTOs (`cart.dto.ts`):

| Threat | Mitigation |
|--------|------------|
| NoSQL injection | `productId` regex‑validated as 24‑character hex string. |
| Negative quantity exploit | `quantity` must be integer ≥ 1, capped at 10 per item. |
| Prototype pollution | `selectedAttributes` uses `Record<string, AttributeValue>`; a reconstruction function strips `__proto__`, `constructor`, `prototype`. |
| DoS (expensive lookups) | `standardLimiter` applied before authentication. |

---

## Related Files

| File | Purpose |
|------|---------|
| `src/modules/cart/cart.controller.ts` | HTTP layer, `catchAsync` wrapper. |
| `src/modules/cart/cart.service.ts` | Core logic – ACID transactions, self‑healing, tax calculation, coupon integration. |
| `src/modules/cart/cart.model.ts` | Mongoose schemas (`Cart` + `CartItem`). |
| `src/modules/cart/cart.interface.ts` | TypeScript interfaces (`ICartItem`, `ICart`). |
| `src/modules/cart/cart.routes.ts` | Route definitions with rate limiting, auth, and validation. |
| `src/modules/cart/dtos/cart.dto.ts` | Zod schemas for add, update, merge, remove. |  

---  

## See Also

- [Database Design – Base Product Schema](../architecture/database-design.md#2-base-product-schema)
- [Order Module](./order-module.md) (checkout pipeline)
- [Coupon Module](./order-module.md) (discount validation)
- [Tax & GST Engine](../architecture/legal-tax-compliance.md)
- [Product Module](./product-module.md)

---  

*The Reshma-Core Team*  