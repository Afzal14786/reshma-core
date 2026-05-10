<div align="center"> 
  
  # Legal & Financial Tax Compliance
  **The Dynamic Indian GST Calculation & Arbitration Engine**

  [![Compliance](https://img.shields.io/badge/Compliance-Indian_GST-FF9933?style=flat)](#)
  [![Math](https://img.shields.io/badge/Math-Proportional_Discounting-blue?style=flat)](#)
  [![Audit](https://img.shields.io/badge/Audit-Immutable_Snapshots-success?style=flat)](#)
  
</div>

## 1. Executive Summary
Reshma-Core implements a highly dynamic, line-item level Tax Calculation Engine. Unlike basic e-commerce templates that apply a flat tax to a cart subtotal, this platform complies with strict Indian GST laws by calculating tax on the **Transaction Value** (post-discount price) and arbitrating Central vs. State vs. Integrated GST based on the business origin (West Bengal).

## 2. Tax Profiles & HSN Thresholds
Every product in the catalog strictly inherits a `taxProfile` and `hsnCode`. The engine dynamically resolves the tax rate based on government-defined thresholds.

| Tax Profile | Typical HSN | GST Logic |
| :--- | :--- | :--- |
| `IMITATION_JEWELLERY` | 7117 | Flat 3% |
| `LAC_JEWELLERY` | 7117 | Flat 0% (Exempt) |
| `UNSTITCHED_FABRIC` | 50-60 | Flat 5% |
| `FOOTWEAR` | 64 | Flat 12% |
| `GENERAL_ACCESSORY` | 4202 | Flat 18% |
| `STITCHED_APPAREL` | 61-62 | **Dynamic:** 5% if Transaction Value ≤ ₹2,500. 18% if > ₹2,500. |

## 3. Core Financial Algorithms

### A. Proportional Discounting (The Refund Exploit Fix)
If a user applies a flat ₹500 discount coupon to a multi-item cart, the engine does not subtract ₹500 at the end. Instead, it performs a **Two-Pass Calculation**:
1. It calculates the mathematical weight of each item relative to the cart's subtotal.
2. It proportionally distributes the ₹500 discount across all items.
3. *Why?* This ensures that if a user returns one item, the refund accurately reflects the discounted price of that specific item, preventing margin loss, and ensuring GST is calculated on the legally correct Transaction Value.

### B. State Arbitration (CGST/SGST vs IGST)
The platform origin is hardcoded to **West Bengal (WB)**. During checkout, the engine compares WB to the customer's shipping address state.
* **Intra-State (WB to WB):** The total tax is mathematically split 50/50 into CGST and SGST.
* **Inter-State (WB to Any Other State):** 100% of the tax is allocated to IGST.

### C. Shipping Service Tax
Logistics is classified as a service in India. The platform extracts an 18% inclusive GST from the shipping charge (e.g., if shipping is ₹100, Base is ₹84.74 and Tax is ₹15.26).

## 4. Immutable Tax Snapshotting
Tax laws change. To survive future government audits, the platform utilizes **Historical Immutability**. The exact `hsnCode`, `gstRate`, `cgst`, `sgst`, and `igst` numbers calculated at the millisecond of checkout are permanently frozen into the `Order` document's `items` array. If an admin deletes a product or the GST council changes a rate years later, past invoices remain mathematically intact.  

## 5. DPDP & GDPR Privacy Compliance Architecture

To comply with global data protection laws (including India's DPDP Act and Europe's GDPR), Reshma-Core implements "Legal Engineering" directly into the database and validation layers.

### Pillar 1: Immutable Consent Tracking
It is legally insufficient to simply display a "Privacy Policy" link on the frontend. The backend must independently verify and record user consent.

1. **The Legal Gatekeeper (`register.dto.ts`):** All registration requests must pass a Zod validation layer enforcing `acceptPrivacyPolicy: true`. If a bot or malicious actor attempts to bypass the frontend UI and hit the API directly without this boolean, the request is instantly rejected (400 Bad Request).
2. **The Immutable Ledger (`user.model.ts`):**
   Upon successful registration (both Local and Google OAuth), the `AuthService` stamps the exact server timestamp (`new Date()`) into `user.preferences.privacyPolicyAcceptedAt`. This serves as undeniable cryptographic proof of *when* a specific user consented to data collection, protecting the platform during legal audits.