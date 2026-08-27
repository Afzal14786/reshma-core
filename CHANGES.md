# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
*(Changes that are currently being worked on but not yet pushed to a stable alpha/beta tag will go here).*  

*(Phase 0: Emergency Hotfixes & Core Security Hardening - Prepared for alpha release)*  

### fix & added

**1. Profile Update Logic Overhaul (Critical Bug Fix)**
- **Fixed** the `UserService.updateProfile` method where user profile updates (firstname, lastname, phone, gender, DOB) were silently failing. 
  - *Root cause:* The update object was incorrectly wrapped as `{ $set: { updateData } }`, which Mongoose ignored due to strict mode.
  - *Resolution:* Corrected the MongoDB update syntax to `{ $set: updateData }`. Profile fields now persist in the database as expected.

**2. Browser Cookie Persistence (Dev Environment Fix)**
- **Fixed** a critical cookie rejection bug in `auth.utils.ts` that prevented refresh tokens from being stored during local development.
  - *Root cause:* Modern browsers strictly enforce the RFC 6265 rule: `SameSite=None` requires the `Secure` flag. In dev (HTTP), this combination caused the browser to drop the cookie entirely.
  - *Resolution:* Implemented conditional logic across `setAccessCookie`, `setRefreshCookie`, and `clearRefreshCookie`. In development (`secure: false`), `sameSite` is set to `'lax'`. In production (`secure: true`), it remains `'strict'`.

**3. Activating the Dead Cookie-Auth Pathway (Defense-in-Depth)**
- **Integrated** `setAccessCookie` into the `login`, `verifyOtp`, `refresh`, and `googleLogin` controllers.
  - *Why this matters:* Previously, the `protect` middleware checked `req.signedCookies.jwt` as a fallback, but this cookie was never actually sent to the browser. 
  - *Outcome:* We now support dual-channel token delivery (JSON response body + HttpOnly cookie). This provides an additional XSS mitigation layer—even if an attacker steals the in-memory token, the HttpOnly cookie remains inaccessible to JavaScript.

**4. Refresh Token Rotation (Session Security Upgrade)**
- **Refactored** the `AuthService.refreshSession` method to implement mandatory Refresh Token Rotation.
  - *Process:* When a refresh token is used, the old token is instantly blacklisted in Redis, and a brand-new refresh token is issued.
  - *Impact:* This completely mitigates replay attacks. If a refresh token is stolen, the original owner's next refresh request invalidates the thief's copy, forcing the attacker to re-authenticate.

**5. Account Lockout Mechanism (Brute-Force Mitigation)**
- **Added** `failedLoginAttempts` (number) and `lockUntil` (Date) fields to the `IUser` interface and `User` schema.
- **Updated** the `loginLocal` service logic to:
  - Increment `failedLoginAttempts` on every failed password entry.
  - Automatically lock the account for 15 minutes after 5 consecutive failed attempts.
  - Reset the counter to `0` and clear `lockUntil` on successful authentication.

**6. OTP Brute-Force Protection (2FA Pathway Security)**
- **Enhanced** the `verifyEmailOtp` service with a Redis-backed attempt counter (`otp_attempts:{email}`).
  - *Restriction:* Users are limited to 5 OTP verification attempts within a 15-minute sliding window.
  - *Impact:* Prevents attackers from brute-forcing 6-digit OTP codes, closing a critical vulnerability in the registration/login pipeline.

**7. TypeScript Strictness Enforcement**
- **Refactored** the failed-login update logic in `loginLocal` to strictly use `Partial<IUser>` instead of `any`, ensuring absolute type safety and aligning with the `noImplicitAny` and `noUncheckedIndexedAccess` TS rules.

---
### Files Modified in this Phase

- `modified: src/modules/auth/auth.controller.ts`
- `modified: src/modules/auth/auth.service.ts`
- `modified: src/modules/auth/auth.utils.ts`
- `modified: src/modules/users/interfaces/user.interface.ts`
- `modified: src/modules/users/user.model.ts`
- `modified: src/modules/users/user.service.ts`

### fix & added

- Added new *method* `getOrderById` so the admin can find one particular order using the order *_id*
- fix `getAllOrders` *method* and return proper response including **total**, **page**, **limits** and compute **totalPage** and return as `response`.
- move the `/admin/:id/dispatch` route inside admin control so only admin can access this perticular route
- add new route `/admin/:id` to get one particular order using order `_id`. 

### fix 

- Removed HSN code from product becuase it contains only number minimum 4 and max 8 digit 
- fix auth utils and compare the `NODE_ENV` properly so it act as a string
- also fix the product.admin.dto.ts so from the frontend request received properly as well as all the CRUD operation checked and tested

### Remove -- StandardLimited from all the API's where it is used because the standardLimiter middleware is already used @app.ts file

- **Why?** : *This changes reduce the IP block as well as duplicated count of the API calls, for example if the user hit's the auth route one time so it should only increate the counter by 1, not by 2.*

- **Nodemon** (`/boutique-startup/reshma-core/Dockerfile`) : *Added nodemon into the docker so while working in backend we do not need to restart all the serviecs again and again, all the changes reflect automatically*  
- **Asia/Kolkata TimeZone** : (`/boutique-startup/reshma-core/docker-compose.yml`) : Added current time zone to all the services so the logs works efficiently.
- **rate-middleware.ts** : (`/boutique-startup/reshma-core/src/shared/middlewares/rate-limit.middleware.ts`) : Added prefix to redis store because without prefix it is unable to identify for which limiter it is blocking the IP. In other words `createRedisStore` now having individual limiter, like for `standard-limiter` having it's own redis store, previsouly they are sharing the same redis-store. Now this change prevent the IP blocking.
- **Router** : (`/boutique-startup/reshma-core/src/modules/*/<module-name.routes.ts>`) : Remove all the standard-limiter from routes because it is already implemented inside **app.ts** (`/home/iamafzal/projects/boutique-startup/reshma-core/src/app.ts`) . After making this changes, it stop double count in every API call.  

- **User Model** : (`/boutique-startup/reshma-core/src/modules/users/user.model.ts`) : Strip sensitive/internal fields from every serialized response . See the exact peace of code added in this file. 
  ```typescript
  UserSchema.set("toJSON", {
    transform: (_doc, ret) => {
      const { password, __v, ...rest } = ret;
      return rest;
    },
  });
  ```

- **Fix Import** : (`/boutique-startup/reshma-core/src/modules/products/controllers/product.public.controller.ts`) : use `@shared` path instead or relative path. It helps easy to undertsand the imports.  


