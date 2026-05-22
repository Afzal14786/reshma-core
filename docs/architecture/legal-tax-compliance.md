<div align="center">

  # Legal & Financial Tax Compliance

  **The Dynamic Indian GST Calculation & Arbitration Engine**

  [![Compliance](https://img.shields.io/badge/Compliance-Indian_GST-FF9933?style=flat)](#)
  [![Math](https://img.shields.io/badge/Math-Proportional_Discounting-blue?style=flat)](#)
  [![Audit](https://img.shields.io/badge/Audit-Immutable_Snapshots-success?style=flat)](#)
  [![DPDP](https://img.shields.io/badge/DPDP-GDPR_Compliant-0A66C2?style=flat)](#)

</div>

## 1. Executive Summary

Reshma‑Core implements a **line‑item level tax calculation engine** that complies with Indian GST laws. Unlike basic e‑commerce templates that apply a flat tax to the cart subtotal, this platform:

- Calculates tax on the **Transaction Value** (post‑discount price).
- Arbitrates CGST/SGST (intra‑state) vs IGST (inter‑state) based on the business origin (**West Bengal**).
- Uses **proportional discounting** to prevent refund exploitation.
- **Snapshots tax data immutably** in each order for audit compliance.

All tax logic is centralised in `src/modules/orders/tax.utils.ts` and invoked by the Cart, Order, and Return modules.

---

## 2. Tax Profiles & HSN Thresholds

Every product stores a `taxProfile` (enum) and an `hsnCode` (4‑8 digits). The engine resolves the GST rate based on government thresholds.

### TaxProfile Enum (`tax.utils.ts`)

| `TaxProfile` | Typical HSN | GST Logic | Example Products |
|--------------|-------------|-----------|------------------|
| `IMITATION_JEWELLERY` | 7117 | Flat 3% | Necklaces, earrings (non‑precious) |
| `LAC_JEWELLERY` | 7117 | Flat 0% (Exempt) | Lac bangles |
| `UNSTITCHED_FABRIC` | 50‑60 | Flat 5% | Raw silk, cotton fabric by metre |
| `FOOTWEAR` | 64 | Flat 12% | Sandals, shoes (up to ₹1000) |
| `GENERAL_ACCESSORY` | 4202 | Flat 18% | Bags, belts, wallets |
| `STITCHED_APPAREL` | 61‑62 | **Dynamic:** 5% if Transaction Value ≤ ₹2,500; 18% if > ₹2,500 | Readymade sarees, kurtis |

> **Note:** The `hsnCode` field is mandatory for all products. The `taxProfile` determines the rate; the `TaxEngine` applies the dynamic threshold for `STITCHED_APPAREL`.

---

## 3. Core Financial Algorithms

### A. Proportional Discounting (Refund Exploit Prevention)

**Problem:** If a flat ₹500 discount is applied to a cart with two items (₹1000 + ₹1500 = ₹2500), a naive refund of one item would return its full price, causing loss.

**Solution:** Discount is distributed proportionally across line items based on their weight in the cart.

#### Calculation Steps

1. **At checkout (`CartService.getCart` – Pass 2):**
   - Raw subtotal = sum of (basePrice * quantity).
   - Global discount = applied coupon amount (e.g., ₹500).
   - For each item:  
     `itemWeight = itemSubtotal / cartSubtotal`  
     `itemDiscount = globalDiscount * itemWeight`  
     `itemPostCouponTotal = itemSubtotal - itemDiscount`

2. **Example:**
   - Cart: Item A ₹1000, Item B ₹1500 → subtotal ₹2500.
   - Coupon: ₹500 flat.
   - Item A weight = 1000/2500 = 0.4 → discount = ₹200 → pays ₹800.
   - Item B weight = 1500/2500 = 0.6 → discount = ₹300 → pays ₹1200.

3. **During a return (`ReturnService.initiateReturn`):**
   - The refund amount uses the historical `priceAtPurchase` from the order snapshot.
   - The discount ratio is applied to each returned item, ensuring the refund matches the actual consideration paid.

**Code reference (`cart.service.ts` – simplified):**
```typescript
const globalDiscount = cart.discountAmount;
for (const item of items) {
  const itemPreCouponTotal = activePrice * item.quantity;
  const itemWeight = itemPreCouponTotal / totals.subTotal;
  const itemDiscount = globalDiscount * itemWeight;
  const postDiscountTotal = itemPreCouponTotal - itemDiscount;
  // then calculate tax on postDiscountTotal per unit
}
```  

### B. GST Calculation (`TaxEngine.calculateLineItemTax`)

Once the discounted unit price is known, the tax engine:

1. Gets the base GST rate from the product’s `taxProfile`.
2. For `STITCHED_APPAREL`, dynamically adjusts the rate:
   - If discounted unit price × quantity ≤ ₹2500 → 5% GST.
   - Else → 18% GST.
3. Splits the total tax into CGST, SGST, or IGST based on the shipping state:
   - Intra‑state (West Bengal) → CGST = SGST = totalTax / 2.
   - Inter‑state → IGST = totalTax.

**Example:**  
Product: Stitched saree, discounted unit price ₹600, quantity 5 → total ₹3000 (> ₹2500) → GST 18% → total tax ₹540.  
- Shipping to Kolkata (WB) → CGST ₹270, SGST ₹270.  
- Shipping to Delhi → IGST ₹540.

---

### C. Shipping Service Tax

Shipping is a service under Indian GST. The platform extracts 18% inclusive tax from the shipping charge.

**Formula:**  
If shipping charge = ₹100 (inclusive of GST), then:

- Base = 100 / 1.18 ≈ ₹84.75  
- Tax = 100 - 84.75 ≈ ₹15.25  

**Code (`TaxEngine.calculateShippingTax`):**  

```typescript
const taxAmount = Math.round(shippingCharge - (shippingCharge / (1 + (gstRate / 100))) * 100) / 100;
```  
---  

## 4. Immutable Tax Snapshotting

At the exact moment of checkout, all tax‑relevant data is frozen into the order document:

- `priceAtPurchase`, `sku`, `name`, `selectedAttributes`, `imageSnapshot`
- **Tax fields:** `hsnCode`, `taxableValue`, `gstRate`, `cgst`, `sgst`, `igst`

If a product’s price or tax profile changes later, past invoices remain mathematically correct. This satisfies **legal audit requirements** for Indian GST.

**Location:** `OrderService.initializeCheckout` (within ACID transaction).

---  

## 5. DPDP & GDPR Privacy Compliance

### Pillar 1: Immutable Consent Tracking

- **Legal gatekeeper:** `register.dto.ts` requires `acceptPrivacyPolicy: true` – requests without it are rejected (`400`).
- **Immutable ledger:** Upon successful registration, the server timestamp is stored in `user.preferences.privacyPolicyAcceptedAt`. This provides undeniable proof of consent.

### Pillar 2: Right to be Forgotten (Anonymisation Engine)

When a user deletes their account (`UserService.deleteAccount`), an ACID transaction:

- Permanently deletes ephemeral data: `cart`, `wishlist`.
- **Preserves financial data** but irreversibly scrambles PII (name, address, phone) in orders and support tickets.
- Sends `clearCookie` to kill the refresh token.

This complies with DPDP/GDPR without breaking tax reporting.

### Pillar 3: Right to Access (Data Portability)

Users can request a JSON export of all their data:

- `POST /api/v1/users/profile/export` returns `202 Accepted` immediately.
- A BullMQ worker (`export.worker.ts`) concurrently fetches profile, orders, cart, wishlist, reviews, and support tickets.
- The data is sanitised, compiled into JSON, and emailed as an attachment.  

---  

## 6. Where the Tax Engine Is Invoked

| Module | Method | Purpose |
|--------|--------|---------|
| Cart | `CartService.getCart()` | Calculates live taxes for the frontend (pre‑checkout preview). |
| Order | `OrderService.initializeCheckout()` | Locks taxes immutably before creating Razorpay order. |
| Return | `ReturnService.initiateReturn()` | Uses historical tax data to compute refund amounts. |
| Product | (not directly) | Tax profile is stored with the product; used at checkout. |  


---  

## 7. Related Files

| File | Purpose |
|------|---------|
| `src/modules/orders/tax.utils.ts` | `TaxEngine` with `calculateLineItemTax`, `calculateShippingTax`, `TaxProfile` enum. |
| `src/modules/orders/order.service.ts` | Immutable tax snapshotting during checkout. |
| `src/modules/orders/order.model.ts` | Order schema storing `cgst`, `sgst`, `igst`, etc. |
| `src/modules/cart/cart.service.ts` | Two‑pass tax calculation (Pass 2). |
| `src/modules/returns/return.service.ts` | Proportional discount ratio for refunds. |
| `src/modules/users/user.model.ts` | `privacyPolicyAcceptedAt` timestamp. |
| `src/shared/queues/export.worker.ts` | Asynchronous data export for Right to Access. |
| `src/modules/auth/dtos/register.dto.ts` | `acceptPrivacyPolicy` gatekeeper. |

---  

## Next Steps

- See the [Order Module](../modules/order-module.md) for checkout and tax freezing.
- Explore [Cart Module](../modules/cart-module.md) for dynamic tax preview.
- Read [DPDP/GDPR Compliance](./legal-tax-compliance.md) (this document).  

---  

*The Reshma-Core Team*  