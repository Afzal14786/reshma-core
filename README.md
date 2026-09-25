<!-- Full‑width banner -->
<img src="src/assets/banner.png" alt="Reshma Bangles & Boutique - API Core" style="width: 100%; display: block; margin: 0;" />

<br />

<div align="center">

# 🛍️ Reshma Bangles & Boutique (API Core)

**The highly scalable, polymorphic backend engine powering a pan‑India B2C fashion and accessory platform.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![CodeQL](https://img.shields.io/badge/CodeQL-Security_Scan-1C2C4E?style=flat&logo=github&logoColor=white)](https://codeql.github.com/)
![Tests](https://github.com/Afzal14786/reshma-core/actions/workflows/test.yml/badge.svg)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENCE)

</div>

---

## Table of Contents

- [About the Startup](#about-the-startup)
- [Key Features & Business Logic](#key-features--business-logic)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation & Run (npm)](#installation--run-npm)
  - [Run with Docker Compose](#run-with-docker-compose)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Testing Guides](#testing-guides)
- [Testing](#testing)
- [Documentation Hub](#documentation-hub)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Author](#author)

---

## About the Startup

**Reshma Bangles & Boutique** is a dedicated B2C online retail platform serving customers across India. The catalog spans highly diverse categories, from fragile glass bangles sold by the dozen, to readymade apparel, and unstitched fabrics that require custom tailoring measurements.

This backend is built to handle that complexity natively – using a polymorphic database design, dynamic GST calculations, and a stateless JWT architecture that scales horizontally.

---

## Key Features & Business Logic

- **Polymorphic Product Catalog** – One `Products` collection with Mongoose discriminators: Bangles, Apparel, Fabric, Innerwear, Accessories. Each type enforces its own validation rules.
- **Dynamic Checkout Math** – Automatic computation of Base Price + GST (CGST/SGST/IGST) + shipping fees + COD surcharges.
- **Proportional Discounting** – Cart‑level coupons are distributed across line items so refunds reflect the actual consideration paid.
- **Two‑Token Authentication** – Short‑lived Access Token (memory) + `HttpOnly` Refresh Token (cookie). Immune to XSS and CSRF.
- **Background Workers (BullMQ)** – Email sending, PDF invoice generation, and search index synchronisation never block the main event loop.
- **Redis Edge Cache** – Public catalog responses are cached in Redis (5‑minute TTL) to shield MongoDB from thundering herds.
- **Typesense Search** – Sub‑50ms typo‑tolerant search with faceted filtering, synchronised asynchronously.
- **Shiprocket Integration** – Automated order dispatch, AWB generation, and webhook‑driven delivery status updates.
- **Return & Refund Engine** – 3‑stage state machine with Razorpay refunds and atomic inventory restocking.
- **Support Ticketing** – Threaded conversations, Cloudinary image attachments, and full DPDP/GDPR anonymisation.
- **Admin Dashboard** – Real‑time financial aggregations using MongoDB `$facet` pipelines.
- **Data Portability** – Asynchronous JSON export of user data (Right to Access) and irreversible scrubbing (Right to be Forgotten).

---

## Comprehensive Tech Stack

| Category | Technology | Badges | Description / Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime & Framework** | Node.js<br>Express.js | [![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)<br>[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/) | Core asynchronous I/O engine and web framework. |
| **Language** | TypeScript | [![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) | Strict type safety; `noImplicitAny`, `strictNullChecks`. |
| **Database & ODM** | MongoDB<br>Mongoose | [![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)<br>[![Mongoose](https://img.shields.io/badge/Mongoose-9.x-880000?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com/) | Polymorphic catalog scaling and ACID transactions. |
| **Queue & Caching** | Redis<br>BullMQ | [![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)<br>[![BullMQ](https://img.shields.io/badge/BullMQ-5.x-FF4081?style=flat)](https://bullmq.io/) | Background jobs, distributed rate limiting, edge caching. |
| **Search Engine** | Typesense | [![Typesense](https://img.shields.io/badge/Typesense-0.25-000000?style=flat&logo=typesense&logoColor=white)](https://typesense.org/) | RAM‑based, typo‑tolerant product search (<50ms). |
| **Authentication** | JWT<br>bcrypt<br>Google OAuth | [![JWT](https://img.shields.io/badge/JWT-Two--Token-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)<br>[![bcrypt](https://img.shields.io/badge/bcrypt-6.x-3C6E71?style=flat)](https://www.npmjs.com/package/bcrypt)<br>[![Google OAuth](https://img.shields.io/badge/Google-OAuth-4285F4?style=flat&logo=google&logoColor=white)](https://developers.google.com/identity/protocols/oauth2) | Stateless two‑token sessions, password hashing, social login. |
| **Payments** | Razorpay | [![Razorpay](https://img.shields.io/badge/Razorpay-SDK_&_Webhooks-0C0C0C?style=flat&logo=razorpay&logoColor=white)](https://razorpay.com/) | HMAC‑verified, idempotent payment transactions. |
| **Logistics** | Shiprocket | [![Shiprocket](https://img.shields.io/badge/Shiprocket-3PL-4B9CD3?style=flat)](https://www.shiprocket.in/) | Automated courier dispatch, AWB generation, tracking webhooks. |
| **Email** | Nodemailer<br>BullMQ<br>MJML | [![Nodemailer](https://img.shields.io/badge/Nodemailer-SMTP-14C3B8?style=flat)](https://nodemailer.com/)<br>[![MJML](https://img.shields.io/badge/MJML-Responsive_Emails-00B2A9?style=flat)](https://mjml.io/) | Asynchronous transactional emails with responsive design. |
| **Media Pipeline** | Cloudinary<br>Multer | [![Cloudinary](https://img.shields.io/badge/Cloudinary-Image_Streams-3448C5?style=flat&logo=cloudinary&logoColor=white)](https://cloudinary.com/)<br>[![Multer](https://img.shields.io/badge/Multer-Memory_Storage-orange?style=flat)](https://github.com/expressjs/multer) | Memory‑stream uploads, on‑the‑fly compression, Exif stripping. |
| **Logging & Monitoring** | Winston<br>Morgan | [![Winston](https://img.shields.io/badge/Winston-Daily_Rotation-4F5D95?style=flat)](https://github.com/winstonjs/winston)<br>[![Morgan](https://img.shields.io/badge/Morgan-HTTP_Logger-3C8C40?style=flat)](https://github.com/expressjs/morgan) | Structured JSON logs, daily rotation, HTTP request telemetry. |
| **Security** | Helmet<br>Rate Limit<br>Mongo Sanitize<br>Zod | [![Helmet](https://img.shields.io/badge/Helmet-Headers-blue?style=flat)](https://helmetjs.github.io/)<br>[![Rate Limit](https://img.shields.io/badge/Rate_Limit-Redis-red?style=flat)](https://github.com/express-rate-limit/rate-limit-redis)<br>[![Zod](https://img.shields.io/badge/Zod-Validation-3068b7?style=flat)](https://zod.dev/) | Defense in depth: HTTP headers, distributed rate limiting, NoSQL injection prevention, runtime validation. |
| **Documentation** | Markdown<br>Mermaid | [![Markdown](https://img.shields.io/badge/Markdown-Docs-000000?style=flat&logo=markdown&logoColor=white)](https://www.markdownguide.org/)<br>[![Mermaid](https://img.shields.io/badge/Mermaid-Diagrams-FF3670?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) | Architecture diagrams, runbooks, and API guides. |  

---

## System Architecture & Complete Folder Structure

Reshma‑Core follows **Domain‑Driven Design:** features (Auth, Users, Products, Cart, Orders, etc.) live in their own modules under `src/modules/`. Each module contains controllers, services, DTOs (Zod), models, and interfaces.  

The **polymorphic catalog** uses Mongoose discriminators – all products live in one `Products` collection, but sub‑schemas enforce category‑specific fields (e.g., `bangleSizes`, `lengthMeters`).  

For a deep dive, see the [System Overview](./docs/architecture/system-overview.md) which links to every architecture decision record (ADR), module documentation, and security hardening guide.  

```text
reshma-core/
├── .dockerignore
├── .env.example
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   └── feature_request.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── dependabot.yml
│   └── workflows/
│       ├── format-check.yml
│       └── security-ci.yml
├── .gitignore
├── CHANGES.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── Dockerfile
├── LICENCE
├── README.md
├── SECURITY.md
├── docker-compose.prod.yml
├── docker-compose.yml
├── docs/
│   ├── README.md
│   ├── api/
│   │   ├── README.md
│   │   ├── authentication.md
│   │   ├── error-codes.md
│   │   ├── modules/
│   │   │   ├── auth.md
│   │   │   ├── cart.md
│   │   │   ├── coupons.md
│   │   │   ├── dashboard.md
│   │   │   ├── health.md
│   │   │   ├── interactions.md
│   │   │   ├── notifications.md
│   │   │   ├── orders.md
│   │   │   ├── products.md
│   │   │   ├── returns.md
│   │   │   ├── search.md
│   │   │   ├── support.md
│   │   │   ├── users.md
│   │   │   └── wishlist.md
│   │   ├── rate-limiting.md
│   │   └── thunder-tests/
│   │       ├── auth-runbook.md
│   │       ├── cart-runbook.md
│   │       ├── coupon-runbook.md
│   │       ├── dashboard-runbook.md
│   │       ├── interaction-runbook.md
│   │       ├── order-runbook.md
│   │       ├── product-runbook.md
│   │       ├── return-runbook.md
│   │       ├── search-runbook.md
│   │       ├── support-runbook.md
│   │       ├── user-runbook.md
│   │       └── wishlist-runbook.md
│   ├── architecture/
│   │   ├── README.md
│   │   ├── auth-architecture.md
│   │   ├── background-jobs-and-cron.md
│   │   ├── database-design.md
│   │   ├── devops-and-infrastructure.md
│   │   ├── edge-cache.md
│   │   ├── legal-tax-compliance.md
│   │   ├── logistics-and-shipping.md
│   │   ├── media-and-storage.md
│   │   ├── middleware-and-validation.md
│   │   ├── payment-integration.md
│   │   ├── product-catalog.md
│   │   ├── security-hardening.md
│   │   └── system-overview.md
│   ├── deployment/
│   │   ├── README.md
│   │   ├── ci-cd.md
│   │   ├── docker-compose.md
│   │   └── production-checklist.md
│   ├── getting-started/
│   │   ├── README.md
│   │   ├── database-seeding.md
│   │   ├── docker-setup.md
│   │   ├── environment-variables.md
│   │   └── local-development.md
│   ├── glossary.md
│   └── modules/
│       ├── README.md
│       ├── auth-module.md
│       ├── cart-module.md
│       ├── coupon-module.md
│       ├── dashboard-module.md
│       ├── health-module.md
│       ├── interaction-module.md
│       ├── notification-module.md
│       ├── order-module.md
│       ├── product-module.md
│       ├── return-module.md
│       ├── search-module.md
│       ├── support-module.md
│       ├── user-module.md
│       └── wishlist-module.md
├── package-lock.json
├── package.json
├── src/
│   ├── app.ts
│   ├── assets/
│   │   ├── app-icon-reshma-boutique.png
│   │   ├── banner.png
│   │   └── reshma_bangles.jpg
│   ├── config/
│   │   ├── cloudinary.ts
│   │   ├── db.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── razorpay.ts
│   │   ├── redis.ts
│   │   ├── shiprocket.ts
│   │   └── typesense.ts
│   ├── db/
│   │   └── seed.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.utils.ts
│   │   │   └── dtos/
│   │   │       ├── google.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       ├── register.dto.ts
│   │   │       ├── reset-password.dto.ts
│   │   │       └── verify-otp.dto.ts
│   │   ├── cart/
│   │   │   ├── cart.controller.ts
│   │   │   ├── cart.model.ts
│   │   │   ├── cart.route.ts
│   │   │   ├── cart.service.ts
│   │   │   ├── dtos/
│   │   │   │   └── cart.dto.ts
│   │   │   └── interfaces/
│   │   │       └── cart.interface.ts
│   │   ├── coupons/
│   │   │   ├── coupon.controller.ts
│   │   │   ├── coupon.model.ts
│   │   │   ├── coupon.routes.ts
│   │   │   ├── coupon.service.ts
│   │   │   ├── dtos/
│   │   │   │   └── coupon.dto.ts
│   │   │   └── interfaces/
│   │   │       └── coupon.interface.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── dtos/
│   │   │   │   └── date-range.dto.ts
│   │   │   └── interfaces/
│   │   │       └── dashboard.interface.ts
│   │   ├── health/
│   │   │   ├── health.controller.ts
│   │   │   └── health.routes.ts
│   │   ├── interactions/
│   │   │   ├── dtos/
│   │   │   │   ├── create-interaction.dto.ts
│   │   │   │   └── vote-interaction.dto.ts
│   │   │   ├── interaction.controller.ts
│   │   │   ├── interaction.model.ts
│   │   │   ├── interaction.routes.ts
│   │   │   ├── interaction.service.ts
│   │   │   └── interfaces/
│   │   │       └── interaction.interface.ts
│   │   ├── notifications/
│   │   │   ├── interface/
│   │   │   │   ├── email.interface.ts
│   │   │   │   └── notification.interface.ts
│   │   │   ├── notification.controller.ts
│   │   │   ├── notification.model.ts
│   │   │   ├── notification.routes.ts
│   │   │   ├── notification.service.ts
│   │   │   └── templates/
│   │   │       ├── data-export.ts
│   │   │       ├── layout.ts
│   │   │       ├── order-cancel.ts
│   │   │       ├── order-delivered.ts
│   │   │       ├── order-placed.ts
│   │   │       ├── order-shipped.ts
│   │   │       ├── otp-verification.ts
│   │   │       ├── password-reset.ts
│   │   │       ├── password-update.ts
│   │   │       ├── return-approved.ts
│   │   │       ├── return-refunded.ts
│   │   │       ├── return-rejected.ts
│   │   │       ├── return-requested.ts
│   │   │       ├── ticket-created.ts
│   │   │       ├── ticket-replied.ts
│   │   │       └── welcome.ts
│   │   ├── orders/
│   │   │   ├── dtos/
│   │   │   │   └── order.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── order.interface.ts
│   │   │   ├── invoice.generator.ts
│   │   │   ├── order.admin.controller.ts
│   │   │   ├── order.model.ts
│   │   │   ├── order.public.controller.ts
│   │   │   ├── order.routes.ts
│   │   │   ├── order.service.ts
│   │   │   ├── payment.utils.ts
│   │   │   ├── shiprocket.service.ts
│   │   │   └── tax.utils.ts
│   │   ├── products/
│   │   │   ├── controllers/
│   │   │   │   ├── product.admin.controller.ts
│   │   │   │   └── product.public.controller.ts
│   │   │   ├── dtos/
│   │   │   │   ├── product.admin.dto.ts
│   │   │   │   └── product.public.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── accessory.interface.ts
│   │   │   │   ├── apparel.interface.ts
│   │   │   │   ├── bangle.interface.ts
│   │   │   │   ├── base-product.interface.ts
│   │   │   │   ├── fabric.interface.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── innerwear.interface.ts
│   │   │   ├── models/
│   │   │   │   ├── accessory.model.ts
│   │   │   │   ├── apparel.model.ts
│   │   │   │   ├── bangle.model.ts
│   │   │   │   ├── base-product.model.ts
│   │   │   │   ├── fabric.model.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── innerwear.model.ts
│   │   │   ├── product.routes.ts
│   │   │   └── product.service.ts
│   │   ├── returns/
│   │   │   ├── dtos/
│   │   │   │   └── return.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── return.interface.ts
│   │   │   ├── return.admin.controller.ts
│   │   │   ├── return.model.ts
│   │   │   ├── return.public.controller.ts
│   │   │   ├── return.route.ts
│   │   │   └── return.service.ts
│   │   ├── search/
│   │   │   ├── dtos/
│   │   │   │   └── search.dto.ts
│   │   │   ├── search.controller.ts
│   │   │   ├── search.routes.ts
│   │   │   └── search.service.ts
│   │   ├── support/
│   │   │   ├── dtos/
│   │   │   │   └── support.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── support.interface.ts
│   │   │   ├── support.admin.controller.ts
│   │   │   ├── support.model.ts
│   │   │   ├── support.public.controller.ts
│   │   │   ├── support.routes.ts
│   │   │   └── support.service.ts
│   │   ├── users/
│   │   │   ├── dtos/
│   │   │   │   ├── address.dto.ts
│   │   │   │   ├── security.dto.ts
│   │   │   │   └── update-profile.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── user.interface.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.model.ts
│   │   │   ├── user.routes.ts
│   │   │   └── user.service.ts
│   │   └── wishlists/
│   │       ├── dtos/
│   │       │   └── wishlist.dto.ts
│   │       ├── interfaces/
│   │       │   └── wishlist.interface.ts
│   │       ├── wishlist.controller.ts
│   │       ├── wishlist.model.ts
│   │       ├── wishlist.routes.ts
│   │       └── wishlist.service.ts
│   ├── routes/
│   │   └── index.ts
│   ├── server.ts
│   └── shared/
│       ├── constant/
│       │   └── http-codes.ts
│       ├── cron/
│       │   └── order-recovery.cron.ts
│       ├── infrastructure/
│       │   └── mailer.ts
│       ├── middlewares/
│       │   ├── auth.middleware.ts
│       │   ├── cache.middleware.ts
│       │   ├── error.middleware.ts
│       │   ├── http-logger.ts
│       │   ├── rate-limit.middleware.ts
│       │   ├── role.middleware.ts
│       │   ├── upload.middleware.ts
│       │   └── validate.middleware.ts
│       ├── queues/
│       │   ├── email.queue.ts
│       │   ├── email.worker.ts
│       │   ├── export.queue.ts
│       │   ├── export.worker.ts
│       │   ├── invoice.queue.ts
│       │   └── invoice.worker.ts
│       ├── types/
│       │   └── express.d.ts
│       └── utils/
│           ├── api-response.ts
│           ├── app-error.ts
│           ├── cache.utils.ts
│           └── sanitizer.ts
└── tsconfig.json
```
---

## Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **npm** (comes with Node)
- **MongoDB** 6+ (local or Atlas)
- **Redis** 7+ (local or Docker)
- (Optional) **Docker** and **Docker Compose** for full stack

### Installation & Run (npm)

```bash
# Clone the repository
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core

# Install dependencies
npm install

# Create environment file from template
cp .env.example .env

# Edit .env – set MONGO_URI, REDIS_URL, etc. (see Environment Variables section)

# Build TypeScript
npm run build

# Seed the database with initial products and roles (optional)
npm run seed

# Start development server (hot‑reload)
npm run dev
```  
The API will be available at `http://localhost:5000`.  

### Run with Docker Compose  

The `docker-compose.yml` launches all five services: API, worker, MongoDB, Redis, and Typesense.  
```bash
docker compose up -d

# View logs
docker compose logs -f reshma-api

# Stop everything
docker compose down
```  
Environment variables are already injected for internal service names. The API will be on port 5000.  

---  

## Environment Variables  
Critical variables (see `.env.example` for the full list):  

| Variable                     | Purpose                               | Example (local)                                      |
|------------------------------|---------------------------------------|------------------------------------------------------|
| `PORT`                       | API listening port                    | `5000`                                               |
| `MONGO_URI`                  | MongoDB connection string             | `mongodb://localhost:27017/reshma-core`              |
| `REDIS_URL`                  | Redis connection                      | `redis://localhost:6379`                             |
| `JWT_ACCESS_SECRET`          | Short‑lived access token secret       | 64‑character hex string                              |
| `JWT_REFRESH_SECRET`         | Refresh token secret                  | 64‑character hex string                              |
| `RAZORPAY_KEY_ID` / `SECRET` | Payment gateway credentials           | from Razorpay dashboard                              |
| `TYPESENSE_HOST` / `API_KEY` | Search engine endpoint                | `localhost` / `your-super-secret-key`                |
| `SMTP_HOST` / `USER` / `PASS`| Email sending (e.g., Gmail app password) | `smtp.gmail.com`, your email, app password         |

For detailed explanations, see [Environment Variables Guide](./docs/getting-started/environment-variables.md).  

---  

## API Reference  
All routes are versioned under `/api/v1`. Standard response format:  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2026-05-14T10:00:00.000Z"
}
```  

**Main endpoint groups** (see [API Standards](./docs/api/README.md) for full details):  

| Module          | Base Route        | Description                                                       |
|-----------------|-------------------|-------------------------------------------------------------------|
| Auth            | `/auth`           | Register, login, refresh, logout, OTP                             |
| Users           | `/users`          | Profile, addresses, password update                               |
| Products        | `/products`       | Catalog (public) + admin CRUD                                     |
| Cart            | `/cart`           | Add/remove items, merge guest cart                                |
| Orders          | `/orders`         | Checkout, payment verification, webhooks                          |
| Returns         | `/returns`        | Initiate return, admin arbitration                                |
| Interactions    | `/interactions`   | Reviews, comments, voting                                         |
| Coupons         | `/coupons`        | Create, apply, remove                                             |
| Wishlist        | `/wishlists`      | Add, move to cart, clear                                          |
| Notifications   | `/notifications`  | Fetch in‑app alerts, mark read                                    |
| Search          | `/search`         | Typo‑tolerant product search                                      |
| Dashboard       | `/dashboard`      | Admin metrics (revenue, top products)                             |
| Support         | `/support`        | Ticket creation, replies, state management                        |  

Error codes follow REST conventions – see [Error Codes Guide](./docs/api/error-codes.md).  

---  

## Testing Guides  
Manual runbooks (Thunder Client / Postman) are provided for every module:  

* [Authentication Runbook](./docs/api/thunder-tests/auth-runbook.md)
* [Product Catalog Runbook](./docs/api/thunder-tests/product-runbook.md)
* [Cart & Coupon Runbook](./docs/api/thunder-tests/coupon-runbook.md)
* [Order & Logistics Runbook](./docs/api/thunder-tests/order-runbook.md)
* [Returns Runbook](./docs/api/thunder-tests/return-runbook.md)
* [Interactions Runbook](./docs/api/thunder-tests/interaction-runbook.md)
* [Wishlist Runbook](./docs/api/thunder-tests/wishlist-runbook.md)
* [Search Runbook](./docs/api/thunder-tests/search-runbook.md)
* [Dashboard Runbook](./docs/api/thunder-tests/dashboard-runbook.md)
* [Support Runbook](./docs/api/thunder-tests/support-runbook.md)

Use them to verify functionality after local setup.  

---  

## Testing  

This project maintains a comprehensive test suite with **226 automated tests** across infrastructure, unit, and integration layers. All tests run in fully isolated Docker environments — no access to development or production data is possible.  

```bash
# Run unit tests (172 tests, ~10s)
npm run test:docker:unit

# Run integration tests (46 tests, ~65s)
npm run test:docker:integration
```  

**[📖 Read the full testing guide →](./tests/README.md)**  

The guide covers:  
- Test architecture and Docker isolation
- Coverage matrix per module
- How to write new tests
- Troubleshooting common failures
- Production bugs discovered through testing  

---  

### Documentation  

- **[Testing Guide](./tests//README.md)** — how to run, write, and debug tests
- **[CHANGES.md](./CHANGES.md)** — recent changes and bug fixes
- **[Phase Runbooks](./tests/README.md)** — detailed phase-by-phase runbooks  

## Documentation Hub  

All internal documentation lives in the `docs/` folder.  

### Architecture & System Design  

* [System Overview](./docs/architecture/system-overview.md) – master blueprint and ADRs
* [Authentication Architecture](./docs/architecture/auth-architecture.md) – two‑token JWT, OTP flows, Redis blacklist
* [Database Design & Polymorphism](./docs/architecture/database-design.md) – Mongoose discriminators
* [Product Catalog Schema](./docs/architecture/product-catalog.md) – mapping Google Sheets to database
* [Security Hardening](./docs/architecture/security-hardening.md) – Helmet, rate limits, Zod firewalls
* [Payment Integration (Razorpay)](./docs/architecture/payment-integration.md) – HMAC verification, webhooks
* [Legal & Tax Compliance (GST)](./docs/architecture/legal-tax-compliance.md) – dynamic Indian tax engine
* [Edge Cache & Workers](./docs/architecture/edge-cache-and-workers.md) – Redis proxy, BullMQ PDF generation
* [DevOps & Infrastructure](./docs/architecture/devops-and-infrastructure.md) – horizontal scaling, deep health checks  

### Module Deep Dives  

* [Auth Module](./docs/modules/auth-module.md)
* [User Module](./docs/modules/user-module.md)
* [Product Module](./docs/modules/product-module.md)
* [Cart Module](./docs/modules/cart-module.md)
* [Order Module](./docs/modules/order-module.md)
* [Return Module](./docs/modules/return-module.md)
* [Notification Module](./docs/modules/notification-module.md)
* [Coupon Module](./docs/modules/coupon-module.md)
* [Wishlist Module](./docs/modules/wishlist-module.md)
* [Interaction Module](./docs/modules/interaction-module.md)
* [Search Module](./docs/modules/search-module.md)
* [Dashboard Module](./docs/modules/dashboard-module.md)
* [Support Module](./docs/modules/support-module.md)  

### Setup & Environment  

* [Local Development Setup](./docs/getting-started/local-development.md)
* [Environment Variables Guide](./docs/getting-started/environment-variables.md)
* [Database Seeding](./docs/getting-started/database-seeding.md)
* [Docker Setup](./docs/getting-started/docker-setup.md)  

### API Reference & Testing  

* [API Overview](./docs/api/README.md) – base URLs, response shapes, rate limits
* [Authentication Guide](./docs/api/authentication.md) – detailed token flow 
* [Error Handling Guide](./docs/api/error-codes.md) – status codes, error shapes
* [Rate Limiting Guide](./docs/api/rate-limiting.md) – global and route‑specific limits
* [Testing Runbooks](./docs/api/thunder-tests/) – manual Thunder Client tests for each module

### Deployment  

The project is ready for production deployment on any cloud platform (AWS ECS, Render, Railway, or a VPS).  

* [Production Checklist](./docs/deployment/production-checklist.md) – pre‑flight verification
* [Docker Compose (Production)](./docs/deployment/docker-compose.md) – running docker-compose.prod.yml
* [CI/CD Automation](./docs/deployment/ci-cd.md) – GitHub Actions, SSH deployment 

For a detailed guide, see [DevOps & Infrastructure](./docs/architecture/devops-and-infrastructure.md).  

---  

## Contributing  

We welcome contributions that improve security, performance, or add well‑specified features. Please read:  

* [Contributing Guidelines](./CONTRIBUTING.md) – coding standards, pull request workflow, commit conventions
* [Code of Conduct](./CODE_OF_CONDUCT.md)
* [Security Policy](./SECURITY.md) – how to report vulnerabilities privately

**Key rules:** no `any` TypeScript, all inputs validated with Zod, JWT authentication required for protected routes, and all code must pass `npm run format` and `npm run build`.  

---  

## Security  

Reshma‑Core implements defense in depth: helmet headers, distributed rate limiting (Redis), NoSQL injection sanitisation (`express‑mongo‑sanitize`), two‑token JWT, and HTTP‑only cookies. See [SECURITY.md](./SECURITY.md) for full details and vulnerability reporting.  

---  

## License  

This project is proprietary. All rights reserved. See [LICENCE](./LICENCE) for terms. You may not copy, modify, or distribute the software without explicit permission from the copyright holder.  

---  

<div align="center">

## Author

**“Building robust, strictly‑typed systems that scale gracefully.”**

</div>

<div align="center">

I am **Md Afzal Ansari**, a Software Developer who bridges high‑level application engineering with systems‑level thinking. I specialise in the **MERN stack** (MongoDB, Express, React, Node.js) and **C++ systems programming**, and I am deeply passionate about:

</div>

<div align="left">

- **Scalable backend architectures** – designing for horizontal scaling, statelessness, and asynchronous processing (BullMQ, Redis).
- **Type safety & correctness** – enforcing `noImplicitAny`, Zod runtime validation, and exhaustive TypeScript patterns.
- **Domain‑Driven Design** – structuring code by business features, not technical layers.
- **Performance & resilience** – edge caching, distributed rate limiting, graceful shutdowns, and dead‑letter queues.

</div>

<div align="center">

I have built this e‑commerce engine from the ground up – integrating polymorphic product catalogs, dynamic Indian GST calculations, two‑token JWT authentication, real‑time search with Typesense, and automated logistics via Shiprocket. Every line of code respects strict security policies (CodeQL, Helmet, NoSQL injection prevention) and a zero‑`any` TypeScript discipline.

Currently based in **India**, I am actively developing production‑grade applications and contributing to open‑source. I believe that clean, well‑tested, and well‑documented code is the foundation of any successful digital business.

### Let’s Connect

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/0x4f5a4c/)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/Afzal14786)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=flat&logo=instagram&logoColor=white)](https://instagram.com/iamafzal.ansari)
[![Portfolio](https://img.shields.io/badge/Portfolio-2563EB?style=flat&logo=globe&logoColor=white)](https://iamafzal-dev.vercel.app)
[![Email](https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white)](mailto:mdafzal14777@gmail.com)

---

⭐ *If you found this architecture or codebase helpful, please consider giving it a star on GitHub!* ⭐

<br />

`Built with ❤️ and strict TypeScript by Md Afzal Ansari`

</div>
