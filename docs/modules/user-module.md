<div align="center">

  # User Domain Module
  
  **The foundational entity layer managing identity, security, and Role-Based Access Control (RBAC) for the Reshma-Core platform.**

  [![Mongoose](https://img.shields.io/badge/Mongoose-Schema_Driven-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/)
  [![Bcrypt](https://img.shields.io/badge/Bcrypt-Hash_Rounds:12-blue?style=flat)](https://www.npmjs.com/package/bcrypt)
  [![Zod](https://img.shields.io/badge/Zod-Type_Safety-3068b7?style=flat)](https://zod.dev/)

</div>

---

## Overview

The User Module (`src/modules/users/`) is the central source of truth for customer and administrator identities. It does not handle HTTP requests directly related to login/logout (that is delegated to the Auth Module). Instead, it defines the shape of the data, the security boundaries of the database document, and the internal methods used to manipulate user state.

---

## Schema Architecture

The `User` schema is strictly typed via a TypeScript interface (`IUser`) and enforced by Mongoose. It is logically divided into three data boundaries.

### 1. Identity & Profile Data
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `firstname` | String | Required, Trimmed | The user's given name. |
| `lastname` | String | Required, Trimmed | The user's family name. |
| `email` | String | Required, Unique, Lowercase | Primary indexing key and login identifier. |
| `phone` | String | Optional | Used for delivery notifications and alternative OTPs. |

### 2. Security & Access Control
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `password` | String | `select: false` | The bcrypt-hashed string. Hidden from all queries by default to prevent accidental payload leaks. |
| `role` | Enum | `USER`, `ADMIN` | Determines layout rendering and API endpoint access. Default is `USER`. |
| `authProvider`| Enum | `LOCAL`, `GOOGLE` | Tracks the origin of the account. Google accounts bypass standard password validation. |
| `isEmailVerified`| Boolean | Default: `false` | Gatekeeper flag. Must be true to issue an Access Token. |
| `isActive` | Boolean | Default: `true` | Used for "Soft Deletion". Setting to false bans the user without destroying relational order history. |

### 3. Telemetry & Analytics
| Field | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `lastLogin` | Date | Optional | Updated dynamically upon successful token issuance. |
| `timestamps` | Native | `createdAt`, `updatedAt` | Handled automatically by Mongoose options. |

---

## Model Behaviors & Hooks

To adhere to the "Fat Model, Skinny Controller" design pattern, cryptographic logic is baked directly into the Mongoose lifecycle.

### Pre-Save Hook (Cryptographic Hashing)
Before any `User` document is saved to MongoDB, the system intercepts the payload. 
1. It checks if the `password` field was modified (`this.isModified('password')`).
2. If true, it generates a salt and hashes the plaintext password using `bcrypt` (Cost Factor: 12).
3. This guarantees that a developer can never accidentally save a plaintext password to the database, even if they bypass the Auth Controller.

### Instance Method: `comparePassword`
A highly secure utility attached to the instantiated user document.
* **Signature:** `comparePassword(candidatePassword: string): Promise<boolean>`
* **Usage:** Used exclusively by the `AuthService` to validate login attempts against the stored hash securely without extracting the hash into the application memory.

---

## Integration Points

The User module acts as the root dependency for several other systems:
* **Auth Module:** Relies on the schema for token generation and OTP state changes.
* **Orders Module (Future):** Will reference the `ObjectId` to build relational shopping carts and checkout pipelines.
* **Notification Engine:** Pulls `firstname` and `email` directly from this model to construct personalized BullMQ email templates.

---
**Standard Documentation | Reshma-Core Architecture**