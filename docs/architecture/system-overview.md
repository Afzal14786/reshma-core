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
* **[Payment Integration Architecture](./payment-integration.md)** *(HMAC-SHA256 Cryptographic Handshakes, ACID Transaction Integrity, and Idempotency Guards)* 
* **[Legal & Tax Compliance](./legal-tax-compliance.md)** *(Dynamic Indian GST Engine, State Arbitration, Proportional Discounting)*

### Domain Modules
Deep dives into the specific business logic, DTOs, and services for each core feature.
* **[User Module](../modules/user-module.md)** *(Identity, RBAC, Password Hashing)*
* **[Authentication Module](../modules/auth-module.md)** *(Login, Registration, Token Issuance)*
* **[Notification Engine](../modules/notification-module.md)** *(BullMQ Background Workers, SMTP, In-App Alerts)*
* **[Product Module](../modules/product-module.md)** *(Catalog Engine, Cloudinary Rollbacks, Discriminators)*
* **[Cart Module](../modules/cart-module.md)** *(Dynamic Pricing, Attribute Hashing, Guest Merging)*
* **[Return Module](../modules/return-module.md)** *(RMA State Machine, Razorpay Refunds, Atomic Restocks)*  
* **[Interaction Module](../modules/interaction-module.md)** *(Threaded Comments, Async Aggregation, Verified Purchases)*
* **[Coupon Module](../modules/coupon-module.md)** *(Temporal Firewalls, Cart Auto-Recalculation, TOCTOU Defense)*
* **[Wishlist Module](../modules/wishlist-module.md)** *(Lazy Initialization, Atomic Arrays, Move-to-Cart Pipeline)*
* **[Order Module](../modules/order-module.md)** *(Atomic Checkout, Payment Webhooks, Shiprocket 3PL Dispatch, Delivery Automation)*
* **[Search Module](../modules/search-module.md)** *(Typesense RAM Cluster, Eventual Consistency, Faceted Discovery)*
* **[Dashboard Module](../modules/dashboard-module.md)** *(MongoDB $facet aggregations, Financial Reporting, Inventory Alerts)* 

### API Standards & Testing
Rules for RESTful communication and Postman/Thunder Client testing protocols.

* **[API Design Standards](../api/api-standards.md)** *(Frontend integration & payload shapes)*
* **[Global Error Codes](../api/error-codes.md)** *(Standardized HTTP responses & error handling)*
* **[Auth Runbook](../api/thunder-tests/auth-runbook.md)** *(Manual integration testing guide)*
* **[Catalog Runbook](../api/thunder-tests/product-runbook.md)** *(Polymorphic creation and image uploads)*
* **[Coupon Runbook](../api/thunder-tests/coupon-runbook.md)** *(Discount logic and cart hooks)*
* **[Interaction Runbook](../api/thunder-tests/interaction-runbook.md)** *(Reviews, threaded comments, and voting)*
* **[Return Runbook](../api/thunder-tests/return-runbook.md)** *(RMA arbitration and refund processing)*
* **[Wishlist Runbook](../api/thunder-tests/wishlist-runbook.md)** *(Lazy initialization and cart transfers)*
* **[Order & Logistics Runbook](../api/thunder-tests/order-runbook.md)** *(Checkout, Shiprocket Dispatch, and Webhook Simulation)*
* **[Search Runbook](../api/thunder-tests/search-runbook.md)** *(Typo-tolerance, pagination, and filter simulations)*
* **[Dashboard Runbook](../api/thunder-tests/dashboard-runbook.md)** *(Admin metric fetching and date-range validation)*

### Setup & Deployment
Runbooks for getting the server running locally or deploying to production.
* **[Local Development Setup](../setup/local-development.md)** *(Node, Mongo, Redis Boot Guide)*[cite: 2]
* **[Environment Variables Guide](../setup/environment-variables.md)** *(Zod Validation & .env maps)*[cite: 2]

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

### Phase 3: The Transaction Pipeline (Completed)
- [x] Cart management (Syncing local state with DB).
- [x] Dynamic Checkout Math Engine (GST, shipping fees).
- [x] Razorpay Payment Gateway integration.
- [x] Order generation & status Webhooks.

### Phase 4: Operations & Analytics (Completed)
- [x] Return Arbitration Engine (Phase 8 Implementation).
- [x] Interaction Engine (Phase 9 Implementation).
- [x] Admin Dashboard aggregations (Sales volume, top-selling categories).  

### Phase 5: Production Hardening & Scalability (In Progress)
- [x] Epic 1: Legal & Financial Compliance (Dynamic Line-Item GST, Immutable Snapshots).
- [ ] Epic 2: The Edge Cache & Workers (Redis Caching, BullMQ PDF Generation).
- [ ] Epic 3: DevOps & Infrastructure (Graceful Shutdowns, Distributed Rate Limiting, Health Checks).

---
*Maintained by Md Afzal Ansari | Core System Architecture*