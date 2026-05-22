<div align="center">

  # Rate Limiting Guide
  
  **Distributed, Redis‑backed rate limiting – protecting the API from abuse and DoS attacks.**

  [![Redis](https://img.shields.io/badge/Redis-Distributed_Counter-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Express Rate Limit](https://img.shields.io/badge/Express_Rate_Limit-v7-000000?style=flat&logo=express&logoColor=white)](#)
  [![CodeQL](https://img.shields.io/badge/CodeQL-CWE--770_Hardened-3068b7?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Overview](#overview)
- [Rate Limiters Reference](#rate-limiters-reference)
- [How Limits Are Enforced](#how-limits-are-enforced)
- [Redis Distributed Store](#redis-distributed-store)
- [Response Headers](#response-headers)
- [Error Response Shape](#error-response-shape)
- [Frontend Best Practices](#frontend-best-practices)
- [Implementation Details (Middleware)](#implementation-details-middleware)

---

## Overview

Reshma‑Core implements **distributed rate limiting** using `express-rate-limit` backed by a Redis store. In a clustered environment (multiple server instances), all instances share a centralized counter – preventing “server‑hopping” attacks where an attacker switches between nodes to bypass limits.

**Key benefits:**
- Prevents brute‑force, credential stuffing, and card‑testing attacks.
- Protects downstream services (MongoDB, Typesense, Razorpay) from request floods.
- Provides standard `RateLimit-*` headers for client‑side backoff logic.

---

## Rate Limiters Reference

| Limiter | Scope | Window | Max Requests | Per | Notes |
|---------|-------|--------|--------------|-----|-------|
| `standardLimiter` | **All endpoints** (global fallback) | 15 minutes | 100 | IP | Applied first in the middleware chain |
| `authLimiter` | `/auth/*` (register, login, OTP, refresh, forgot/reset password) | 1 hour | 10 | IP | Protects against brute‑force password attacks |
| `checkoutLimiter` | `/orders/checkout` | 1 hour | 5 | IP | Prevents card‑testing bots and financial DDoS |
| `healthLimiter` | `/health` | 15 minutes | 3000 | IP | **Memory store** (not Redis) – allows load balancer pings even if Redis is down |

> All limiters apply to the **IP address** extracted from `req.ip`. In production behind a reverse proxy, ensure `trust proxy` is enabled in Express.

---

## How Limits Are Enforced

The middleware chain for a typical protected route:

standardLimiter → authLimiter (or other specific limiter) → protect (JWT) → validate (Zod) → controller  

If a limit is exceeded, the request is **rejected immediately** – no authentication, validation, or database query is performed. This is a critical security measure to prevent resource exhaustion.  

```typescript
router.post("/login", authLimiter, validate(LoginSchema), AuthController.login);
```  

- First, `authLimiter` checks the IP. If limit exceeded → returns `429`.
- Only then does it proceed to Zod validation and the controller.  

---  

## Redis Distributed Store  

All limiters except `healthLimiter` use a **Redis store** to share counters across multiple Node.js instances.  

**How it works:**  

1. Each request increments a Redis key: `rl:{prefix}:{IP}`.
2. The key expires automatically after the `windowMs`.
3. Multiple server instances read/write the same Redis keys → global rate limiting.

**Fallback behaviour:**

- If Redis is temporarily unreachable, the middleware **waits** for the Redis client to become ready (prevents crashes).
- `healthLimiter` intentionally **does not use Redis** – so health checks still work even when Redis is down (returning `503` for other routes).  

---  

## Response Headers  

When `standardHeaders`: true, the API returns industry‑standard rate limit headers:  

| Header | Example | Description |
|--------|---------|-------------|
| `RateLimit-Limit` | `100` | Maximum requests allowed in the window |
| `RateLimit-Remaining` | `42` | Remaining requests in the current window |
| `RateLimit-Reset` | `1748592000` | Timestamp (Unix seconds) when the window resets |
| `Retry-After` | `900` | Seconds to wait before retrying (only sent on 429) |

> The legacy `X-RateLimit-*` headers are disabled (`legacyHeaders: false`).  

---  

## Error Response Shape  

When a limit is exceeded, the API returns `429 Too Many Requests` with this body:  

```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests from this IP, please try again after 15 minutes",
  "data": null,
  "timestamp": "2026-05-22T14:30:00.000Z"
}
```  

**Specific messages per limiter:**  

| Limiter | Message |
|---------|---------|
| `standardLimiter` | Too many requests from this IP, please try again after 15 minutes |
| `authLimiter` | Too many authentication attempts. Your IP has been temporarily blocked to prevent brute-force attacks. |
| `checkoutLimiter` | Checkout limit exceeded. Please contact support if you need to place a bulk order. |
| `healthLimiter` | Health check rate limit exceeded. |  

---  

## Frontend Best Practices  

### 1. Respect `Retry-After` Header  

When you receive a `429` response, **do not retry immediately**. Use the `Retry-After` header (seconds) to wait before retrying.  

```javascript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'] || 15;
  setTimeout(() => retryRequest(), retryAfter * 1000);
}
```  

### 2. Implement Exponential Backoff for Critical Operations  

For checkout, implement exponential backoff to avoid hitting the 5‑request/hour limit:  

```javascript
async function checkoutWithBackoff(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.post('/orders/checkout', payload);
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```  

### 3. Cache Public Responses  

Reduce API calls for public data (product list, search results) using React Query, SWR, or local caching.  

### 4. Warn Users Before Exhausting Limits  

For auth endpoints, you can show a warning when `RateLimit-Remaining` is low:  

```javascript
const remaining = response.headers['ratelimit-remaining'];
if (remaining < 3) {
  showToast('You have few login attempts remaining. Wait before retrying.');
}
```  

---  

## Implementation Details (Middleware)  

The rate limiter is defined in `src/shared/middlewares/rate-limit.middleware.ts`.  

**Key features:**  

- **RedisStore factory** – uses the existing Redis client from `@config/redis`. If the client is not yet connected, it waits for the `ready` event (race condition defense).
- **Unique `requestPropertyName`** – prevents collisions when multiple limiters are applied to the same route (e.g., `standardLimiter` + `authLimiter`).
- **Health limiter uses memory store** – avoids dependency on Redis for liveness probes.

### Example: applying multiple limiters to one route

```typescript
router.post("/checkout", standardLimiter, checkoutLimiter, validate(CheckoutSchema), controller);
```  

Both limiters are checked sequentially. The IP must satisfy both.  

---  

## Frequently Asked Questions

### Q: What happens if Redis is completely down?

- `standardLimiter`, `authLimiter`, and `checkoutLimiter` will **wait** for Redis to reconnect. While waiting, requests will be delayed.
- `healthLimiter` (memory store) continues to work, returning `200 OK` if the API is up, or `503` if dependencies are down.
- **Recommendation:** Monitor Redis and set up alerts. Use Redis Sentinel or a managed Redis service for high availability.

### Q: Can an attacker bypass limits by changing IP (VPN/proxy)?

Rate limiting is IP‑based. An attacker with a large pool of IPs (e.g., botnet) can still cause load. To mitigate:

- CloudFlare or AWS WAF with rate limiting at the edge.
- CAPTCHA on sensitive endpoints (login, checkout).

### Q: Why is the checkout limit so strict (5 per hour)?

To prevent “card testing” attacks where bots try multiple stolen credit cards. Legitimate users rarely place more than 5 orders per hour. If your business requires higher limits, adjust the `max` value in `rate-limit.middleware.ts`.

### Q: How do I test rate limiting locally?

Use a tool like `ab` (Apache Bench) or a simple loop:

```bash
for i in {1..110}; do curl -I http://localhost:5000/api/v1/products; done
```  

After 100 requests, you should see `429` responses.  

---  

## Related Documentation  

- [Error Handling Guide](./error-codes.md) – other HTTP status codes.
- [Authentication Guide](./authentication.md) – auth‑specific limits.
- [Deployment – Docker Compose](../deployment/docker-compose.md) – Redis configuration for production.  

---  

<div align="center">

Distributed, resilient, and developer‑friendly – the Reshma‑Core rate limiting layer.
</div>  
