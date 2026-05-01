<div align="center">

  # User Identity & Logistics Module
  
  **The central hub for customer identity, address management, and account security.**

  [![Mongoose](https://img.shields.io/badge/Mongoose-Schema_Driven-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![Bcrypt](https://img.shields.io/badge/Bcrypt-Hash_Rounds:12-blue?style=flat)](https://www.npmjs.com/package/bcrypt)
  [![Zod](https://img.shields.io/badge/Zod-Type_Safety-3068b7?style=flat)](https://zod.dev/)
  [![Transactions](https://img.shields.io/badge/MongoDB-ACID_Transactions-47A248?style=flat&logo=mongodb&logoColor=white)](#)

</div>

---

## Overview

The User Module (`src/modules/users/`) has evolved from a simple authentication artifact into the central source of truth for customer identity and logistics. It mirrors the capabilities of enterprise platforms like Amazon by supporting granular profile mutability, a robust multi-address delivery system, and strictly enforced security boundaries for credential management.

---

## 1. Schema Architecture & Design Decisions

The `User` schema is strictly typed via the `IUser` interface. To optimize read operations, highly volatile but limited-size data is embedded directly into the root document.

### A. Identity & Profile Data
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `firstname` / `lastname` | String | Required, Trimmed | Core demographic identifiers. |
| `email` | String | Unique, Lowercase | Primary indexing key. |
| `phone` | String | Optional, Unique | Used for delivery coordination (e.g., Delhivery APIs). |
| `avatar` | String | URL | Secure Cloudinary CDN link to the user's profile picture. |
| `gender` / `dob` | Enum / Date | Optional | Demographic telemetry for future targeted marketing. |

### B. The Embedded Address Book (Logistics)
Instead of creating a separate `Addresses` collection, the system embeds an array of `AddressSchema` directly inside the `User` document.

* **Why Embedded?** A standard e-commerce user rarely exceeds 5-10 saved addresses. Embedding guarantees that fetching a user's profile and their entire logistics dataset requires only a single, highly performant disk read.
* **Document Bloat Protection:** The service layer hard-caps the address array at a maximum of 10 items to prevent malicious actors from approaching the MongoDB 16MB document limit.

| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `street` / `city` / `state` | String | Required | Standard geographic descriptors. |
| `pincode` | String | Regex Validated | Strictly enforces 6-digit Indian postal codes. |
| `label` | Enum | `HOME`, `WORK`, `OTHER` | UI categorization tags. |
| `isDefault` | Boolean | Default: `false` | Used by the frontend to pre-select shipping locations during checkout. |

---

## 2. Core Business Logic & Workflows

### The Default Address Toggle (Atomic Transactions)
Managing the "Default Address" state is a complex operation. If a user sets a new address as `isDefault: true`, the system must simultaneously remove the default flag from the previous address.

**The Workflow:**
1. The User requests to add/update an address with `isDefault: true`.
2. The Service layer initiates a **MongoDB ACID Session**.
3. A `.forEach` loop iterates over the embedded `addresses` array, explicitly setting `isDefault = false` for all existing sub-documents.
4. The target address is then set to `true`.
5. The session is committed atomically. If any part of the operation fails, the entire transaction rolls back, preventing a state where a user has zero (or two) default addresses.

### Step-Up Authentication (Password Mutation)
Password updates are protected by bank-level "Step-Up Authentication." To prevent session hijacking (e.g., an attacker using an unlocked computer), changing a password requires a two-factor cryptographic handshake:
1. **Email OTP:** The system generates a 6-digit OTP, caches it in Redis (10m TTL), and dispatches it via the Notification Queue.
2. **Current Password Validation:** The payload must include the OTP *and* the current plaintext password. The service executes a `bcrypt.compare()` handshake against the database before permitting the mutation. 
*(Note: Google OAuth accounts are strictly blocked from this endpoint).*

---

## 3. Security Boundaries & Protection

### The Zod Mass Assignment Firewall
A common vulnerability in Node.js applications is "Mass Assignment," where a user injects restricted fields (like `role: "ADMIN"` or `loyaltyPoints: 99999`) into a profile update payload.

The User Module prevents this entirely using `z.object({...}).strict()` DTOs. If a payload contains *any* property not explicitly permitted by the schema, the request is instantly rejected at the routing layer before reaching the business logic.

### Memory-Stream Avatars
When a user updates their profile picture, the `multipart/form-data` is intercepted by the Multer middleware. Instead of saving the image to the server's local disk (which causes storage bloat and latency), the raw memory buffer is piped directly to the Cloudinary API via our custom `uploadBufferToCloudinary` utility.

---

## 4. Integration Points

The User module acts as the root dependency for several other systems:
* **Notification Engine:** The User Service delegates security alerts (OTP requests and Password Update Confirmations) to the `NotificationService`. 
  * *Performance Note:* Security alerts trigger both async BullMQ emails and synchronous DB inserts. To prevent DB latency from bottlenecking the HTTP response, the User Module relies on "Fire-and-Forget" un-awaited Promises for the In-App "Bell Icon" notifications.
* **Auth Module:** Relies on the schema for token generation, OTP state changes, and initial registration.
* **Orders Module (Future):** Will reference the embedded `isDefault` address to pre-fill the checkout shipping payload.
* **Cloudinary Config:** Utilizes the storage utility to stream avatar image buffers.

---
**Standard Documentation | Reshma-Core Architecture**