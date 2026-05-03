<div align="center">

  # System Overview & Architecture Index
  
  **The master blueprint and navigation hub for the Reshma-Core Backend.**

  [![Node.js](https://img.shields.io/badge/Architecture-Domain--Driven_Design-43853D?style=flat&logo=node.js&logoColor=white)](#)
  [![MongoDB](https://img.shields.io/badge/Database-Polymorphic_NoSQL-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/State-Stateless_JWT_%2B_Redis-DC382D?style=flat&logo=redis&logoColor=white)](#)

</div>

---

## 1. Core Architectural Philosophy

Reshma-Core is built to scale gracefully while handling highly diverse e-commerce requirements[cite: 2]. The backend enforces the following technical standards:

1. **Domain-Driven Design (DDD):** Code is logically grouped by business feature (Users, Auth, Products) rather than technical layers (Controllers, Models)[cite: 2].
2. **Strict Type Safety:** Zod enforces runtime payload validation at the Controller boundary, while strict TypeScript ensures compile-time safety[cite: 2].
3. **Fail-Fast Initialization:** The system refuses to boot if critical environment variables (like JWT secrets or MongoDB URIs) are missing or malformed[cite: 2].
4. **Polymorphic Database Strategy:** Utilizing Mongoose Discriminators, disparate items (e.g., Glass Bangles and Unstitched Fabrics) share a common `Products` collection while enforcing strictly unique validation rules[cite: 2].

---

## 2. Master Documentation Index

Use the links below to navigate the internal documentation of the Reshma-Core system. 

### Architecture Diagrams & Security
High-level system design, security protocols, and database schemas.
* **[Authentication & Security Architecture](./auth-architecture.md)** *(Two-Token JWT, Google OAuth, OTP Flows)*[cite: 2]
* **[Database Design Strategy](./database-design.md)** *(Polymorphic Schema Mapping & ADRs)*[cite: 2]
* **[Product Catalog Schema](./product-catalog.md)** *(Google Sheet Data to Database Mapping)*[cite: 2]
* **[Security Hardening Guide](./security-hardening.md)** *(Helmet, Rate Limiting, Zod Payload Firewalls)*[cite: 2]
* **[Payment Integration Architecture](./payment-integration.md)** *(HMAC-SHA256 Cryptographic Handshakes, ACID Transaction Integrity, and Idempotency Guards)*[cite: 2]

### Domain Modules
Deep dives into the specific business logic, DTOs, and services for each core feature.
* **[User Module](../modules/user-module.md)** *(Identity, RBAC, Password Hashing)*
* **[Authentication Module](../modules/auth-module.md)** *(Login, Registration, Token Issuance)*
* **[Notification Engine](../modules/notification-module.md)** *(BullMQ Background Workers, SMTP, In-App Alerts)*
* **[Product Module](../modules/product-module.md)** *(Catalog Engine, Cloudinary Rollbacks, Discriminators)*
* **[Cart Module](../modules/cart-module.md)** *(Dynamic Pricing, Attribute Hashing, Guest Merging)*
* **[Order Module](../modules/order-module.md)** *(Atomic Checkout, Payment Webhooks, State Machine)*
* **[Return Module](../modules/return-module.md)** *(RMA State Machine, Razorpay Refunds, Atomic Restocks)*

### API Standards & Testing
Rules for RESTful communication and Postman/Thunder Client testing protocols.
* **[API Design Standards](../api/api-standards.md)** *(Two-Token frontend integration & payload shapes)*[cite: 2]
* **[Global Error Codes](../api/error-codes.md)** *(Standardized HTTP responses & error handling)*[cite: 2]
* **[Authentication Testing Runbook](../testing/auth-runbook.md)** *(Manual integration testing guide)*[cite: 2]

### Setup & Deployment
Runbooks for getting the server running locally or deploying to production.
* **[Local Development Setup](../setup/local-development.md)** *(Node, Mongo, Redis Boot Guide)*[cite: 2]
* **[Environment Variables Guide](../setup/environment-variables.md)** *(Zod Validation & .env maps)*[cite: 2]

---

## 3. Implementation Roadmap

The development of Reshma-Core is divided into four major epics. 

### Phase 1: The Foundation (Completed)
- [x] Environment validation & Fail-Fast server boot[cite: 2].
- [x] Global Error Handling & Zod Interceptors[cite: 2].
- [x] User Domain Schema & RBAC integration[cite: 2].
- [x] Two-Token Authentication (JWT + HttpOnly Cookies)[cite: 2].
- [x] Google OAuth (Client-Side Token Flow) Integration[cite: 2].
- [x] Background Notification Engine (BullMQ + Redis)[cite: 2].

### Phase 2: The Core Catalog Engine (Completed)
- [x] Base `Product` schema implementation[cite: 2].
- [x] Mongoose Discriminators for custom categories (Bangles, Apparel, Fabrics)[cite: 2].
- [x] Cloudinary integration for product image pipelines (Memory Buffers & Rollbacks)[cite: 2].
- [x] Category & Inventory tracking modules[cite: 2].

### Phase 3: The Transaction Pipeline (Completed)
- [x] Cart management (Syncing local state with DB)[cite: 2].
- [x] Dynamic Checkout Math Engine (GST, shipping fees)[cite: 2].
- [x] Razorpay Payment Gateway integration[cite: 2].
- [x] Order generation & status Webhooks[cite: 2].

### Phase 4: Operations & Analytics (In Progress)
- [x] Return Arbitration Engine (Phase 8 Implementation).
- [ ] Admin Dashboard aggregations (Sales volume, top-selling categories).

---
*Maintained by Md Afzal Ansari | Core System Architecture*