### Added – Comprehensive Database Seeding System 2026-07-26  

A fully-featured, modular seeding system has been introduced to bootstrap the application with realistic, interconnected data for development and testing.  


#### Core Infrastructure
- **Central orchestrator** (`src/db/seed.ts`) – connects to MongoDB and runs all seeders in dependency order.
- **Shared types** (`src/db/seeds/types.ts`) – ensures type safety across all generators and seeders.
- **Base utilities** (`src/db/seeds/generators/base-generator.ts`) – provides reusable functions: `pickRandom`, `generateSKU`, `generatePrice`, image pools, etc.

#### Static Data Files
- Admin user JSON (`src/db/seeds/data/users/admin.json`) – pre-configured admin account with address.
- Product categories JSON (`src/db/seeds/data/categories.json`) – defines main and sub‑categories for all product types.
- Static coupons JSON (`src/db/seeds/data/coupons/static-coupons.json`) – fixed promo codes (WELCOME10, FLAT200, BANGLEFEST)  
- Auth Controller (`src/modules/auth/auth.controller.ts`) – fixed refresh token code changes `const refreshToken = req.signedCookies?.refreshToken;`
- Auth Utils (`src/modules/auth/auth.utils.ts`) - make compatale for local developement `sameSite: env.NODE_ENV === "production" ? "strict" : "none",` 
- Order Service (`src/modules/orders/order.service.ts`) - update `recoverAbandonedOrders` function
- Order Module (`src/modules/users/user.model.ts`) - update default working image url
- Databet Seed (`src/db/seed.ts`) - Implement Dataset for all the modules including working images
- ENV Config (`src/config/env.ts`) - Added `  COOKIE_SECRET: z.string().min(10, "Cookie secret is required"),` 
- app.js (`src/app.ts`) - used `app.use(cookieParser(env.COOKIE_SECRET));` and also update the **client url** in the cors origin

### Added: DevOps, Containerization & Repository Governance

This release transitions the Reshma-Core architecture from a local development environment to a production-ready, highly available enterprise system.

**Infrastructure & DevOps (Docker Integration)**
* Added a multi-stage `Dockerfile` utilizing Alpine Linux to compile TypeScript and securely run the production build under a non-root `node` user.
* Implemented `docker-compose.yml` for local environment parity, automatically orchestrating the API Gateway, BullMQ Worker, MongoDB, Redis, and Typesense on an isolated bridge network.
* Added `docker-compose.prod.yml` for AWS deployment, featuring complete air-gapping of databases (no exposed ports) and strict container healthchecks to prevent startup race conditions.
* Configured `.dockerignore` to strip local secrets, `.git` histories, and unnecessary dependencies from the final image, drastically reducing build size.

**Repository Governance & Open Source Standards**
* Authored an enterprise-grade `CONTRIBUTING.md` enforcing a strict "Zero `any`" TypeScript policy, Domain-Driven Design adherence, and Conventional Commits.
* Established a comprehensive `SECURITY.md` detailing the threat model, acceptable use policy, and private vulnerability disclosure pipelines.
* Added `CODE_OF_CONDUCT.md` enforcing "Egoless Engineering" and strict code review etiquette.
* Restructured `.github/ISSUE_TEMPLATE/` using YAML forms for Bug Reports, Feature Requests, and Security vulnerabilities to enforce high-quality issue triage.
* Updated `LICENCE` to include the standard copyright header.

**Documentation & Configuration**
* Rewrote the master `README.md` to reflect the complete Microservice architecture, DevOps pipeline, and business logic highlights.
* Sanitized `.env.example` to remove hardcoded cloud keys and provide clear instructions for Docker vs. Local database connection strings.
* Updated `PULL_REQUEST_TEMPLATE.md` to ensure security scans and Prettier formatting are verified before merge.

### Added ~ Features
* **Public Password Recovery Pipeline:** Implemented the complete "Forgot Password" and "Reset Password" flows in the Auth module. Integrates seamlessly with Redis for 15-minute secure token expiry.
* **Order Shipped Template:** Added a brand new `order-shipped.ts` MJML template featuring the visual timeline tracker and dynamic courier/tracking data.

### UI & Notification Engine Overhaul (Blueprint 6.x)
* **MJML Enterprise Templates:** Completely redesigned all 15 transactional email templates (`welcome`, `order-placed`, `return-approved`, `data-export`, etc.) to match the "Handcrafted Elegance" brand identity.
* **Dark Mode & Responsive Design:** Replaced rigid HTML tables with fluid `<div>` structures and injected CSS media queries for automatic Dark Mode color inversion.
* **Component Standardization:** Enforced a strict UI system using Deep Charcoal, Amber Glow, and 4px left-bordered Information Cards across all templates. Added a universal layout wrapper (`layout.ts`) featuring social media icons and gradient utilities.

### Security & Infrastructure
* **Rate Limiting Collision Fix:** Resolved the Express `ERR_ERL_DOUBLE_COUNT` error by explicitly assigning a unique `requestPropertyName` to all layered limiters (`standardLimiter`, `authLimiter`, `checkoutLimiter`). 
* **Bcrypt DoS Protection (CWE-400):** Introduced `reset-password.dto.ts` with a strict `.max(64)` character limit on passwords, immunizing the server against Event Loop freezing via payload bloat.
* **Strict Typing & Zero 'any':** Purged the `any` keyword from `email.interface.ts` and `notification.service.ts`. Strongly typed the payload interfaces using domain models (`IOrderItem`, `IOrderShippingAddress`).

### Billing & Legal
* **GST-Compliant PDF Invoices:** Completely rewrote `invoice.generator.ts`.
  * Now asynchronously fetches the Cloudinary logo as a binary buffer.
  * Dynamically maps CGST/SGST/IGST onto a structured A4 table.
  * Added mandatory legal footers (Jurisdiction, Return Policy, and Authorized Signatory block).

### Bug Fixes
* **Missing Arguments Fix:** Corrected `order.service.ts` to pass the required `items` and `shippingAddress` payloads to the Notification Service across all three checkout scenarios (COD, Webhook, Frontend Verification).
* **Dependency Updates:** Updated `package.json` and `package-lock.json` to accommodate MJML compilation and updated validation dependencies.

---
*Architectural Note: This completes the Node.js/Express Application Layer. The codebase is now mathematically robust, CodeQL compliant, and ready for Docker containerization (Phase 2).*

