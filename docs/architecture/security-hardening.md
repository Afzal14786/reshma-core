<div align="center">

  # Security Hardening & Protocols
  
  **The Zero-Trust security architecture and defense-in-depth strategies implemented across the Reshma-Core backend.**

  [![Helmet](https://img.shields.io/badge/Helmet-HTTP_Headers-blue?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Sanitization-3068b7?style=flat)](#)
  [![RateLimit](https://img.shields.io/badge/Rate_Limit-Brute_Force_Protection-red?style=flat)](#)

</div>

---

## 1. Core Security Philosophy

Reshma-Core operates on a **Zero-Trust** model. We assume every incoming request is potentially hostile, malformed, or attempting to exhaust system resources. 

Security is enforced at multiple layers:
1. **Network/Transport:** Global rate limiting and HTTP header masking.
2. **Application Boundary:** Strict payload size limits and schema validation.
3. **Session:** Stateless tokens with Redis blacklisting and XSS immunity.
4. **Data:** Cryptographic hashing and strict database projections.

---

## 2. Layer 1: HTTP & Transport Defenses

Before a request even reaches an Express router, it must survive the global middleware gauntlet in `src/app.ts`.

### Helmet.js (Header Protection)
We utilize Helmet to automatically set secure HTTP headers and strip dangerous ones:
* `X-Powered-By`: Removed. Attackers cannot easily fingerprint the server as an Express/Node.js instance.
* `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing attacks.
* `X-Frame-Options: DENY`: Mitigates Clickjacking by preventing the API/assets from being embedded in malicious iframes.

### Tiered Rate Limiting
To prevent Distributed Denial of Service (DDoS) and brute-force attacks, we use `express-rate-limit` backed by Redis:
* **Global Limiter (`standardLimiter`):** Caps standard traffic to prevent general network flooding.
* **Auth Limiter (`authLimiter`):** A highly aggressive limiter explicitly applied to `/api/v1/auth/*` routes to instantly shut down credential stuffing and password guessing bots.

---

## 3. Layer 2: Payload & Injection Protection

### RAM Exhaustion Prevention (OOM)
Attackers often try to crash Node.js servers by sending massive JSON payloads that consume all available RAM.
* **Implementation:** `express.json({ limit: '10kb' })`
* **Result:** Any request body exceeding 10 kilobytes is physically dropped by the server before parsing begins.

### Zod Interceptor (NoSQL Injection & Sanitization)
Every incoming `req.body`, `req.query`, and `req.params` is intercepted by a generic validation middleware powered by Zod schemas.
* **Strict Stripping:** If an attacker sends `{ "email": "test@test.com", "role": "ADMIN" }` to the registration endpoint, Zod automatically strips the injected `role` field.
* **Sanitization:** Emails are forced to lowercase, and strings are trimmed before ever reaching the Controller, preventing duplicate accounts due to trailing spaces.

---

## 4. Layer 3: Identity & Session Security

### XSS & CSRF Immunity
* **Access Tokens:** Kept strictly in React state memory. They are never saved to `localStorage`, rendering them immune to Cross-Site Scripting (XSS) payload harvesting.
* **Refresh Tokens:** Attached as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The browser handles transport natively, and malicious JavaScript cannot read it.

### Token Hijack Mitigation
Because JWTs cannot be deleted, we use a **Redis Blacklist** for logouts and account bans. When a user logs out, their token signature is pushed to Redis with a TTL matching the token's remaining lifespan. The `protect` middleware cross-references this list on every authenticated request.

---

## 5. Future Hardening Implementations

As we build out Phase 2 and Phase 3, the following security measures will be implemented:

| Feature | Threat Mitigated | Strategy |
| :--- | :--- | :--- |
| **Cloudinary File Uploads** | Malicious script execution | Multer will strictly filter MIME types (`image/jpeg`, `image/png`, `image/webp`). Cloudinary will strip Exif data and re-encode binaries. |
| **Razorpay Webhooks** | Payment Fraud / Spoofing | Cryptographic signature verification (`crypto.createHmac`) ensures incoming payment confirmations actually originated from Razorpay's servers. |
| **Order Arbitration** | IDOR (Insecure Direct Object Ref) | Database queries for Orders will explicitly require both `orderId` and `req.user._id` to prevent cross-account data leaking. |

---
*Maintained by Md Afzal Ansari | Core System Architecture*