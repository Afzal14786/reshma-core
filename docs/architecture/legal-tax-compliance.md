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
If a user applies a flat ₹500 discount coupon to a multi-item cart, the engine does not subtract ₹500 at the end. Instead, it performs a **Two-Pass Calculation** and enforces a **Proportional Discount Ratio:**

1. **Discount Ratio Calculation:** The `ReturnService.initiateReturn` method mathematically calculates a `discountRatio` defined as `Amount Paid / Raw Subtotal`. 
2. **Line-Item Distribution:** This ratio is applied to the `priceAtPurchase` of each item. For example, if a user paid ₹2,000 for a ₹2,500 cart, the ratio is 0.8. A returned ₹1,000 item results in a legally accurate ₹800 refund.  
3. **Audit Integrity:** This ensures that if a user returns one item, the refund accurately reflects the exact 'Consideration' paid for that specific item, preventing margin loss and ensuring GST is calculated on the legally correct Transaction Value. 


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

### Pillar 2: The Right to be Forgotten (Anonymization Engine)
Under DPDP/GDPR, users have the legal right to request complete account deletion. However, this creates a direct conflict with corporate tax law: if an e-commerce platform deletes past orders, its financial reporting becomes fraudulent.

Reshma-Core solves this using a **Transactional Anonymization Engine**:
1. **The Master Saga (`UserService.deleteAccount`):** The entire deletion process is wrapped in a MongoDB ACID Transaction (`ClientSession`). If any step fails, the entire deletion rolls back, preventing corrupted ghost states.
2. **Ephemeral State Wiping:** The system permanently drops capacity-heavy but non-financial records, specifically the user's `Cart` and `Wishlist`.
3. **Financial Math Preservation (`OrderService.anonymizeUserOrders` and `SupportService.anonymizeUserTickets`):** Past orders are **not** deleted and Support conversations are redacted to protect QA analytics while destroying PII. Instead, the system irreversibly scrambles the shipping PII (Personally Identifiable Information). For example, `fullName` becomes "Deleted User" and the specific address is redacted. The `totalAmount` and product data remain perfectly intact for tax audits.
4. **Client-Side Revocation:** The API automatically sends a `clearCookie` command to the client's browser, physically destroying the `refresh_token` and guaranteeing immediate session termination.  

### Pillar 3: Data Portability (The Right to Access)
Under DPDP/GDPR, users have the legal right to request a machine-readable copy of all personal data held by the platform. 

In an e-commerce ecosystem, synchronously compiling years of user history (orders, wishlists, reviews) would block the Node.js main thread and result in HTTP 504 Gateway Timeouts. Reshma-Core solves this using an asynchronous **"Google Takeout" Architecture**:

1. **The Fire-and-Forget Trigger (`POST /api/v1/users/profile/export`):** The Express API instantly accepts the request, drops the `userId` into a Redis queue, and returns a `202 Accepted` within 10 milliseconds.
2. **The Background Compiler (`export.worker.ts`):** A BullMQ worker picks up the job on a separate thread. It runs a `Promise.all()` to concurrently fetch the user's Profile, Orders, Carts, Wishlists, Interactions, and **Support Tickets** directly from MongoDB.
3. **Memory Transformation:** The worker sanitizes the data (stripping internal fields like password hashes) and compiles it into a structured JSON string.
4. **Secure Delivery:** The system passes the stringified payload to the Notification Engine, which uses Nodemailer to dynamically attach it as a `data-export.json` file and emails it securely to the user.