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
2. **Application Boundary:** Strict payload size limits, raw stream interceptors, and schema validation.
3. **Session:** Stateless tokens with Redis blacklisting and XSS immunity.
4. **Data:** Cryptographic HMAC handshakes and strict database projections.

---

## 2. Layer 1: HTTP & Transport Defenses

Before a request even reaches an Express router, it must survive the global middleware gauntlet in `src/app.ts`.

### Helmet.js (Header Protection)
We utilize Helmet to automatically set secure HTTP headers and strip dangerous ones:
* `X-Powered-By`: Removed. Attackers cannot fingerprint the server as an Express/Node.js instance.
* `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing attacks.
* `X-Frame-Options: DENY`: Mitigates Clickjacking by preventing the API/assets from being embedded in malicious iframes.

### Distributed Rate Limiting & Bot Protection
To prevent brute-force attacks and Server-Hopping DDoS attempts, rate limiting is handled globally via `express-rate-limit` backed by **RedisStore**.  

* **Global API Limiter:** 100 requests per 15 minutes per IP.
* **Auth Limiter:** Strict 10 requests per hour on login/registration routes to prevent credential stuffing.
* **Checkout Limiter:** Maximum of 5 checkouts per hour to neutralize automated card-testing bots.
* **Distributed Synchronization:** Because the strike counters are stored in Redis, an IP blocked on Server A is instantaneously blocked on Server B, C, and D.

---

## 3. Layer 2: Payload & Injection Protection

### RAM Exhaustion Prevention (OOM)
Attackers often try to crash Node.js servers by sending massive JSON payloads.
* **Implementation:** `express.json({ limit: '10kb' })`.
* **Result:** Any request body exceeding 10 kilobytes is physically dropped before parsing begins.

### Webhook Raw-Stream Interceptor (CodeQL Hardened)
Standard JSON parsing alters the original payload string, which breaks cryptographic signature validation for services like Razorpay.
* **Implementation:** We utilize a global `verify` hook in the JSON parser to capture the `req.rawBody`.
* **Purpose:** This ensures the backend has access to the exact, unparsed UTF-8 string required for 100% accurate HMAC SHA-256 verification.

### Data Sanitization & NoSQL Injection Defense
The API is physically fortified against Object Injection and NoSQL Operator manipulation using a two-layered defense strategy.

* **Route-Level (The Zod Firewall):** Every payload is intercepted by strict Zod schemas utilizing `zod.strict()`. Any undocumented fields injected by an attacker (e.g., `role: "ADMIN"`) are instantly stripped and dropped before reaching the controller. Furthermore, critical modules manually map payload fields to internal objects to sever taint chains and neutralize Mass Assignment vulnerabilities.
* **App-Level (Global NoSQL Firewall):** As an absolute safety net, `express-mongo-sanitize` is injected at the root `app.ts` level. It recursively scans `req.body`, `req.query`, and `req.params`, aggressively stripping any malicious MongoDB operators (keys starting with `$` or `.`) before they ever touch the Mongoose driver.

---

## 4. Layer 3: Identity & Session Security

### XSS & CSRF Immunity
* **Access Tokens:** Kept strictly in React state memory. They are never saved to `localStorage`, rendering them immune to XSS harvesting.
* **Refresh Tokens:** Attached as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, making them invisible to malicious JavaScript.

### Token Hijack Mitigation
We use a **Redis Blacklist** for logouts and account bans. When a user logs out, their token signature is pushed to Redis with a TTL matching the token's remaining lifespan. The `protect` middleware cross-references this list on every authenticated request.

---

## 5. Active & Implemented Hardening (Phase 3 Updates)

The following security measures have been successfully moved from the roadmap to the production codebase:

| Feature | Threat Mitigated | Strategy |
| :--- | :--- | :--- |
| **Cloudinary File Uploads** | Malicious script execution | Multer strictly filters MIME types; Cloudinary strips Exif data and re-encodes binaries. |
| **Razorpay Handshakes** | Payment Fraud / Spoofing | Cryptographic verification via `crypto.createHmac` using the captured `rawBody`. |
| **Order Arbitration** | IDOR (Insecure Direct Object Ref) | Database queries strictly enforce a compound match of `{ _id: orderId, user: req.user._id }`. |
| **Stock Race Conditions** | Inventory Overselling | Atomic `$inc` operations with `$gte` firewalls within MongoDB ACID sessions. |

---
*Maintained by Md Afzal Ansari | Core System Architecture*