### Added ~ Security, Compliance & Concurrency Hardening
* **Atomic State Transitions (Orders):** Eliminated critical TOCTOU race conditions in the checkout and webhook pipelines. Replaced `order.save()` with atomic `findOneAndUpdate` state locks. This guarantees idempotency and prevents ghost cancellations or double-incrementing of coupon usage during concurrent frontend and webhook pings.
* **Verified Buyer Legal Gatekeeper (Interactions):** Implemented strict validation to comply with E-Commerce rules regarding fake reviews. The platform now cryptographically verifies that a user has a `DELIVERED` order for a specific product before permitting them to submit a rating or review.
* **Timezone-Neutral Aggregations (Dashboard):** Resolved a data desync vulnerability caused by Docker UTC server timezones. Dashboard temporal boundaries now utilize strict `setUTCHours` configurations, ensuring Indian Standard Time (IST) midnight settlements perfectly align with backend revenue reporting regardless of cloud host location.
* **Prototype Pollution Prevention (Cart):** Resolved a CodeQL (CWE-1321) vulnerability in the cart attribute reconstruction logic. Dynamic user payloads are now mapped to a pure dictionary via `Object.create(null)` with explicit dropping of `__proto__` and `constructor` keys to protect the V8 memory heap.

### Added ~ Security & Financial Integrity 

* **TOCTOU Checkout Vulnerability:** Patched a Time-of-Check to Time-of-Use vulnerability in `OrderService`. The checkout engine now dynamically recalculates coupon validity and discount ratios against the live database subtotal at the exact millisecond of checkout, preventing exploitation of cached cart discounts if an admin changes product pricing mid-session.
* **Falsy Zero Math Bug:** Resolved a JavaScript falsy evaluation error in `CartService`. Replaced the `||` operator with an explicit null check (`!= null`) to ensure that 100% promotional discounts accurately result in a ₹0 grand total without reverting to the pre-discount subtotal.
* **Checkout Deadlock Resolution:** Implemented a self-healing UI deadlock prevention mechanism in `CartService.getCart()`. If a cart's live subtotal falls below a previously applied coupon's threshold, the system now dynamically strips the invalid coupon during the fetch phase, breaking the infinite loop of checkout rejections.

### Added ~ Infrastructure Hardening & Resilience Epic

### Security & Financial Integrity
* **Proportional Refund Logic:** Re-engineered the `ReturnService.initiateReturn` mathematical engine to utilize a `discountRatio` algorithm. This ensures that refunds for items purchased with coupons are calculated based on the actual "consideration paid" rather than the catalog price, preventing revenue leaks and maintaining constitutional consumer rights.
* **Raw Body HMAC Validation:** Patched a critical cryptographic mismatch in `src/app.ts` by implementing raw Buffer interception. This captures the unmutated request body as `req.rawBody` for Razorpay and Shiprocket webhooks, ensuring 100% signature accuracy for financial handshakes.
* **Distributed Cron Locking:** Implemented a Redis-based idempotency firewall using `SET NX` in `order-recovery.cron.ts`. This prevents "The Multiplier Bug," guaranteeing that only one container instance executes inventory recovery tasks in a horizontally scaled Docker environment.

### Search & System Resilience
* **Search Sync Dead Letter Queue (DLQ):** Integrated a BullMQ-powered resilience layer into `ProductService`. Failed synchronization attempts with Typesense are now automatically pushed to a `search-sync-queue` with a 10-attempt exponential backoff strategy, eliminating "Ghost Products" during network outages.
* **Enterprise Graceful Shutdown:** Updated `src/server.ts` to trap `SIGTERM` and `SIGINT` signals. The server now halts new HTTP traffic and drains active requests before safely closing MongoDB and Redis connections, preventing data corruption during deployments or scaling events.

### Developer Experience & Type Safety
* **Strict TypeScript Compliance:** Eradicated `any` keyword usage in the `export.worker.ts` profile sanitization logic. Replaced unsafe casting with mathematically type-safe ES6 object destructuring and double-casting to satisfy strict compiler rules.
* **Express Namespace Merging:** Officially extended the global `Express.Request` namespace in `express.d.ts` to include `rawBody`, enabling type-safe access to raw request buffers across all middleware.

### Documentation Updates
* **Legal & Tax Compliance:** Updated to document the Proportional Discounting math and Indian GST arbitration logic.
* **Product Domain:** Added technical specifications for the Typesense DLQ and eventual consistency protocols.
* **Notification Module:** Documented the new `search-sync-queue` infrastructure.
* **API Standards:** Appended new DevOps and Health modules, including Load Balancer liveness probes.

### 🛠️ Key Files Altered
* `~ src/modules/returns/return.service.ts` (Financial math & Type-safety)
* `~ src/modules/products/product.service.ts` (Typesense DLQ integration)
* `~ src/app.ts` (Raw body interception)
* `~ src/server.ts` (Graceful shutdown logic)
* `~ src/shared/cron/order-recovery.cron.ts` (Redis distributed lock)
* `~ src/shared/queues/export.worker.ts` (Type-safety hardening)
* `~ src/shared/types/express.d.ts` (Request interface expansion)

### Added ~ May 12, 2026
* **Polymorphic Ticketing System:** Deployed a new centralized Support Module (`/api/v1/support`) that allows customers to link complaints directly to specific polymorphic entities (Orders, Returns, Products).
* **Threaded Conversations:** Implemented an `O(1)` read-optimized embedded document architecture for ticket messages, replacing expensive SQL-style joins.
* **SLA State Machine:** Engineered an autonomous arbitration workflow (`OPEN` -> `IN_PROGRESS` -> `WAITING_ON_CUSTOMER` -> `RESOLVED` -> `CLOSED`). The engine natively locks closed tickets to prevent zombie thread revivals.
* **Multimedia Support:** Integrated Multer and Cloudinary buffer-streams into the support routes to safely handle user-uploaded photographic evidence (up to 3 images per reply).

### Security & DPDP/GDPR Compliance
* **The Right to be Forgotten:** Hooked `SupportService.anonymizeUserTickets` into the `user.service.ts` ACID deletion transaction. Customer identity and photographic PII are now irreversibly scrubbed upon account deletion, while preserving anonymous text logs for administrative QA.
* **Data Portability (Takeout):** Updated the BullMQ `export.worker.ts` so that users requesting their JSON data footprint automatically receive their entire support ticket history.
* **IDOR Protection:** The Ticketing Engine dynamically cross-references the `Orders` and `Returns` collections to mathematically guarantee a user actually owns the entity they are complaining about before ticket initialization.
* **Anti-Spoofing:** Hardcoded the `MessageSenderRole.USER` override in the Public Controller to prevent malicious payload interception and admin-spoofing.

