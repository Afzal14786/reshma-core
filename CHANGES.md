# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
*(Changes that are currently being worked on but not yet pushed to a stable alpha/beta tag will go here).*

**Webhooks & Inventory Defragmentation (Phase 5.1)**
- **Asynchronous Payment Webhooks (`order.public.controller.ts`):** Established a secure, server-to-server webhook endpoint to catch Razorpay `order.paid` events, ensuring fulfillment even if the client disconnects prematurely.
- **Strict Webhook Typings (`order.interface.ts`):** Engineered the `IRazorpayWebhookBody` interface to strictly parse incoming gateway payloads without bypassing the TypeScript compiler.
- **Inventory Recovery Worker (`order-recovery.cron.ts`):** Deployed a `node-cron` background worker that sweeps the database every 15 minutes, utilizing ACID transactions to atomically restore locked physical inventory from abandoned carts.

### Fixed
- **Type Safety Enforcement:** Eradicated all instances of forced type bypassing across the Order and Notification controllers, replacing them with mathematically safe `unknown` cascading and Mongoose `ObjectId` assertions.  

### Added
**Orders, Payments & Automated Fulfillment (Phase 5)**
- **ACID-Compliant Checkout Engine (`order.service.ts`):** Engineered a high-integrity checkout pipeline using MongoDB Multi-Document Transactions (`startSession`) to guarantee atomic stock reservation and automated rollbacks on failure.
- **Razorpay Financial Integration:** Integrated the official Razorpay SDK with a "Non-Trust Frontend" architecture, enforcing backend HMAC SHA-256 cryptographic signature verification for all payment payloads.
- **On-the-Fly PDF Invoicing (`invoice.generator.ts`):** Developed a memory-efficient billing system using `pdfkit` that generates GST-compliant Tax Invoices as binary buffers, streaming them directly to the user to avoid server-side storage bloat.
- **Historical Data Snapshotting:** Implemented a deep-copy mechanism in the `Order` model to freeze product prices, names, and attributes at the exact moment of purchase, ensuring audit integrity against future catalog changes.
- **Automated Logistics Pipeline:** Hooked the Order State Machine into the BullMQ Notification Engine. Transitioning an order to `SHIPPED` now automatically dispatches asynchronous tracking emails and persistent in-app dashboard alerts.
- **Performance Indexing:** Deployed compound MongoDB indexes on `orderStatus`, `paymentStatus`, and `orderNumber` to optimize administrative fulfillment dashboards and customer order history lookups.

### Fixed
- **Type Safety Collapse:** Resolved a critical TypeScript `never` type cascade in the Order Service by strictly mapping `Map` subdocuments and respecting `exactOptionalPropertyTypes` constraints.
- **IDOR Vulnerability (Invoices):** Fortified the invoice download endpoint by enforcing a strict ownership check, ensuring users can only trigger PDF generation for orders bound to their specific `userId`.
- **Logistics Data Integrity:** Fixed a missing model import and invalid `.select()` syntax in the `OrderAdminController` that was preventing the automated shipping notification trigger.

### Changed
- **Notification Facade Expansion:** Updated the `NotificationService` and `email.interface.ts` to support the `ORDER_SHIPPED` event type using strict TypeScript Discriminated Unions for payload accuracy.
- **Routing Security:** Tiered the Order routes to prioritize `checkoutLimiter` (anti-carding protection) and `validate` (NoSQL firewall) before hitting the expensive ACID transaction logic.  


### Added
**Cart & Checkout Pre-Processing (Phase 3)**
- **Dynamic Cart Engine (`cart.service.ts`):** Engineered a stateful cart module that cross-references live product prices, calculates total payload weight (`totalWeightGrams`), and actively filters out deactivated inventory.
- **Deterministic Attribute Hashing:** Implemented a signature generation algorithm to intelligently group identical product variations (e.g., Size: M, Color: Red) to prevent cart duplication.
- **Guest Cart Merging (`cart.controller.ts`):** Built a non-destructive merge system that synchronizes unauthenticated frontend `localStorage` carts with the user's persistent database cart upon login, enforcing strict stock limit capping.

**Enterprise Security & CI/CD Hardening (Phase 4)**
- **Static Application Security Testing (SAST):** Integrated GitHub CodeQL workflows (`codeql.yml`) to automatically scan Pull Requests for logical vulnerabilities.
- **Supply Chain Automation (SCA):** Configured Dependabot (`dependabot.yml`) for weekly automated dependency auditing and patch management.
- **Continuous Integration:** Implemented an automated Prettier formatting pipeline (`format-check.yml`) enforcing a unified codebase style.
- **Repository Compliance:** Authored public-facing vulnerability reporting protocols (`SECURITY.md`) and standardized Pull Request templates.

### Fixed
**Vulnerability Remediations (CodeQL)**
- **NoSQL Injection (CWE-89):** Eradicated object-injection vulnerabilities across Product, Cart, and Auth services by wrapping dynamic query variables in strict `$eq` operators and enforcing `String()` casting.
- **Prototype Pollution (CWE-250):** Hardened the `ProductService` update pipeline by initializing payload dictionaries via `Object.create(null)` and physically stripping `__proto__` and `constructor` keys to prevent Remote Property Injection.
- **Auth Bypass (CWE-807):** Transitioned the core `protect` middleware from reading raw cookies to evaluating cryptographically validated `req.signedCookies`, closing user-controlled authentication bypass vectors.
- **Denial of Service (CWE-770):** Shielded expensive database and cryptographic execution paths by deploying strict route-level rate limiters (`authLimiter`, `standardLimiter`) in front of protected Auth, Cart, Product, and Notification endpoints.

