<div align="center">

  # Middleware & Validation Architecture
  
  **The defense-in-depth security pipeline and request lifecycle for Reshma‑Core.**

  [![Express](https://img.shields.io/badge/Express.js-Middleware-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
  [![Zod](https://img.shields.io/badge/Zod-DTO_Firewall-3068b7?style=flat)](https://zod.dev/)
  [![Redis](https://img.shields.io/badge/Redis-Distributed_Limiting-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
  [![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=flat&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)

</div>

---

## 1. The Defense‑in‑Depth Strategy

Reshma‑Core operates in a hostile public internet environment. Every incoming HTTP request must pass through a **strict sequence of middleware firewalls** before reaching a controller. This pipeline enforces three primary pillars:

1. **Traffic Shaping** – distributed rate limiting (Redis‑backed)
2. **Authentication & Authorisation** – JWT verification + RBAC
3. **Payload Sanitisation** – Zod validation + NoSQL injection prevention

---

## 2. Request Lifecycle (Complete Middleware Order)

```mermaid
graph LR
    A[Client Request] --> B[httpLogger (Morgan)]
    B --> C[Rate Limiter]
    C --> D[Sanitizer (NoSQL injection)]
    D --> E[Zod Validation]
    E --> F[protect (JWT auth)]
    F --> G[restrictTo (RBAC, optional)]
    G --> H[Controller]
    H --> I[Global Error Handler]
```  

---  

## 3. Payload Validation & Sanitisation (`validate.middleware.ts`)

We never trust `req.body`, `req.query`, or `req.params`. The `validate` middleware acts as an absolute firewall.

### Two‑Layer Pipeline

1. **NoSQL Injection & Prototype Pollution Defence**  
   `Sanitizer.sanitize()` recursively strips:
   - Keys starting with `$` (MongoDB operators)
   - Keys containing `.` (dangerous dot notation)
   - JavaScript internal keys: `__proto__`, `constructor`, `prototype`

2. **Strict Zod Validation**  
   `schema.parseAsync()` enforces data types, required fields, and business rules. Undocumented fields are automatically stripped.

### Express 5 Compatibility

In Express 5, `req.query` and `req.params` are read‑only getters. The middleware clones and cleans the objects, then uses `Object.defineProperty` to safely reassign them.   

**Code excerpt (`validate.middleware.ts`):**  

```typescript
const cleanQuery = Sanitizer.sanitize({ ...req.query });
const validatedData = await schema.parseAsync({ body: cleanBody, query: cleanQuery });
Object.defineProperty(req, "query", { value: validatedData.query, enumerable: true });
```  

If validation fails, the middleware throws a ZodError, which is formatted as:  
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed: email: Invalid email, password: Password too short"
}
```  

---  

## 4. Distributed Rate Limiting (`rate-limit.middleware.ts`)

In a horizontally scaled environment (multiple containers), RAM‑based limiters are ineffective because a bot can “server‑hop”. We use Redis as a central strike counter (`rate-limit-redis`).

### Available Limiters

| Limiter | Window | Max Requests | Target |
|---------|--------|--------------|--------|
| `standardLimiter` | 15 min | 100 | All API routes (global DDoS) |
| `authLimiter` | 1 hour | 10 | `/auth/*` (brute‑force) |
| `checkoutLimiter` | 1 hour | 5 | `/orders/checkout` (card‑testing bots) |
| `healthLimiter` | 15 min | 3000 | `/health` (local memory – bypasses Redis) |  

**Redis Store Factory (race condition defence):**  
```typescript
const createRedisStore = () => new RedisStore({
  sendCommand: async (...args: string[]) => {
    if (!redisClient.isOpen) await new Promise(resolve => redisClient.once("ready", resolve));
    return redisClient.sendCommand(args);
  },
});
```   

The `healthLimiter` explicitly **does not use Redis** – if Redis crashes, the health endpoint still works and can return `503` to the load balancer.  

---  

## 5. Authentication Middleware (`protect` – `auth.middleware.ts`)

This middleware sits before all protected routes (e.g., `/cart`, `/orders/checkout`). It extracts the JWT from either:

- `Authorization: Bearer <token>` header (mobile apps)
- Signed cookie `req.signedCookies.jwt` (web clients)

### Steps

1. Extract token.
2. Verify with `JWT_ACCESS_SECRET` (handles `TokenExpiredError` and `JsonWebTokenError`).
3. Fetch user from database by `id` claim.
4. Check `isActive` flag.
5. Attach full user object to `req.user`.  

**Code snippet:**  

```typescript
const decode = jwt.verify(token, env.JWT_ACCESS_SECRET) as IJwtPayload;
const currentUser = await User.findById(decode.id);
if (!currentUser || !currentUser.isActive) throw new AppError(..., ...);
req.user = currentUser;
next();
```  

---  

## 6. Role‑Based Access Control (`restrictTo` – `role.middleware.ts`)

Must be used after `protect`. Accepts an array of allowed roles (e.g., `['ADMIN']`). If `req.user.role` is not in the allowed list, returns `403 Forbidden`.  

**Example usage:**  

```typescript
router.post("/products", protect, restrictTo("ADMIN"), productController.create);
```  

---  

## 7. HTTP Logging (`http-logger.ts`)

We use Morgan to intercept every request and calculate:

- Remote IP
- HTTP method and URL
- Response status code
- Payload size (bytes)
- Response time (ms)

Morgan outputs a raw string piped into Winston, which handles environment‑aware formatting (colourised dev output, JSON production logs). The middleware is skipped during test runs.  

```typescript
const format = ":remote-addr - :method :url :status :res[content-length] bytes - :response-time ms";
export const httpLogger = morgan(format, { stream: { write: (msg) => logger.info(msg.trim()) } });
```  

---  

## 8. Global Error Handler (`error.middleware.ts`)

Catches any error thrown anywhere in the application. It distinguishes between:

- **Operational errors** (`AppError`, Mongoose validation/cast errors, duplicate key) – safe to send original message to client.
- **Non‑operational errors** (unexpected bugs) – in production, only send `"Internal Server Error"`.

### Mapped error types

| Error Type | Status Code | Example Message |
|------------|-------------|------------------|
| `AppError` | as set by developer | `"Product not found"` |
| `MongooseError.CastError` | 400 | `"Resource not found. Invalid _id : abc"` |
| `MongooseError.ValidationError` | 400 | `"Invalid input data: name: Path 'name' is required"` |
| MongoDB duplicate key (11000) | 409 | `"The email you entered already exists"` |
| Generic Error | 500 | `"Internal Server Error"` (production) |  

**Logging rule:** Non‑operational errors are logged with full stack trace to Winston.  

---  

## 9. Middleware Stack Summary

| Order | Middleware | Purpose |
|-------|------------|---------|
| 1 | `httpLogger` (Morgan) | Request/response telemetry |
| 2 | Rate limiter (`standardLimiter` etc.) | DDoS / brute‑force protection |
| 3 | `Sanitizer.sanitize` (inside `validate`) | NoSQL injection & prototype pollution |
| 4 | Zod validation (`validate`) | Type safety & business rules |
| 5 | `protect` | JWT authentication & user loading |
| 6 | `restrictTo` (optional) | Role‑based authorisation |
| 7 | Controller | Business logic |
| 8 | Global error handler | Centralised error formatting & logging |  

---  

## 10. Related Files

| File | Purpose |
|------|---------|
| `src/shared/middlewares/validate.middleware.ts` | Zod validation + sanitisation + Express 5 compatibility |
| `src/shared/middlewares/rate-limit.middleware.ts` | Distributed Redis‑backed limiters |
| `src/shared/middlewares/auth.middleware.ts` | JWT verification (`protect`) |
| `src/shared/middlewares/role.middleware.ts` | RBAC (`restrictTo`) |
| `src/shared/middlewares/error.middleware.ts` | Global error handler |
| `src/shared/middlewares/http-logger.ts` | Morgan + Winston integration |
| `src/shared/utils/sanitizer.ts` | Deep object sanitisation |
| `src/config/redis.ts` | Redis client initialisation |  

---  

## Next Steps

- Read [Authentication Architecture](./auth-architecture.md) for the two‑token JWT model.
- Explore [Security Hardening](./security-hardening.md) for additional layers.
- Understand [Edge Cache & Workers](./edge-cache.md) for performance shielding.

---  

*The Reshma-Core Team*  