### Cross-Module Integrations
* **Notification Engine (BullMQ):** Added `TICKET_CREATED` and `TICKET_REPLIED` to the discriminated union payloads. The background worker now dispatches strictly-typed HTML emails and persistent In-App "Bell Icon" alerts without blocking the Node.js event loop.
* **Admin Dashboard KPIs:** Injected a fast `countDocuments` query into the `dashboard.service.ts` `$facet` pipeline. Staff can now instantly see `pendingSupportTickets` (tickets in `OPEN` or `WAITING_ON_CUSTOMER` states) on the main `/api/v1/dashboard/metrics` route.

### Documentation Updates
* Created `docs/modules/support-module.md` (Architecture & ADRs).
* Created `docs/api/thunder-tests/support-runbook.md` (Postman/Thunder Client testing guide).
* Appended Support Module definitions to `system-overview.md`, `legal-tax-compliance.md`, and `api-standards.md`.

### Key Files Altered/Created
* `+ src/modules/support/*` (Model, DTOs, Interfaces, Service, Controllers, Routes)
* `~ src/routes/index.ts` (Mounted `/support` routes)
* `~ src/modules/notifications/interface/email.interface.ts` (Added Ticket Unions)
* `~ src/modules/notifications/notification.service.ts` (Added Trigger Methods)
* `+ src/modules/notifications/templates/ticket-created.ts`
* `+ src/modules/notifications/templates/ticket-replied.ts`
* `~ src/modules/users/user.service.ts` (Injected Anonymization Saga)
* `~ src/shared/queues/export.worker.ts` (Injected Ticket Fetcher)
* `~ src/modules/dashboard/dashboard.service.ts` (Injected Support KPIs)
* `~ src/modules/dashboard/interfaces/dashboard.interface.ts` (Added Metric Types)

### Hotfix: DPDP/GDPR Cross-Module Privacy Scrub
* **Interaction Masking (Anti-Crash):** Patched `interaction.controller.ts` to intercept `null` user populations caused by account deletions. Safely substitutes an "Anonymous User" profile to prevent frontend `TypeError` crashes on product pages.
* **Return Records Scrubbing:** Engineered `anonymizeUserReturns` in `return.service.ts` to permanently delete photographic proof of damage, wipe customer text notes, and scrub pickup addresses while preserving the financial `refundAmountEstimate` for tax accounting.
* **Saga Orchestrator Update:** Wired the new Returns scrub into the Master `deleteAccount` transaction in `user.service.ts` to guarantee atomic execution of the Right to be Forgotten.
* **Mailer Interface Strict Typing:** Upgraded `mailer.ts` with strict `attachments` typings and a CodeQL-compliant CWE-117 log injection neutralizer.

### Epic 2: DPDP/GDPR Privacy Compliance (Sprint 3: Data Portability)
* **Asynchronous Export Engine:** Engineered a "Google Takeout" style data export pipeline to prevent Node.js thread blocking during massive data queries.
* **The Background Worker:** Created `export.queue.ts` and `export.worker.ts` using BullMQ to concurrently fetch multi-domain data (Orders, Carts, Interactions) via `Promise.all()`.
* **Dynamic File Attachments:** Upgraded `email.interface.ts` and `email.worker.ts` to accept stringified JSON payloads and convert them into secure `.json` file attachments via Nodemailer.
* **The Controller Trigger:** Added `POST /users/profile/export` to execute the queue push and immediately return a non-blocking `202 Accepted` response.

### Epic 2: DPDP/GDPR Privacy Compliance (Sprint 2: The Anonymization Engine)
* **The Master Orchestrator:** Engineered an ACID-compliant MongoDB Transaction in `UserService.deleteAccount` to handle the "Right to be Forgotten" cascading cleanup without leaving ghost data.
* **Financial Data Scrambler:** Built `OrderService.anonymizeUserOrders` to irreversibly scramble shipping PII (`fullName`, `phone`, `streetAddress`) for deleted users while preserving `totalAmount` for tax compliance.
* **Ephemeral State Wipers:** Implemented deletion logic in `CartService` and `WishlistService` to permanently drop capacity-heavy arrays when an account is terminated.
* **Client-Side Session Kill:** Updated `UserController` to broadcast a `clearCookie` command upon deletion to guarantee immediate browser logout.

### Epic 2: DPDP/GDPR Privacy Compliance (Sprint 1: Consent Tracking)
* **Immutable Consent Ledger:** Added `privacyPolicyAcceptedAt` timestamp to the `User` schema (`IUserPreferences`) to legally prove when a user agreed to data collection.
* **The Legal Gatekeeper:** Updated `register.dto.ts` with a strict Zod boolean check (`acceptPrivacyPolicy`) that physically blocks account creation if the frontend checkbox is bypassed.
* **Service Level Stamping:** Re-engineered `AuthService.registerLocal` and `AuthService.loginWithGoogle` to safely build user preferences and inject the exact server timestamp upon successful onboarding.

### Added ~ Industry-Level Observability

### Epic 1: Industry-Level Observability Completed
* **Enterprise HTTP Logging:** Integrated `morgan` to intercept all HTTP traffic, accurately calculating exact millisecond response latencies and payload sizes.
* **Winston Stream Bridge:** Piped Morgan's output directly into Winston to ensure all HTTP access logs benefit from daily log rotation and archival.
* **Environment-Aware Formatting:** Re-engineered `logger.ts` to output beautiful, colorized text in development, while strictly enforcing structured JSON output in production for seamless AWS CloudWatch / Datadog integration.
* **PII Scrubbing:** Configured the HTTP logger to intentionally ignore `req.body` to prevent accidental logging of sensitive customer data (passwords, Razorpay HMAC signatures).

### Fixed ~ Security & Infrastructure

* **Express 5.x Compatibility Fix:** Resolved `TypeError: Cannot set property query of #<IncomingMessage>` by migrating away from legacy middlewares that attempt to reassign read-only Express 5 getters.
* **Custom NoSQL Sanitizer:** Engineered a recursive `Sanitizer.ts` utility that deep-cleans incoming objects by stripping MongoDB operators (`$`) and dot-notation keys (`.`). 
* **Hardened Validation Pipeline:** Re-engineered `validate.middleware.ts` to utilize `Object.defineProperty`. This allows the application to inject sanitized and Zod-validated data into `req.query` and `req.params` while satisfying Express 5's architectural constraints.
* **Taint-Chain Isolation:** Implemented shallow-cloning for all incoming request objects before sanitization, ensuring raw malicious input is never processed by the business logic.

