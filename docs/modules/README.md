<div align="center">

# Domain Modules

**Deep dives into Reshma‑Core’s business features and their implementations.**

[![Modules](https://img.shields.io/badge/Domain--Driven_Design-43853D?style=flat)](#)
[![TypeScript](https://img.shields.io/badge/Strict_Typing-3178C6?style=flat)](#)
[![Zod](https://img.shields.io/badge/Zod_Validation-3068b7?style=flat)](#)

</div>

Welcome to the domain modules section. Each document explains a specific feature of the platform – its responsibilities, API endpoints, business logic, and security considerations.

Use the links below to navigate.

---

## Module Index

| Module | Description | Key Technologies |
|--------|-------------|------------------|
| [Authentication](./auth-module.md) | Registration, login, OTP, JWT, Google OAuth | JWT, Redis, BullMQ, Zod |
| [User](./user-module.md) | Profile, addresses, password management | Mongoose, bcrypt, Zod |
| [Product](./product-module.md) | Polymorphic catalog, CRUD, Cloudinary, Typesense sync | Mongoose discriminators, Cloudinary, Zod |
| [Cart](./cart-module.md) | Dynamic pricing, guest merge, coupon integration | MongoDB atomic updates, Zod |
| [Order](./order-module.md) | Checkout, ACID transactions, Razorpay, Shiprocket | MongoDB sessions, Razorpay, BullMQ |
| [Coupon](./coupon-module.md) | Discount engine, temporal & scarcity firewalls | MongoDB `$expr`, Zod `superRefine` |
| [Wishlist](./wishlist-module.md) | Lazy initialisation, move‑to‑cart | MongoDB atomic operators |
| [Notification](./notification-module.md) | Email (BullMQ) + in‑app alerts (MongoDB) | BullMQ, Nodemailer, MJML |
| [Interaction](./interaction-module.md) | Reviews, threaded comments, voting | Adjacency list, async aggregation |
| [Return](./return-module.md) | RMA state machine, refunds, restocking | Razorpay refunds, ACID transactions |
| [Support](./support-module.md) | Ticketing, threaded conversations, DPDP anonymisation | Embedded documents, Cloudinary |
| [Search](./search-module.md) | Typesense RAM cluster, eventual consistency | Typesense, BullMQ DLQ |
| [Dashboard](./dashboard-module.md) | Admin metrics, `$facet` aggregations | MongoDB aggregation, Redis locks |
| [Health](./health-module.md) | Deep liveness probe, dependency checks | MongoDB, Redis, Typesense pings |

---

## Architecture Overview

For system‑level design, security, and infrastructure, see the [Architecture Documentation](../architecture/README.md).

---

*The Reshma‑Core Team*