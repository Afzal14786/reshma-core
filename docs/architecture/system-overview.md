<img src="../../src/assets/banner.png" alt="Reshma Bangles & Boutique - API Core" style="width: 100%; display: block; margin: 0;" />
<br/>

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

1. **Domain-Driven Design (DDD):** Code is logically grouped by business feature (Users, Auth, Products) rather than technical layers.
2. **Strict Type Safety:** Zod enforces runtime payload validation at the Controller boundary, while strict TypeScript ensures compile-time safety.
3. **Fail-Fast Initialization:** The system refuses to boot if critical environment variables are missing or malformed.
4. **Polymorphic Database Strategy:** Using Mongoose discriminators, disparate items (e.g., Glass Bangles and Unstitched Fabrics) share a common `Products` collection while enforcing strictly unique validation rules.

---

## 2. Master Documentation Index

Use the links below to navigate the internal documentation of the Reshma-Core system.

### Architecture Diagrams & Security
High-level system design, security protocols, and database schemas.

* **[Authentication & Security Architecture](./auth-architecture.md)** – Two‑token JWT, Google OAuth, OTP flows.
* **[Database Design & Polymorphic Catalog](./database-design.md)** – Single‑collection polymorphism, discriminators, indexes.
* **[Product Catalog Schema](./product-catalog.md)** – Field‑by‑field mapping for bangles, apparel, fabrics, etc.
* **[Security Hardening](./security-hardening.md)** – Helmet, rate limiting, Zod firewalls, CodeQL mitigations.
* **[Middleware & Validation](./middleware-and-validation.md)** – Request lifecycle, sanitisation, distributed rate limiting.
* **[Payment Integration (Razorpay)](./payment-integration.md)** – HMAC‑SHA256, ACID transactions, webhooks.
* **[Legal & Tax Compliance](./legal-tax-compliance.md)** – Dynamic Indian GST, proportional discounting, DPDP/GDPR.
* **[Edge Cache](./edge-cache.md)** – Redis proxy pattern, cache invalidation, thundering herd protection.
* **[Background Jobs & Cron](./background-jobs-and-cron.md)** – BullMQ queues, email/invoice/export workers, Redis distributed locks.
* **[Logistics & Shipping](./logistics-and-shipping.md)** – Shiprocket integration, rolling JWT, webhook state machine.
* **[Media & Storage](./media-and-storage.md)** – Cloudinary memory‑stream uploads, orphan cleanup.
* **[DevOps & Infrastructure](./devops-and-infrastructure.md)** – Horizontal scaling, graceful shutdown, Docker, logging.

### Domain Modules
Deep dives into specific business logic, DTOs, and services.

* **[User Module](../modules/user-module.md)** – Identity, RBAC, password hashing, address book.
* **[Authentication Module](../modules/auth-module.md)** – Login, registration, token issuance.
* **[Notification Engine](../modules/notification-module.md)** – BullMQ workers, SMTP, in‑app alerts.
* **[Product Module](../modules/product-module.md)** – Catalog engine, Cloudinary rollbacks, discriminators.
* **[Cart Module](../modules/cart-module.md)** – Dynamic pricing, attribute hashing, guest merging.
* **[Order Module](../modules/order-module.md)** – Atomic checkout, payment webhooks, Shiprocket dispatch.
* **[Return Module](../modules/return-module.md)** – RMA state machine, Razorpay refunds, atomic restocks.
* **[Interaction Module](../modules/interaction-module.md)** – Threaded comments, async aggregation, verified purchases.
* **[Coupon Module](../modules/coupon-module.md)** – Temporal firewalls, cart auto‑recalculation, TOCTOU defence.
* **[Wishlist Module](../modules/wishlist-module.md)** – Lazy initialisation, atomic arrays, move‑to‑cart pipeline.
* **[Search Module](../modules/search-module.md)** – Typesense RAM cluster, eventual consistency, faceted discovery.
* **[Dashboard Module](../modules/dashboard-module.md)** – MongoDB `$facet` aggregations, financial reporting.
* **[Support Module](../modules/support-module.md)** – Polymorphic ticketing, threaded conversations, privacy anonymisation.
* **[Health Module](../modules/health-module.md)** – Deep liveness probes, dependency checks.

### API Standards & Testing
Rules for RESTful communication and manual runbooks.

* **[API Design Standards](../api/README.md)** – Frontend integration & payload shapes.
* **[Global Error Codes](../api/error-codes.md)** – Standardised HTTP responses.
* **[Auth Runbook](../api/thunder-tests/auth-runbook.md)** – Manual integration testing.
* **[Product Runbook](../api/thunder-tests/product-runbook.md)** – Polymorphic creation and image uploads.
* *(Other runbooks are available under `docs/api/thunder-tests/`)*

### Setup & Deployment
Guides for local development and production.

* **[Local Development Setup](../getting-started/local-development.md)** – Node, MongoDB, Redis boot guide.
* **[Environment Variables Guide](../getting-started/environment-variables.md)** – Zod validation & `.env` mapping.
* **[Database Seeding](../getting-started/database-seeding.md)** – Generating 500 realistic products.

---

## 3. Implementation Roadmap

The development of Reshma-Core is divided into five major phases (all completed).

### Phase 1: The Foundation (Completed)
- [x] Environment validation & fail‑fast server boot.
- [x] Global error handling & Zod interceptors.
- [x] User domain schema & RBAC.
- [x] Two‑token authentication (JWT + HttpOnly cookies).
- [x] Google OAuth (client‑side token flow).
- [x] Background notification engine (BullMQ + Redis).

### Phase 2: The Core Catalog Engine (Completed)
- [x] Base `Product` schema.
- [x] Mongoose discriminators for bangles, apparel, fabrics, etc.
- [x] Cloudinary image pipeline (memory buffers & rollbacks).
- [x] Category & inventory tracking.

### Phase 3: The Transaction Pipeline (Completed)
- [x] Cart management (guest merge, live pricing).
- [x] Dynamic checkout math (GST, shipping).
- [x] Razorpay payment gateway integration.
- [x] Order generation & status webhooks.

### Phase 4: Operations & Analytics (Completed)
- [x] Return arbitration engine.
- [x] Interaction engine (reviews, comments, voting).
- [x] Admin dashboard aggregations (sales, top products).

### Phase 5: Production Hardening & Scalability (Completed)
- [x] Legal & financial compliance (line‑item GST, immutable snapshots).
- [x] Edge cache & workers (Redis proxy, BullMQ PDF generation).
- [x] DevOps & infrastructure (distributed rate limiting, deep health checks, NoSQL defence).

---

*Maintained by Md Afzal Ansari | The Reshma-Core Team*  