### DevOps & Reliability
* **Health Check Stability:** Restored functionality to the `/api/v1/health` endpoint by removing the global sanitizer crash-loop.

### Added ~ DevOps & Infrastructure  

### Cluster-Ready Upgrades & Infrastructure
* **Distributed Rate Limiting:** Migrated `express-rate-limit` from local RAM to `rate-limit-redis`. All server instances behind the load balancer now logically share a centralized strike-counter. This instantly neutralizes Server-Hopping DDoS and automated card-testing attacks.
* **Deep Liveness Probes (`/api/v1/health`):** Built a dedicated DevOps endpoint tailored for AWS ELB and Kubernetes. It executes deep pings against MongoDB, Redis, and Typesense. It emits `503 Service Unavailable` on microservice failure, allowing the Load Balancer to intelligently sever traffic and achieve zero-downtime routing.

### Global Security Hardening
* **NoSQL Injection Defense:** Injected `express-mongo-sanitize` into the global Express pipeline as a universal fail-safe firewall against NoSQL operator injection attacks.
* **HTTP Header Masking:** Deployed `helmet` to strip `X-Powered-By` fingerprints and enforce strict XSS/Clickjacking protections.

### Architecture Documentation
* **New Blueprint:** Added `docs/architecture/devops-and-infrastructure.md` outlining the zero-downtime cluster strategy.
* **Security Updates:** Updated `security-hardening.md` to document the dual-layer NoSQL defense.

### Added ~ The Edge Cache & Background Workers 

### Asynchronous Invoice Generation (BullMQ)
* **Offloaded CPU-Intensive Tasks (`invoice.worker.ts`):**
  * Extracted the synchronous `PDFKit` invoice generation from the main Node.js event loop to prevent server lockups during high-volume checkout events.
  * Implemented a dedicated BullMQ worker with Exponential Backoff (3 retries: 5s, 25s, 125s) to guarantee resilience against third-party API outages.
* **Diskless Cloudinary Streaming:**
  * Configured the background worker to pipe the raw PDF Buffer directly into `cloudinary.uploader.upload_stream`. This physically bypasses the local server disk, eliminating local storage bloat and I/O bottlenecks.
* **Non-Blocking Checkout Integration (`order.service.ts`):**
  * Integrated `InvoiceQueueManager` into the `initializeCheckout`, `processWebhook`, and `verifyFrontendPayment` pipelines as a "Fire-and-Forget" trigger, ensuring sub-second checkout API response times.

### Redis Edge Cache & Performance Shielding
* **The Proxy Shield (`cache.middleware.ts`):**
  * Engineered a custom Express middleware to intercept read-heavy traffic (e.g., `GET /api/v1/products`) and serve JSON directly from Redis RAM (~2ms latency).
  * Implemented an advanced Proxy Pattern that hijacks `res.json` during Cache Misses to automatically store Mongoose output into Redis with a 300-second (5-minute) TTL without duplicating controller logic.
* **Thundering Herd Defense:**
  * The public catalog API is now completely shielded. 10,000 concurrent users reloading the homepage will result in exactly 1 MongoDB query.

### Eventual Consistency & Cache Invalidation
* **Self-Healing Cache (`cache.utils.ts`):**
  * Built `CacheManager.invalidateCachePattern()` leveraging Redis `KEYS` and `DEL` commands to wipe targeted cache namespaces dynamically.
* **Admin Catalog Mutations (`product.admin.controller.ts`):**
  * Injected Fire-and-Forget cache invalidation promises into the `createProduct`, `updateProduct`, and `deleteProduct` controllers. The millisecond an Admin alters the catalog, the Redis cache is purged in the background, guaranteeing the public immediately sees the updated state.

### Architecture & Documentation
* **New Blueprint:** Added `docs/architecture/edge-cache-and-workers.md` to document the Thundering Herd defense and asynchronous queue strategies.
* **Module Updates:** Updated `order-module.md`, `product-module.md`, and `system-overview.md` to reflect the new caching layers, diskless uploads, and roadmap progress.

### Added - May 10, 2026 Sunday

### Features & Legal Architecture
* **Dynamic GST Calculation Engine (`tax.utils.ts`):**
  * Engineered a standalone utility to dynamically resolve Indian GST brackets based on HSN chapters and transaction value thresholds (e.g., dynamically shifting apparel from 18% to 5% if the post-discount price falls below ₹2,500).
  * Implemented State Arbitration logic to split tax into CGST (50%) and SGST (50%) for intra-state (West Bengal) transactions, or 100% IGST for inter-state transactions.
  * Isolated logistics service tax, calculating strict 18% inclusive GST on shipping fees.

### Cart & Checkout Upgrades
* **Two-Pass Financial Calculation (`cart.service.ts`):**
  * Replaced flat cart-level tax calculations with line-item level taxation.
  * Solved the "Refund Exploit" by implementing **Proportional Discounting**: distributing cart-level coupons mathematically across individual line items based on their weight in the cart before calculating GST.
* **Checkout State Arbitration (`order.service.ts`):**
  * Intercepts the user's `shippingAddress.state` during atomic checkout and processes the cart totals through the `TaxEngine` to finalize the CGST/SGST/IGST breakdown.

### Database Integrity & Immutability
* **Strict Product Tax Inheritance:**
  * Upgraded `BaseProduct` Mongoose schema and Zod DTOs to make `hsnCode` and `taxProfile` mandatory for all polymorphic products (Bangles, Apparel, Fabric, etc.).
* **Immutable Tax Snapshotting (`order.model.ts`):**
  * Destroyed the flat `taxAmount` property.
  * Orders now immutably snapshot `taxableValue`, `hsnCode`, `gstRate`, `cgst`, `sgst`, and `igst` at the line-item level. If tax laws change in the future, past financial ledgers remain 100% accurate for GST audits.

### PDF Invoicing & Documentation
* **Legal Tax Invoices (`invoice.generator.ts`):**
  * Redesigned the in-memory PDF Kit generator to draw a fully compliant Indian Tax Invoice, featuring granular HSN, Taxable Value, and Central/State GST breakdown tables.
* **Architecture Documentation:**
  * Added `docs/architecture/legal-tax-compliance.md` as the master blueprint for the financial engine.
  * Updated Cart, Order, and Product module documentation to reflect the Two-Pass calculation and Schema evolution.