### Changed
- **Authentication Pipeline:** Initialized `cookie-parser` with a cryptographic secret in `app.ts` to support the new Signed Cookie security architecture.
- **Core Configuration:** Overhauled Zod environment validation to enforce stricter server boot requirements.
- **Dependencies:** Added `prettier` as a devDependency and integrated the project-wide `.prettierrc` configuration.

### Added
**Authentication & Security**
- **Two-Token Architecture (`auth.utils.ts`):** Engineered a highly secure session system utilizing short-lived Access Tokens and long-lived `HttpOnly` Refresh Tokens.
- **OTP Verification Flow (`verify-otp.dto.ts`):** Built an asynchronous Node `crypto` OTP system backed by Redis caching with safe collision recovery.
- **Zod Validation (`login.dto.ts`, `register.dto.ts`):** Enforced strict payload sanitization before reaching the Auth controllers.
- **Auth Middleware (`auth.middleware.ts`):** Implemented the `protect` middleware for cryptographically verifying JWTs and cross-referencing the Redis Blacklist.

**Notification Engine (BullMQ & SMTP)**
- **Queue Workers (`email.queue.ts`, `email.worker.ts`):** Implemented a Redis-backed producer/consumer queue to completely offload SMTP handshakes from the main event loop.
- **Email Templates (`layout.ts`, `otp-verification.ts`, `welcome.ts`):** Built a strictly-typed HTML email compiler using the Facade design pattern (`notification.service.ts`).
- **In-App Alerts (`notification.model.ts`):** Created a persistent MongoDB collection for user-specific dashboard alerts with IDOR protection on read receipts.

**Documentation Architecture**
- **Master Docs Hub (`/docs`):** Migrated from root-level text files to a dedicated, Domain-Driven documentation directory including `auth-architecture.md`, `system-overview.md`, and module-specific runbooks.

### Changed
- **Core Configuration (`app.ts`, `server.ts`, `env.ts`):** Hooked up the BullMQ workers to the server boot sequence and expanded the Zod strict environment validation.
- **Dependencies (`package.json`):** Added required packages for authentication, Redis queues, and email transport.
- **Readme (`README.md`):** Overhauled the system architecture folder tree and added routing to the new internal documentation hub.  

### Added
- **Type Definitions:** Extended the global Express `Request` interface (`express.d.ts`) to inject the `IUser` model, enabling deep IntelliSense across all secure routes.
- **Identity & RBAC:** Implemented the `protect` middleware for cryptographically verifying JWTs (supporting both HttpOnly cookies and Bearer headers), and the `restrictTo` middleware for Role-Based Access Control.
- **Traffic Control:** Deployed tiered rate limiters (`standardLimiter`, `authLimiter`, `checkoutLimiter`) to mitigate card testing and brute-force bot attacks.
- **Data Validation:** Built a generic Zod validation interceptor that strictly parses incoming requests and strips malicious payload injections before they reach the controllers.


### Added
- **Core Infrastructure:** Integrated MongoDB (Mongoose), Redis client, and Cloudinary configurations.
- **Environment Validation:** Added strict startup validation using Zod (`env.ts`) to immediately catch missing environment variables and prevent silent failures.
- **Logging Pipeline:** Implemented an enterprise-grade Winston logger featuring daily log rotation, piped directly into Morgan for HTTP traffic monitoring.
- **Data Models:** Built the highly-scalable `User` schema and strict TypeScript interface. Utilized sparse indexes to support upcoming Google OAuth integration, and intentionally isolated transactional data to prevent document bloat.
- **Global Utilities:** Implemented standardized `AppError` and `ApiResponse` classes to guarantee consistent JSON payloads and error handling across all frontend communications.
- **Communications Layer:** Set up a centralized Nodemailer SMTP infrastructure class (`Mailer`) for dispatching transactional emails.

---

## [1.0.0-alpha.1] - 2026-04-18
### Added
- **Project Initialization:** Bootstrapped the core Node.js backend environment utilizing Express 5.x and strict TypeScript 6.x.
- **System Architecture:** Implemented a scalable Domain-Driven Design (Feature-Based) directory structure isolating key business logic (`auth`, `users`, `products`, `orders`, `returns`, `interactions`, `dashboard`, `notification`).
- **Database Strategy:** Defined the overarching Polymorphic Mongoose Schema architecture to handle a diverse catalog of 50+ distinct SKUs (Bangles, Apparels, Unstitched Fabrics) within a single `Products` collection.
- **Global Middlewares:** Engineered foundational API interceptors including `rate-limit` (brute-force protection), `http-logger` (Morgan traffic analysis), `upload` (Multer memory storage for Cloudinary), `auth` (JWT verification), `role` (RBAC), and `validate` (DTO enforcement).
- **Environment & Tooling:** Configured strict `tsconfig.json` with dynamic path aliases (`tsconfig-paths`), established development launch scripts via `nodemon`, and generated the `.env.example` template.
- **Documentation:** Authored industry-standard technical documentation including `README.md` (System Architecture & Tech Stack), `api-docs.md` (REST Response standards & Route Index), and `LICENSE` (ISC).
- **Queue Strategy:** Outlined the Redis and BullMQ background worker directories to offload transactional emails and in-app notifications from the main execution thread.