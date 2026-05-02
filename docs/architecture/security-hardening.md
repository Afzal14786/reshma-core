<div align="center">

  # Security Hardening & Protocols
  
  **The Zero-Trust security architecture and defense-in-depth strategies implemented across the Reshma-Core backend.**

  [![Helmet](https://img.shields.io/badge/Helmet-HTTP_Headers-blue?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Sanitization-3068b7?style=flat)](#)
  [![RateLimit](https://img.shields.io/badge/Rate_Limit-Brute_Force_Protection-red?style=flat)](#)

</div>

---

## 1. Core Security Philosophy

Reshma-Core operates on a **Zero-Trust** model[cite: 2]. We assume every incoming request is potentially hostile, malformed, or attempting to exhaust system resources[cite: 2]. 

Security is enforced at multiple layers:
1. **Network/Transport:** Global rate limiting and HTTP header masking[cite: 2].
2. **Application Boundary:** Strict payload size limits, raw stream interceptors, and schema validation[cite: 2].
3. **Session:** Stateless tokens with Redis blacklisting and XSS immunity[cite: 2].
4. **Data:** Cryptographic HMAC handshakes and strict database projections[cite: 2].

---

## 2. Layer 1: HTTP & Transport Defenses

Before a request even reaches an Express router, it must survive the global middleware gauntlet in `src/app.ts`[cite: 2].

### Helmet.js (Header Protection)
We utilize Helmet to automatically set secure HTTP headers and strip dangerous ones[cite: 2]:
* `X-Powered-By`: Removed. Attackers cannot fingerprint the server as an Express/Node.js instance[cite: 2].
* `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing attacks[cite: 2].
* `X-Frame-Options: DENY`: Mitigates Clickjacking by preventing the API/assets from being embedded in malicious iframes[cite: 2].

### Tiered Rate Limiting
To prevent Distributed Denial of Service (DDoS) and brute-force attacks, we use `express-rate-limit` backed by Redis[cite: 2]:
* **Global Limiter (`standardLimiter`):** Caps standard traffic to prevent general network flooding[cite: 2].
* **Auth Limiter (`authLimiter`):** A highly aggressive limiter explicitly applied to `/api/v1/auth/*` routes to shut down credential stuffing bots[cite: 2].
* **Checkout Limiter (`checkoutLimiter`):** (New) Prevents "Card Bin Testing" and financial DDoS attacks on the payment gateway[cite: 2].

---

## 3. Layer 2: Payload & Injection Protection

### RAM Exhaustion Prevention (OOM)
Attackers often try to crash Node.js servers by sending massive JSON payloads[cite: 2].
* **Implementation:** `express.json({ limit: '10kb' })`[cite: 2].
* **Result:** Any request body exceeding 10 kilobytes is physically dropped before parsing begins[cite: 2].

### Webhook Raw-Stream Interceptor (CodeQL Hardened)
Standard JSON parsing alters the original payload string, which breaks cryptographic signature validation for services like Razorpay[cite: 2].
* **Implementation:** We utilize a global `verify` hook in the JSON parser to capture the `req.rawBody`[cite: 2].
* **Purpose:** This ensures the backend has access to the exact, unparsed UTF-8 string required for 100% accurate HMAC SHA-256 verification[cite: 2].

### Zod Interceptor (NoSQL Injection & Sanitization)
Every incoming `req.body`, `req.query`, and `req.params` is intercepted by validation middleware[cite: 2].
* **Strict Stripping:** Zod automatically strips injected or undocumented fields (e.g., `role: "ADMIN"`) before they reach the service layer[cite: 2].
* **Taint Chain Severing:** Critical modules (like Orders) manually map payload fields to internal objects to completely neutralize Object Injection and Mass Assignment vulnerabilities[cite: 2].

---

## 4. Layer 3: Identity & Session Security

### XSS & CSRF Immunity
* **Access Tokens:** Kept strictly in React state memory. They are never saved to `localStorage`, rendering them immune to XSS harvesting[cite: 2].
* **Refresh Tokens:** Attached as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, making them invisible to malicious JavaScript[cite: 2].

### Token Hijack Mitigation
We use a **Redis Blacklist** for logouts and account bans[cite: 2]. When a user logs out, their token signature is pushed to Redis with a TTL matching the token's remaining lifespan[cite: 2]. The `protect` middleware cross-references this list on every authenticated request[cite: 2].

---

## 5. Active & Implemented Hardening (Phase 3 Updates)

The following security measures have been successfully moved from the roadmap to the production codebase:

| Feature | Threat Mitigated | Strategy |
| :--- | :--- | :--- |
| **Cloudinary File Uploads** | Malicious script execution | Multer strictly filters MIME types; Cloudinary strips Exif data and re-encodes binaries[cite: 2]. |
| **Razorpay Handshakes** | Payment Fraud / Spoofing | Cryptographic verification via `crypto.createHmac` using the captured `rawBody`[cite: 2]. |
| **Order Arbitration** | IDOR (Insecure Direct Object Ref) | Database queries strictly enforce a compound match of `{ _id: orderId, user: req.user._id }`[cite: 2]. |
| **Stock Race Conditions** | Inventory Overselling | Atomic `$inc` operations with `$gte` firewalls within MongoDB ACID sessions[cite: 2]. |

---
*Maintained by Md Afzal Ansari | Core System Architecture*