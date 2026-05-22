<div align="center">

  # Authentication Module

  **The highly secure, stateless perimeter defending the Reshma-Core platform. Manages identity verification, session persistence, and cryptographic token issuance.**

  [![JWT](https://img.shields.io/badge/JWT-Two--Token_Architecture-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
  [![Redis](https://img.shields.io/badge/Redis-OTP_&_Blacklisting-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Firewall-3068b7?style=flat)](https://zod.dev/)

</div>

---

## Overview

The Auth Module (`src/modules/auth/`) dictates how users enter and maintain their session. It is completely decoupled from the `User` model, focusing on **behaviour, cryptographic validation, and session state**.

It implements a strict OWASP‑compliant two‑token architecture to neutralise XSS and CSRF attacks. All routes are prefixed with `/api/v1/auth` and protected by a dedicated `authLimiter` (10 requests per hour per IP).

---

## Architectural Layers

The module adheres to Separation of Concerns, isolating HTTP transport from business logic.

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| **DTOs** | `dtos/*.dto.ts` (e.g., `register.dto.ts`, `login.dto.ts`) | Zod schemas – input sanitisation, password strength, legal consent (`acceptPrivacyPolicy`). |
| **Controller** | `auth.controller.ts` | HTTP boundary – receives validated payloads, calls service, issues tokens, sets `HttpOnly` cookies. |
| **Service** | `auth.service.ts` | Core logic – OTP generation, Redis interactions (caching & blacklist), Google OAuth verification, async notifications. |
| **Utils** | `auth.utils.ts` | JWT signing, cookie configuration (sameSite, secure, httpOnly). |

---

## API Endpoint Specifications

All endpoints are rate‑limited by `authLimiter` (10 requests/hour/IP).

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| `POST` | `/register` | Public | Creates user with `isEmailVerified: false`, generates OTP (Redis TTL 10 min), queues email. |
| `POST` | `/verify-otp` | Public | Validates OTP, deletes it (replay protection), activates user, issues two‑token session. |
| `POST` | `/login` | Public | Verifies credentials, checks `isEmailVerified` & `isActive`, issues session, updates `lastLogin`. |
| `GET` | `/refresh` | Public | Accepts `HttpOnly` refresh cookie, returns fresh access token. |
| `GET` | `/logout` | Protected | Blacklists refresh token in Redis, clears cookie. |
| `POST` | `/google` | Public | Verifies Google `idToken`, auto‑verifies email, merges unverified local accounts, issues native session. |
| `POST` | `/forgot-password` | Public | Sends password reset link (token stored in Redis, 15 min TTL). |
| `POST` | `/reset-password` | Public | Validates token, updates password (bcrypt hashed), deletes token. |

---

## Core Business Logic Highlights

### 1. Safe Collision Recovery (UX)
If a user registers but never verifies their OTP, their account remains in a “limbo” state. If they register again with the same email, the system **overwrites** their credentials (name, password, phone) and issues a fresh OTP – no `409 Conflict`. Prevents user frustration.

### 2. Redis State Management

| Purpose | Redis Command | TTL |
|---------|---------------|-----|
| OTP caching | `SETEX otp:email 600 <otp>` | 10 minutes |
| Token blacklist | `SETEX blacklist:token <remainingTTL> "revoked"` | Matches JWT expiry |
| Password reset token | `SETEX pwd_reset:<hash> 900 <userId>` | 15 minutes |

### 3. Two‑Token Pipeline

| Token | Lifespan | Storage | Purpose |
|-------|----------|---------|---------|
| **Access Token** | 15 min | Frontend memory (React state) | Authorises API requests. Destroyed on refresh. |
| **Refresh Token** | 7 days | `HttpOnly`, `Secure`, `SameSite=Strict` cookie | Silent token renewal. Invisible to JavaScript – immune to XSS. |

---

## Security Dependencies

- **`bcrypt`** – password hashing and verification.
- **`crypto.randomInt`** – cryptographically secure OTP generation (not `Math.random`).
- **`express-rate-limit`** – `authLimiter` distributed with Redis store.
- **`google-auth-library`** – verification of Google `idToken`.

---

## Related Files

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.controller.ts` | HTTP layer. |
| `src/modules/auth/auth.service.ts` | Business logic. |
| `src/modules/auth/auth.routes.ts` | Route definitions, middleware stacking. |
| `src/modules/auth/auth.utils.ts` | Token signing, cookie management. |
| `src/modules/auth/dtos/*.dto.ts` | Zod validation schemas. |
| `src/shared/middlewares/auth.middleware.ts` | `protect` – JWT verification & user loading. |
| `src/shared/middlewares/rate-limit.middleware.ts` | Distributed rate limiting (`authLimiter`). |

---

## See Also

- [Authentication Architecture (Deep Dive)](../architecture/auth-architecture.md)
- [Middleware & Validation](../architecture/middleware-and-validation.md)
- [User Module](./user-module.md)
- [Notification Module](./notification-module.md)

---

*The Reshma‑Core Team*