### Features & Architecture
* **Admin Dashboard Module (Read-Heavy Mathematical Engine):**
  * Deployed a centralized metrics aggregation engine (`src/modules/dashboard`) to provide real-time business health monitoring.
  * Implemented a single-pass MongoDB `$facet` aggregation pipeline to calculate Financials (Total Revenue, Average Order Value), Fulfillment Status distribution, and Top-Selling Products simultaneously without loading documents into the Node.js heap.
  * Utilized database-level `$lookup` joins to prevent N+1 query latency when mapping Top Product ObjectIds to their respective SKUs and Names.
  * Engineered a parallel execution strategy (`Promise.all`) to fetch order aggregations, inventory alerts, and user growth metrics concurrently, reducing overall API latency.

### Security & Payload Validation
* **Temporal Firewall (Zod):**
  * Created `DateRangeQuerySchema` to safely coerce incoming URL query strings into native JavaScript `Date` objects.
  * Implemented cross-field validation to mathematically guarantee `startDate` occurs before `endDate`, neutralizing NoSQL date-injection payloads and impossible database queries.
* **Transport Layer Hardening:**
  * Exposed `GET /api/v1/dashboard/metrics` strictly behind a three-tier security wall: `standardLimiter` (DoS prevention), `protect` (JWT Verification), and `restrictTo("ADMIN")` (Role-Based Access Control).

### Technical Debt & CodeQL Compliance
* **Strict TypeScript 6 / Mongoose 9 Alignment:**
  * Eradicated the use of the `any` keyword throughout the Dashboard service.
  * Mapped Mongoose `.lean()` executions to strict interfaces (`ILeanProduct`) to maintain compiler safety.
  * Resolved `FilterQuery` type-widening errors by utilizing inline string literals (`{ role: "USER" }`), perfectly satisfying Mongoose 9's strict generic constraints without requiring complex type imports.

### Documentation
* Created `docs/modules/dashboard-module.md` to outline the read-heavy architecture and the specific scope of the MongoDB aggregations versus external Time-Series tools.
* Authored `docs/api/thunder-tests/dashboard-runbook.md` to establish standard QA testing flows for temporal validations and RBAC edge cases.
* Updated `docs/architecture/system-overview.md` to officially mark Phase 4 (Operations & Analytics) as completed.
* Registered the new analytics endpoints in the master directory within `docs/api/api-standards.md`.

### Features & Architecture
* **Typesense RAM Search Integration (Dual-Database Architecture):**
  * Deployed a C++ based, sub-50ms in-memory search engine to bypass heavy MongoDB aggregations.
  * Created `TypesenseManager` singleton (`src/config/typesense.ts`) with strict RAM schema initialization.
  * Implemented fail-fast boot sequence in `server.ts` to guarantee search infrastructure is available before accepting HTTP traffic.
* **Eventual Consistency Pipeline (`ProductService`):**
  * Surgically injected non-blocking network hooks (`syncToSearchEngine`, `removeFromSearchEngine`).
  * Mongoose CRUD operations now autonomously sync BSON documents to the RAM cluster.
  * Includes resilient error catching so Typesense network drops do not crash primary ACID transactions.
* **Faceted Search API (`SearchModule`):**
  * Built `executeSearch` using strict generic typings (`ITypesenseProductDoc`) to satisfy `exactOptionalPropertyTypes` compiler rules.
  * Implemented Typo-Tolerance (`num_typos: 2`) and dynamic UI faceting.
  * Protected via `standardLimiter` and `SearchQuerySchema` Zod payload firewall.

### Bug Fixes & CodeQL Hardening
* **Returns Module (`ReturnService`):**
  * Fixed strict Type Mismatches and Mongoose `.create()` overload crashes.
  * Enforced explicit enum casting for `ReturnReason` to align Zod inferences with Mongoose definitions.
  * Resolved the TS `never` type error by safely casting the created document array, restoring `_id` accessibility for telemetry.
* **Product Update Typing:**
  * Eradicated the forbidden `any` keyword from `product.service.ts`.
  * Removed redundant complex type casting in `.lean()` execution, relying natively on the `IBaseProduct` interface.

### Documentation
* Created `docs/modules/search-module.md` outlining the eventual consistency strategy.
* Created `docs/api/thunder-tests/search-runbook.md` for QA testing.
* Updated `system-overview.md`, `environment-variables.md`, and `api-standards.md` to reflect the new infrastructure.

### Added
- **Logistics & Tracking Engine (Epic 1):** Integrated Shiprocket 3PL aggregator for automated fulfillment.
- **Shiprocket Auth Manager:** Built a Redis-backed Singleton (`src/config/shiprocket.ts`) to manage rolling 10-day JWT authentication tokens with an 8-day autonomous refresh cycle.
- **Dispatch Orchestrator:** Implemented `ShiprocketService.dispatchOrder` to map MongoDB documents to Shiprocket schemas, generate Airway Bills (AWB), and schedule physical courier pickups.
- **Webhook State Machine:** Implemented `ShiprocketService.processWebhook` to autonomously translate courier GPS tracking events into internal MongoDB state changes.
- **Order Delivered Notifications:** Added the `ORDER_DELIVERED` BullMQ job type, HTML template, and trigger method to the Notification Engine.
- **Admin Endpoints:** Exposed `POST /api/v1/orders/admin/:id/dispatch` for one-click fulfillment.
- **Public Webhooks:** Exposed `POST /api/v1/orders/shiprocket-webhook` for server-to-server tracking pings.
- **Documentation:** Authored the `order-runbook.md` Thunder Client guide and heavily expanded `order-module.md` to cover physical logistics architecture.

