# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
*(Changes that are currently being worked on but not yet pushed to a stable alpha/beta tag will go here).*

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