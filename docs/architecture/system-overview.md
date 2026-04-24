<div align="center">

  # System Overview & Architecture Index
  
  **The master blueprint and navigation hub for the Reshma-Core Backend.**

  [![Node.js](https://img.shields.io/badge/Architecture-Domain--Driven_Design-43853D?style=flat&logo=node.js&logoColor=white)](#)
  [![MongoDB](https://img.shields.io/badge/Database-Polymorphic_NoSQL-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/State-Stateless_JWT_%2B_Redis-DC382D?style=flat&logo=redis&logoColor=white)](#)

</div>

---

## 1. Core Architectural Philosophy

Reshma-Core is built to scale gracefully while handling highly diverse e-commerce requirements. The backend enforces the following technical standards:

1. **Domain-Driven Design (DDD):** Code is logically grouped by business feature (Users, Auth, Products) rather than technical layers (Controllers, Models).
2. **Strict Type Safety:** Zod enforces runtime payload validation at the Controller boundary, while strict TypeScript ensures compile-time safety.
3. **Fail-Fast Initialization:** The system refuses to boot if critical environment variables (like JWT secrets or MongoDB URIs) are missing or malformed.
4. **Polymorphic Database Strategy:** Utilizing Mongoose Discriminators, disparate items (e.g., Glass Bangles and Unstitched Fabrics) share a common `Products` collection while enforcing strictly unique validation rules.

---

## 2. Master Documentation Index

Use the links below to navigate the internal documentation of the Reshma-Core system. 

### Architecture Diagrams & Security
High-level system design, security protocols, and database schemas.
* **[Authentication & Security Architecture](./auth-architecture.md)** *(Two-Token JWT, Google OAuth, OTP Flows)*
* **[Database Design Strategy](./database-design.md)** *(Polymorphic Schema Mapping & ADRs)*
* **[Product Catalog Schema](./product-catalog.md)** *(Google Sheet Data to Database Mapping)*
* **[Security Hardening Guide](./security-hardening.md)** *(Helmet, Rate Limiting, Zod Payload Firewalls)*

### Domain Modules
Deep dives into the specific business logic, DTOs, and services for each core feature.
* **[Product Module](../modules/product-module.md)** *(Catalog Engine, Cloudinary Rollbacks, Discriminators)*
* **[User Module](../modules/user-module.md)** *(Identity, RBAC, Password Hashing)*
* **[Authentication Module](../modules/auth-module.md)** *(Login, Registration, Token Issuance)*
* **[Notification Engine](../modules/notification-module.md)** *(BullMQ Background Workers, SMTP, In-App Alerts)*

### API Standards & Testing
Rules for RESTful communication and Postman/Thunder Client testing protocols.
* **[API Design Standards](../api/api-standards.md)** *(Two-Token frontend integration & payload shapes)*
* **[Global Error Codes](../api/error-codes.md)** *(Standardized HTTP responses & error handling)*
* **[Authentication Testing Runbook](../testing/auth-runbook.md)** *(Manual integration testing guide)*

### Setup & Deployment
Runbooks for getting the server running locally or deploying to production.
* **[Local Development Setup](../setup/local-development.md)** *(Node, Mongo, Redis Boot Guide)*
* **[Environment Variables Guide](../setup/environment-variables.md)** *(Zod Validation & .env maps)*

---

## 3. Implementation Roadmap

The development of Reshma-Core is divided into four major epics. 

### Phase 1: The Foundation (Completed)
- [x] Environment validation & Fail-Fast server boot.
- [x] Global Error Handling & Zod Interceptors.
- [x] User Domain Schema & RBAC integration.
- [x] Two-Token Authentication (JWT + HttpOnly Cookies).
- [x] Google OAuth (Client-Side Token Flow) Integration.
- [x] Background Notification Engine (BullMQ + Redis).

### Phase 2: The Core Catalog Engine (Completed)
- [x] Base `Product` schema implementation.
- [x] Mongoose Discriminators for custom categories (Bangles, Apparel, Fabrics).
- [x] Cloudinary integration for product image pipelines (Memory Buffers & Rollbacks).
- [x] Category & Inventory tracking modules.

### Phase 3: The Transaction Pipeline (Up Next)
- [ ] Cart management (Syncing local state with DB).
- [ ] Dynamic Checkout Math Engine (GST, COD fees, Heavy Shipping).
- [ ] Razorpay Payment Gateway integration.
- [ ] Order generation & status Webhooks.

### Phase 4: Operations & Analytics
- [ ] Return Arbitration Engine (Cloudinary photographic proof requirement).
- [ ] Admin Dashboard aggregations (Sales volume, top-selling categories).

---
*Maintained by Md Afzal Ansari | Core System Architecture*