### Changed
- **Order Model:** Expanded `order.model.ts` and `order.interface.ts` to include `trackingNumber`, `courierName`, `shiprocketOrderId`, and `shiprocketShipmentId`.
- **Order Status Types:** Synchronized `OrderStatus` union type to formally accept `RETURN_REQUESTED` and `RETURNED`.
- **Environment Schema:** Updated `env.ts` to enforce `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, and `SHIPROCKET_WEBHOOK_SECRET` via strict Zod validation.

### Security
- **Taint-Severing Boundary:** The Dispatch orchestrator manually constructs external JSON payloads, mathematically preventing internal MongoDB document properties from leaking to the Shiprocket network.
- **Idempotency Firewalls:** The dispatch service strictly blocks double-execution to prevent accidental double-billing of the corporate wallet.
- **Webhook Authentication:** The Shiprocket webhook route enforces a strict `x-api-key` header verification to prevent malicious delivery-state manipulation.

### Added
- **Wishlist Module:** Deployed the complete deferred-purchase intent engine (`src/modules/wishlists`).
- **Wishlist Domain Models:** Implemented `Wishlist` and `WishlistItem` Mongoose schemas with strict one-to-one User mapping and `_id: false` sub-document optimization to prevent BSON bloat.
- **Wishlist Service Engine:** Engineered a highly read-optimized service layer featuring:
  - **Lazy Initialization:** Wishlist database documents are only generated upon the first item addition, preventing blank-document database bloat.
  - **Self-Healing Reads:** The `getWishlist` pipeline automatically detects inactive or deleted products and executes an atomic `$pull` to silently purge ghost items from the array.
  - **Cross-Module Handoff:** Built the `moveToCart` method, which securely transfers payloads to the `CartService` ACID transaction before surgically removing the item from the wishlist.
- **Wishlist Zod Firewalls:** Added `AddWishlistItemSchema`, `RemoveWishlistItemSchema`, and `MoveToCartSchema` with `.strict()` boundaries and ReDoS-safe ObjectId regex validation.
- **Wishlist REST API:** Exposed 5 protected endpoints (`GET /`, `POST /add`, `POST /move-to-cart/:productId`, `DELETE /item/:productId`, `DELETE /clear`) secured by the global rate limiter and JWT middleware.
- **Documentation:** Authored `wishlist-module.md` detailing concurrency mitigations, updated `api-standards.md` with new endpoints, and added the `wishlist-runbook.md` Thunder Client testing guide.

### Changed
- **Global Router:** Mounted the `WishlistRoutes` to the `/api/v1/wishlists` namespace in `src/routes/index.ts`.
- **System Overview:** Updated the master documentation index (`docs/architecture/system-overview.md`) to include the new Wishlist and Coupon modules.
- **API Standards:** Updated the Master Endpoint Directory to reflect the completed state of the Returns module (removing the "Phase 8" tag) and appended the missing Notification endpoints.

### Security
- **CWE-400 (Memory Exhaustion) Mitigation:** Enforced a hard 100-item ceiling on the wishlist array at the Service layer to prevent malicious database bloat.
- **Race Condition Prevention:** Completely bypassed Mongoose `.save()` for array mutations, utilizing MongoDB atomic operators (`$push` and `$pull`) with query-level idempotency checks to prevent "Lost Update" anomalies.

### Added
- **Coupon Module:** Implemented centralized `CouponService` for executing promotional business logic, including temporal, scarcity, margin, and acquisition firewalls.
- **Public Discovery API:** Added `GET /api/v1/coupons/available` utilizing MongoDB `$expr` to dynamically display valid coupons based on active cart subtotal.
- **Cart Promotional Hooks:** Added `POST /cart/coupon/apply` and `DELETE /cart/coupon/remove` to manage active cart promotions.
- **Invoice Dynamic Rows:** `invoice.generator.ts` now dynamically detects and renders a green "Discount" row and recalculates the visual Grand Total.
- **Documentation:** Added `coupon-module.md`, `coupon-runbook.md`, and updated all relevant architecture ADRs.

### Changed
- **Cart Recalculation Engine:** `CartService` now actively pings `recalculateCartTotals()` on every mutation (add, update, merge) to silently strip expired or invalid coupons mid-session.
- **Order Financial Immutability:** `OrderSchema` now natively stores `appliedCoupon` and `discountAmount`. `OrderService.initializeCheckout` mathematically calculates the exact total minus the discount before pinging Razorpay.
- **Mongoose 9 Type Safety:** Hardened `Cart.create()` arrays with intermediate assignments to satisfy strict `exactOptionalPropertyTypes` compilation.

### Security
- **TOCTOU Firewall:** Implemented a Time-Of-Check to Time-Of-Use failsafe in `OrderService` to abort checkout if a coupon expires while the user is idling on the cart page.
- **Atomic Scarcity:** Moved coupon `$inc: { usedCount: 1 }` strictly to the Razorpay background Webhook (`processWebhook`) to prevent checkout abandonment from starving coupon inventory.
- **CodeQL CWE-117 Mitigated:** Implemented `safeLog()` wrappers across Cart, Order, and Coupon services to physically strip `\r\n` characters and prevent Log Injection attacks.
- **CodeQL CWE-943 Mitigated:** Enforced explicit `$eq` wrappers and primitive casting across all dynamic Mongoose queries to neutralize NoSQL Operator Injection.  


### Added
- **Interactions Module:** Implemented a high-throughput, concurrency-safe engine for product reviews and threaded comments utilizing the Adjacency List pattern.
- **Async Aggregation Engine:** Added background `$cond` aggregation pipelines via `setImmediate()` to recalculate average ratings and 5-star distribution curves without blocking the main event loop.
- **Cross-Module Trust Layer:** Implemented internal validation against the `Orders` collection to mathematically grant the "Verified Purchase" badge.
- **Atomic Voting:** Integrated `$addToSet` and `$pull` operators for concurrency-safe helpful/unhelpful interaction voting.
- **Documentation:** Added `interaction-module.md` architecture blueprint and `interaction-runbook.md` for Thunder Client QA testing. Updated `api-standards.md` with the new endpoint directory.

### Fixed
- **Return Module (Mongoose 8+):** Resolved strict TypeScript `never` iterator errors by migrating `ReturnModel.create` to an array-based multi-document initialization signature.
- **Type Safety:** Corrected `exactOptionalPropertyTypes` compilation failures by explicitly conditionally mapping `customerNote` in DTO transformations.
- **CI/CD Pipeline:** Enforced strict Prettier formatting across the Returns service to satisfy GitHub Actions automated checks.
- **Runtime Integrity:** Replaced blind `as unknown as` assertions with physical runtime type guards for populated MongoDB relationships.

### Security
- **CWE-117 (Log Injection):** Hardened the `ReturnService` against CRLF injection by implementing strict newline stripping (`/[\r\n]/g`) on all user-controlled identifiers before passing them to the Winston transport layer.
- **CWE-400 (Memory Exhaustion):** Implemented strict mathematical bounds (`Math.min/max`) on the public Interaction `GET` route to prevent pagination-based heap exhaustion.
- **CWE-943 (NoSQL Injection):** Enforced physical `$eq` query wrappers across both Return and Interaction data access layers.

### Added
- **Returns (RMA) Module:** Complete reverse-logistics pipeline with a 3-stage state machine (Initiation, Arbitration, Refund/Restock).
- **Razorpay Refunds Integration:** Automated partial and full refund processing directly to the original payment source.
- **Atomic Restocking:** Automatic inventory restoration using MongoDB `$inc` operations upon successful return processing.
- **Return Notification Templates:** Four new transactional email templates and In-App alerts (`RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `RETURN_REFUNDED`).
- **RMA Policy Firewalls:** Automated rejection for items past the 7-day delivery window and strict enforcement of the `INNERWEAR` hygiene policy.

