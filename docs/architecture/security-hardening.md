<div align="center">

  # Security Hardening & Protocols

  **The Zero-Trust security architecture and defense-in-depth strategies implemented across the Reshma-Core backend.**

  [![Helmet](https://img.shields.io/badge/Helmet-HTTP_Headers-blue?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Payload_Sanitization-3068b7?style=flat)](https://zod.dev/)
  [![RateLimit](https://img.shields.io/badge/Rate_Limit-Brute_Force_Protection-red?style=flat)](#)
  [![CodeQL](https://img.shields.io/badge/CodeQL-Security_Scan-1C2C4E?style=flat)](https://codeql.github.com/)

</div>

---

## 1. Core Security Philosophy

Reshma-Core operates on a **Zero-Trust** model. Every incoming request is treated as potentially hostile. Security is enforced in layers:

1. **Network/Transport** – global rate limiting (Redis‑backed), Helmet headers.
2. **Application Boundary** – payload size limits, raw stream interceptors, Zod validation, NoSQL injection sanitisation.
3. **Session** – stateless JWTs, Redis blacklist, `HttpOnly` cookies.
4. **Data** – cryptographic HMAC handshakes, strict database projections, atomic operations.

All security‑critical code is scanned by **CodeQL** on every push and pull request.

---

## 2. Layer 1: HTTP & Transport Defences

### Helmet.js (Header Protection)
- Removes `X-Powered-By` (prevents fingerprinting).
- Sets `X-Content-Type-Options: nosniff` (MIME sniffing).
- Sets `X-Frame-Options: DENY` (clickjacking).

### Distributed Rate Limiting (`rate-limit.middleware.ts`)
All rate limiters use a **Redis central store** to synchronise strike counters across multiple containers.

| Limiter | Window | Max Requests | Target |
|---------|--------|--------------|--------|
| `standardLimiter` | 15 min | 100 | All API routes |
| `authLimiter` | 1 hour | 10 | `/auth/*` (brute‑force) |
| `checkoutLimiter` | 1 hour | 5 | `/orders/checkout` (card testing) |
| `healthLimiter` | 15 min | 3000 | `/health` (local memory, bypasses Redis) |

> **CodeQL CWE-770 (Allocation of Resources Without Limits) mitigated** – each limiter has a unique `requestPropertyName` to prevent double‑counting and is applied before expensive database lookups.

---

## 3. Layer 2: Payload & Injection Protection

### RAM Exhaustion Prevention (OOM)
- `express.json({ limit: '10kb' })` – any JSON body larger than 10 KB is rejected before parsing.

### Raw‑Body Interceptor (HMAC Integrity)
- A global `verify` hook captures the original request buffer as `req.rawBody`.
- Used by Razorpay and Shiprocket webhooks to verify HMAC signatures without JSON‑parsing corruption.

### NoSQL Injection & Prototype Pollution Defence

#### Two‑Layer Strategy

| Layer | Implementation | Target |
|-------|----------------|--------|
| **Route level** | `Sanitizer.sanitize()` inside `validate.middleware.ts` | Strips keys starting with `$` or containing `.`, and removes `__proto__`, `constructor`, `prototype`. |
| **App level** | `express-mongo-sanitize` (global middleware) | Recursively scans `req.body`, `query`, `params` for malicious operators. |

**From `sanitizer.ts`:**
```typescript
export class Sanitizer {
  private static readonly PROHIBITED_KEYS = ["__proto__", "constructor", "prototype"];
  public static sanitize<T>(target: T): T {
    // recursively removes dangerous keys
  }
}
```  

> **Mitigates:** CWE-943 (Improper Neutralization of Special Elements in Data Query Logic) and CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes).  

### Zod Validation Firewall  

Every request payload is validated by a Zod schema (e.g., `RegisterSchema`, `CreateProductSchema`). Undocumented fields are stripped; type mismatches and missing required fields return `400 Bad Request`.  

---  

## 4. Layer 3: Identity & Session Security

### XSS & CSRF Immunity

- **Access tokens** – stored in frontend memory (React state), never in `localStorage`.
- **Refresh tokens** – `HttpOnly`, `Secure`, `SameSite=Strict` cookies – invisible to JavaScript.

### Token Hijack Mitigation (Redis Blacklist)

- On logout, the refresh token’s signature is stored in Redis with a TTL equal to its remaining lifespan.
- The `protect` middleware checks this blacklist on every authenticated request.

### Authentication Middleware (`protect`)

- Extracts JWT from `Authorization` header or signed cookie.
- Verifies signature with `JWT_ACCESS_SECRET`.
- Fetches user from DB, checks `isActive`, and attaches user to `req.user`.  

---  

## 5. Active Hardening & CodeQL‑Mitigated Patterns

The following have been implemented and verified by CodeQL:

| CWE | Threat | Mitigation | Source File |
|-----|--------|------------|-------------|
| CWE-117 | Log injection (`\r\n` in logs) | `safeLog()` strips control characters before Winston. | `sanitizer.ts` (used in `product.service.ts`, `cart.service.ts`, etc.) |
| CWE-400 | Memory exhaustion (pagination) | Hard cap on `limit` (e.g., `max(50)` for products, `max(100)` for search). | `product.public.dto.ts`, `search.dto.ts` |
| CWE-770 | No rate limiting | Distributed limiters with Redis. | `rate-limit.middleware.ts` |
| CWE-943 | NoSQL operator injection | `Sanitizer.sanitize()` + explicit `$eq` wrappers. | `validate.middleware.ts`, `sanitizer.ts` |
| CWE-1321 | Prototype pollution | Stripping of `__proto__`, `constructor`, `prototype` keys. | `sanitizer.ts` |
| CWE-807 | Authentication bypass | Use of signed cookies (`req.signedCookies`) for JWT. | `auth.middleware.ts` |
| CWE-250 | Uncontrolled data used in path traversal | Not applicable (no file system operations). | – |  

---  

## 6. Security Summary Table

| Layer | Defences |
|-------|----------|
| HTTP | Helmet, CORS (explicit origins), TLS 1.3 (enforced by reverse proxy) |
| Transport | Rate limiting (Redis), payload truncation (10 KB) |
| Validation | Zod schemas, `Sanitizer.sanitize()`, `express-mongo-sanitize` |
| Session | Stateless JWTs, HttpOnly refresh cookies, Redis blacklist |
| Cryptography | bcrypt (passwords), HMAC‑SHA256 (webhooks), `crypto.randomInt` (OTPs) |
| Error handling | `AppError` with `isOperational` flag, no stack traces in production |
| Logging | Winston with daily rotation, PII‑free HTTP logging (Morgan) |
| Audit | CodeQL SAST, Dependabot (weekly), branch protection |  

---  

## 7. Related Files

| File | Purpose |
|------|---------|
| `src/shared/middlewares/rate-limit.middleware.ts` | Distributed rate limiters |
| `src/shared/middlewares/validate.middleware.ts` | Zod validation + sanitisation |
| `src/shared/utils/sanitizer.ts` | NoSQL injection & prototype pollution cleaner |
| `src/shared/middlewares/auth.middleware.ts` | JWT verification (`protect`) |
| `src/shared/middlewares/error.middleware.ts` | Global error handler |
| `src/shared/utils/app-error.ts` | Custom error class with `isOperational` |
| `src/config/cloudinary.ts` | Secure image uploads (MIME filter, WebP) |
| `src/shared/middlewares/upload.middleware.ts` | File size limits, MIME validation |  

---  

## Next Steps

- Read [Middleware & Validation](./middleware-and-validation.md) for the complete request pipeline.
- Understand [Authentication Architecture](./auth-architecture.md) for two‑token session details.
- Review [Background Jobs & Cron](./background-jobs-and-cron.md) for `safeLog()` usage in workers.  

---  

*The Reshma-Core Team*  