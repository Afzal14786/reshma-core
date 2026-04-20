<div align="center">

  # Authentication Module
  
  **The highly secure, stateless perimeter defending the Reshma-Core platform. Manages identity verification, session persistence, and cryptographic token issuance.**

  [![JWT](https://img.shields.io/badge/JWT-Two--Token_Architecture-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
  [![Redis](https://img.shields.io/badge/Redis-OTP_&_Blacklisting-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Firewall-3068b7?style=flat)](https://zod.dev/)

</div>

---

## Overview

The Auth Module (`src/modules/auth/`) dictates how users enter and maintain their session within the system. It is completely decoupled from the `User` model's schema definitions, focusing entirely on **behavior, cryptographic validation, and session state**. 

It implements a strict OWASP-compliant Two-Token architecture to natively neutralize Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF) attack vectors.

---

## Architectural Layers

The module strictly adheres to the Separation of Concerns principle, isolating HTTP transport logic from business execution.

### 1. Data Transfer Objects (DTOs)
Located in `src/modules/auth/dtos/`. Powered by Zod, these schemas act as the first line of defense.
* **Responsibilities**: Input sanitization (e.g., `.toLowerCase().trim()`), password strength enforcement via RegEx, and stripping out undocumented payload fields before they reach the controller.

### 2. The Presentation Layer (`auth.controller.ts`)
* **Responsibilities**: Receives sanitized `req.body`, delegates execution to the `AuthService`, injects the generated Access Tokens into the JSON response payload, and affixes Refresh Tokens to the `res.cookie` object.

### 3. The Domain Layer (`auth.service.ts`)
* **Responsibilities**: Database state mutations, Redis cache interactions (OTP storage and JWT blacklisting), and async handoffs to the `NotificationService` (BullMQ).

### 4. Cryptographic Utils (`auth.utils.ts`)
* **Responsibilities**: Centralized logic for signing JWTs and configuring `HttpOnly`, `Secure`, and `SameSite` flags for session cookies.

---

## API Endpoint Specifications

All routes are prefixed with `/api/v1/auth` and protected globally by the `authLimiter` to prevent brute-force attacks.

| Method | Endpoint | Access | Purpose & Flow |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Public | **Initiation:** Creates an `isEmailVerified: false` user, generates a 6-digit OTP, caches it in Redis (10m TTL), and queues the verification email. |
| `POST` | `/verify-otp` | Public | **Activation:** Validates the OTP against Redis. Upon success, deletes the OTP (Replay Protection), activates the user, triggers the Welcome email, and issues the Two-Token session. |
| `POST` | `/login` | Public | **Authentication:** Verifies email/password. Enforces `isEmailVerified` and `isActive` gatekeepers before issuing the Two-Token session. |
| `GET` | `/refresh` | Public | **Session Renewal:** Silently accepts the `HttpOnly` refresh cookie. Validates user database state and returns a fresh 15-minute Access Token. |
| `GET` | `/logout` | Protected | **Termination:** Extracts the refresh token, writes its signature to the Redis Blacklist, and drops the client-side cookie. |

---

## Core Business Logic Highlights

### 1. Safe Collision Recovery (UX Optimization)
If a user registers but abandons the OTP screen, their account exists in a "limbo" state. If they attempt to register again (perhaps fixing a typo in their password), the `registerLocal` service detects the unverified collision. Instead of throwing a `409 Conflict`, it safely overwrites their credentials and issues a fresh OTP, preventing user frustration.

### 2. Redis State Management
Redis is utilized for two distinct, highly-volatile state requirements:
* **OTP Caching (`SETEX otp:email 600`)**: OTPs automatically self-destruct after 10 minutes.
* **Token Blacklisting (`SETEX blacklist:token {ttl}`)**: Because JWTs are stateless, they cannot be destroyed on the server. On logout, the token's signature is pushed to Redis with a TTL exactly matching its remaining valid lifespan. The `protect` middleware checks this list on every request.

### 3. Two-Token Pipeline Implementation
The system explicitly avoids `localStorage` for session persistence.
* **Access Token**: Short-lived (`15m`). Stored in React application memory. Destroyed on hard refresh.
* **Refresh Token**: Long-lived (`7d`). Affixed as an `HttpOnly` cookie. Invisible to JavaScript, preventing exfiltration via XSS payloads.

---

## Security Dependencies

* **Bcrypt**: Used inside the `User` model to verify password hashes requested by `AuthService.loginLocal`.
* **Node Crypto**: Uses `crypto.randomInt(100000, 999999)` for OTP generation, ensuring mathematically unpredictable, cryptographically secure values (unlike `Math.random()`).
* **Express Rate Limit**: The dedicated `authLimiter` restricts the number of login/register attempts per IP address to neutralize dictionary and credential-stuffing attacks.

---
**Standard Documentation | Reshma-Core Architecture**