### Security
- **Financial Taint Protection:** Refund values are mathematically derived strictly from locked historical order snapshots, preventing client-side payload manipulation.
- **Double-Refund Prevention:** Added unique compound indexes and native `11000` duplicate key interception to neutralize concurrent return-request race conditions.
- **Arbitration Mandates:** Admin rejections now physically require a rejection reason to be sent to the customer via Zod schema enforcement.

### Added
- **Checkout Engine**: Fully atomic checkout process utilizing MongoDB Sessions to ensure absolute data integrity.
- **Payment Gateway**: End-to-end Razorpay integration supporting both COD and Prepaid financial flows.
- **Security Protocols**: Raw body stream interceptor implemented in `app.ts` to support 100% accurate HMAC-SHA256 verification.
- **Invoicing System**: `invoice.generator.ts` implemented to create binary PDF buffers in RAM, eliminating synchronous disk I/O.
- **Automation**: Background cron orchestrator to recover stock from abandoned PENDING orders every 15 minutes.
- **Communications**: New transactional templates for 'Order Placed' and 'Order Cancelled' (standardized to `order-cancel.ts`).

### Changed
- **Notification Service**: Expanded Facade architecture to handle order-related asynchronous triggers and In-App alerts.
- **Controller Layer**: Refactored `OrderPublicController` and `OrderAdminController` for strict TypeScript compliance and zero-any usage.
- **Service Layer**: Implemented explicit property mapping for shipping addresses to block NoSQL injection and mass assignment.
- **Documentation**: Updated `system-overview.md` to reflect Phase 3 completion and transition to Phase 4.

### Fixed
- **Webhook Validation**: Resolved HMAC mismatch vulnerabilities caused by standard Express JSON parsing.
- **Stock Integrity**: Neutralized race conditions in stock reservation using atomic `$inc` and `$gte` firewalls.

### Fixed
- **Security (User Module)**: Resolved a critical NoSQL Injection vulnerability (CWE-943) by implementing explicit `$eq` operators for all database lookups involving user-controlled identifiers.
- **Security (User Module)**: Hardened the `updateProfile` service against taint analysis alerts by implementing explicit field mapping, ensuring only authorized properties are sent to the database sink.
- **Security (Product Module)**: Mitigated potential Denial of Service (DoS) and brute-force vectors (CWE-770) by applying global rate-limiting to all public and administrative product routes.
- **Security (Product Module)**: Protected authorization and database sinks in the product router by enforcing request throttling before authentication checks.
- **Refactor**: Cleaned up redundant route definitions in `user.routes.ts` and standardized query patterns to use `findOne` and `findOneAndUpdate` for better auditability.  


### Added
- **Embedded Logistics Engine:** Engineered an `AddressSchema` embedded within the `User` document. Supports up to 10 saved locations with ACID-compliant, atomic transactions to autonomously toggle the `isDefault` delivery address.
- **Step-Up Authentication:** Upgraded password mutations to banking-level security. Changing a password now requires a two-factor cryptographic handshake: a 6-digit OTP (dispatched via email and cached in Redis for 10m) combined with the user's current bcrypt password.
- **Diskless Avatar Uploads:** Connected Multer's memory storage directly to the Cloudinary API pipeline, enabling lightning-fast profile picture updates without saving files to the local server disk.
- **Security Alert Templates:** Added new HTML email templates and In-App Database Notifications for critical security events (e.g., Password Updates).

### Changed & Optimized
- **Fire-and-Forget Notifications:** Refactored the `NotificationService` to prevent MongoDB latency from bottlenecking HTTP responses. All In-App database inserts (`Notification.create()`) are now offloaded to the Node.js background event loop as un-awaited, non-blocking promises.
- **Strict Queue Compiler:** Upgraded the BullMQ payload definitions (`EmailJobPayload`) to use strict TypeScript Discriminated Unions. The compiler now guarantees 100% payload accuracy (e.g., ensuring `changedField` and `time` exist before an email can be queued).
- **Controller Error Routing:** Completely refactored the `UserController` HTTP boundaries to safely wrap all asynchronous operations in `try/catch` blocks, passing rejections to Express's `NextFunction`. This eliminates unhandled promise rejections and routes all failures to the global `error.middleware.ts`.
- **Zero-'any' Compliance:** Refactored the entire User Module (Service, Controller, and Interface) to strictly adhere to the project's Zero-'any' TypeScript policy, utilizing safe casting and explicit interface mapping.

### Security
- **Mass Assignment Firewalls:** Deployed airtight Zod `.strict()` DTO schemas across all profile update routes. Any HTTP request attempting to inject restricted fields (e.g., `role: "ADMIN"`, `loyaltyPoints: 9999`) is now instantly rejected at the routing layer.
- **IDOR Prevention:** Enforced explicit ownership checks (`req.user._id`) across all Notification and Address mutation endpoints.

### Added
**Infrastructure Resiliency & Garbage Collection (Phase 5.2)**
- **Cloud Storage Garbage Collection (`base-product.model.ts`):** Engineered a Mongoose `pre('findOneAndDelete')` hook that intercepts product deletion events. It autonomously maps over the product's image array and concurrently executes `deleteFromCloudinary` promises, preventing permanent storage leaks and financial bloat.
- **Enterprise Graceful Shutdowns (`server.ts`):** Implemented a rigorous teardown orchestrator that intercepts `SIGINT` and `SIGTERM` signals. The sequence halts new Express traffic, allows in-flight ACID transactions and BullMQ workers to drain, and safely severs MongoDB and Redis connections before exiting the Node process.
- **Event Loop Failsafes:** Deployed `.unref()` on the shutdown force-kill timer to prevent artificial event loop blocking, and established global listeners for `uncaughtException` and `unhandledRejection` to catch and gracefully handle synchronous boot errors and orphaned promises.

### Fixed
- **Mongoose Hook Typings:** Resolved implicit 'any' types in the pre-delete hook by explicitly typing the Document Query context and safely casting the lean document payload to the `IBaseProduct` interface.
- **Server Initialization Sequence:** Fixed a potential unhandled crash vector by declaring the `server` variable with a union type (`Server | undefined`) and strictly verifying its initialization state before attempting to invoke `.close()` during a shutdown event.

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