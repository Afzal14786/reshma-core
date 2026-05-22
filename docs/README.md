<div align="center">

  # Reshma‑Core Documentation
  
  **The complete guide to developing, deploying, and integrating with the Reshma‑Core backend engine.**

  [![Docs](https://img.shields.io/badge/Getting_Started-Local_Setup-47A248?style=flat)](#getting-started)
  [![API](https://img.shields.io/badge/API-Reference-3448C5?style=flat)](#api-reference)
  [![Deployment](https://img.shields.io/badge/Deployment-Production-FF6B6B?style=flat)](#deployment)
  [![Architecture](https://img.shields.io/badge/Architecture-ADRs-000000?style=flat)](#architecture)

</div>

---

## 📖 Table of Contents

- [Welcome](#welcome)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Deployment Guide](#deployment-guide)
- [Architecture Deep Dives](#architecture-deep-dives)
- [Testing & Runbooks](#testing--runbooks)
- [Contributing to Docs](#contributing-to-docs)

---

## Welcome

This documentation covers everything you need to know about the Reshma‑Core backend – from setting up a local development environment to deploying in production, integrating with frontend applications, and understanding the architectural decisions that make the platform scalable, secure, and maintainable.

**Quick links:**

- [API Status Codes & Error Handling](./api/error-codes.md)
- [Authentication Flow](./api/authentication.md)
- [Environment Variables](./getting-started/environment-variables.md)
- [Docker Setup](./getting-started/docker-setup.md)

---

## Getting Started

New to the project? Start here.

| Document | Description |
|----------|-------------|
| [Local Development Setup](./getting-started/local-development.md) | Manual installation (Node, MongoDB, Redis, Typesense) |
| [Docker Setup](./getting-started/docker-setup.md) | Run the entire stack with Docker Compose |
| [Environment Variables Guide](./getting-started/environment-variables.md) | All required and optional `.env` variables |
| [Database Seeding](./getting-started/database-seeding.md) | Generate realistic product data |

---

## API Reference

Complete REST API documentation for frontend developers.

| Section | Description |
|---------|-------------|
| [API Overview](./api/README.md) | Base URLs, response shapes, pagination, rate limits |
| [Authentication](./api/authentication.md) | Two‑token JWT flow, refresh, logout |
| [Error Handling](./api/error-codes.md) | HTTP status codes, error payloads |
| [Rate Limiting](./api/rate-limiting.md) | Global and route‑specific limits |

### Module Endpoints

| Module | Description |
|--------|-------------|
| [Auth](./api/modules/auth.md) | Register, login, OTP, refresh, logout |
| [Users](./api/modules/users.md) | Profile, addresses, avatar, password, deletion |
| [Products](./api/modules/products.md) | Polymorphic catalog (public + admin CRUD) |
| [Cart](./api/modules/cart.md) | Cart operations, merge, coupons |
| [Orders](./api/modules/orders.md) | Checkout, payment, invoices, dispatch |
| [Returns](./api/modules/returns.md) | Return requests, admin arbitration, refunds |
| [Interactions](./api/modules/interactions.md) | Reviews, comments, voting |
| [Coupons](./api/modules/coupons.md) | Create, apply, remove promotions |
| [Wishlist](./api/modules/wishlist.md) | Add, move to cart, self‑healing |
| [Search](./api/modules/search.md) | Typo‑tolerant, faceted search |
| [Dashboard](./api/modules/dashboard.md) | Admin metrics (revenue, top products) |
| [Support](./api/modules/support.md) | Tickets, replies, state machine |
| [Notifications](./api/modules/notifications.md) | In‑app alerts |
| [Health](./api/modules/health.md) | Liveness probe |

---

## Deployment Guide

Take the application to production.

| Document | Description |
|----------|-------------|
| [Production Checklist](./deployment/production-checklist.md) | Pre‑flight verification (secrets, SSL, monitoring) |
| [Docker Compose (Production)](./deployment/docker-compose.md) | Running `docker-compose.prod.yml` |
| [CI/CD Automation](./deployment/ci-cd.md) | GitHub Actions, SSH deployment |

---

## Architecture Deep Dives

Understand the “why” behind the code.

| Document | Description |
|----------|-------------|
| [System Overview](./architecture/system-overview.md) | High‑level architecture, module boundaries |
| [Authentication Architecture](./architecture/auth-architecture.md) | Two‑token JWT, OTP, Redis blacklist |
| [Database Design & Polymorphism](./architecture/database-design.md) | Mongoose discriminators, indexes |
| [Product Catalog Schema](./architecture/product-catalog.md) | Polymorphic product types |
| [Security Hardening](./architecture/security-hardening.md) | CWE mitigations, Zod firewalls, rate limiting |
| [Payment Integration (Razorpay)](./architecture/payment-integration.md) | HMAC webhooks, idempotency |
| [Legal & Tax Compliance (GST)](./architecture/legal-tax-compliance.md) | CGST/SGST/IGST calculations |
| [Edge Cache](./architecture/edge-cache.md) | | Redis caching, BullMQ queues |
| [Background Jobs & Cron](./architecture/background-jobs-and-cron.md) | BullMQ queues |
| [DevOps & Infrastructure](./architecture/devops-and-infrastructure.md) | Horizontal scaling, health checks |

---

## Testing & Runbooks

Manual test sequences for each module (Thunder Client / Postman).  
Located in [`./api/thunder-tests/`](./api/thunder-tests/).

| Runbook | Module |
|---------|--------|
| [Auth Runbook](./api/thunder-tests/auth-runbook.md) | Registration, OTP, login, refresh, logout |
| [User Runbook](./api/thunder-tests/user-runbook.md) | Profile, addresses, password change |
| [Product Runbook](./api/thunder-tests/product-runbook.md) | Admin CRUD, polymorphic validation |
| [Cart Runbook](./api/thunder-tests/cart-runbook.md) | Add, merge, coupons |
| [Order Runbook](./api/thunder-tests/order-runbook.md) | Checkout, webhooks, dispatch |
| [Return Runbook](./api/thunder-tests/return-runbook.md) | Initiate, arbitrate, refund |
| [Interaction Runbook](./api/thunder-tests/interaction-runbook.md) | Reviews, comments, voting |
| [Coupon Runbook](./api/thunder-tests/coupon-runbook.md) | Create, apply |
| [Wishlist Runbook](./api/thunder-tests/wishlist-runbook.md) | Add, move, clear |
| [Search Runbook](./api/thunder-tests/search-runbook.md) | Typo tolerance, faceting |
| [Dashboard Runbook](./api/thunder-tests/dashboard-runbook.md) | Metrics, date ranges |
| [Support Runbook](./api/thunder-tests/support-runbook.md) | Tickets, replies, state changes |

---

## Contributing to Docs

Found a mistake or missing section? Please open an issue or pull request.  
Documentation is written in Markdown with Mermaid diagrams. The source is in `/docs/` at the repository root.

**Style guide:** Use descriptive headers, tables for endpoint details, and code blocks for JSON examples. Badges are optional but encouraged for visual grouping.

---

<div align="center">

Built with ❤️ and strict TypeScript – [Reshma‑Core Team](https://github.com/Afzal14786)

</div>