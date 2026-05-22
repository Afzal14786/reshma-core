<div align="center">

# Architecture Documentation

**The deep‑dive into Reshma‑Core’s system design, security, data modelling, and infrastructure.**

[![Design](https://img.shields.io/badge/Domain--Driven_Design-43853D?style=flat&logo=databricks&logoColor=white)](#)
[![Security](https://img.shields.io/badge/Zero--Trust_Security-000000?style=flat&logo=cloudflare&logoColor=white)](#)
[![Scalability](https://img.shields.io/badge/Horizontal_Scalability-FF9900?style=flat&logo=aws&logoColor=white)](#)

</div>

Welcome to the architecture section of Reshma‑Core. Here you will find detailed explanations of the system's design decisions, security protocols, data modelling, and infrastructure.

Use the links below to navigate to specific topics.

---

## ore Design & Data Modelling

| Document | Description |
|----------|-------------|
| [Database Design & Polymorphic Catalog](./database-design.md) | Single‑collection polymorphism with Mongoose discriminators. |
| [Product Catalog Schema](./product-catalog.md) | Field mapping for bangles, apparel, fabrics, innerwear, accessories. |

## Security & Middleware

| Document | Description |
|----------|-------------|
| [Authentication Architecture](./auth-architecture.md) | Two‑token JWT, OTP, Google OAuth. |
| [Middleware & Validation](./middleware-and-validation.md) | Request lifecycle, sanitisation, rate limiting, error handling. |
| [Security Hardening](./security-hardening.md) | Helmet, NoSQL injection, XSS/CSRF, CodeQL mitigations. |

## Payments, Tax & Compliance

| Document | Description |
|----------|-------------|
| [Razorpay Integration](./payment-integration.md) | HMAC signatures, idempotency, webhooks. |
| [Legal & Tax Compliance](./legal-tax-compliance.md) | Indian GST, proportional discounting, DPDP/GDPR. |

## Performance & Scalability

| Document | Description |
|----------|-------------|
| [Background Jobs & Cron](./background-jobs-and-cron.md) | BullMQ queues, Redis distributed locking. |
| [Edge Cache](./edge-cache.md) | Redis proxy pattern, cache invalidation. |
| [Media & Storage](./media-and-storage.md) | Memory‑streamed Cloudinary uploads, orphan cleanup. |

## Logistics & DevOps

| Document | Description |
|----------|-------------|
| [Logistics & Shipping](./logistics-and-shipping.md) | Shiprocket, rolling JWT, webhook state machine. |
| [DevOps & Infrastructure](./devops-and-infrastructure.md) | Horizontal scaling, health probes, logging, graceful shutdown. |

---

<div align="center">

*The Reshma‑Core Team*

</div>