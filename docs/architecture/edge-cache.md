<div align="center">

  # Redis Edge Cache

  **Shielding MongoDB from the Thundering Herd with a transparent Redis proxy.**

  [![Redis](https://img.shields.io/badge/Redis-Edge_Cache-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Express](https://img.shields.io/badge/Express.js-Proxy_Pattern-000000?style=flat&logo=express&logoColor=white)](#)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Read_Heavy-47A248?style=flat&logo=mongodb&logoColor=white)](#)

</div>

---

## 1. The Problem: Thundering Herd

The product catalog is read‑heavy. During flash sales, thousands of users may hit `GET /api/v1/products?page=1` simultaneously. Without caching, every request would trigger a MongoDB query, potentially overwhelming the database.

Reshma‑Core solves this with a **transparent Redis edge cache** that serves cached JSON directly from RAM. Cache misses are handled by the controller, and the response is automatically stored for subsequent requests.

---

## 2. The Proxy Pattern (cacheMiddleware)

The `cacheMiddleware` (from `cache.middleware.ts`) intercepts all `GET` requests and acts as a proxy between the client and the controller.

### How It Works

1. **Generate a cache key** – based on the full URL (including query parameters).  
   Example: `reshma:cache:/api/v1/products?page=1&limit=20&itemType=BANGLE`

2. **Check Redis for a cache hit**:
   - If found → serve the JSON directly without calling the controller.  
     Response header: `X-Cache: HIT`
   - If not found → call the controller, then hijack `res.json` to store a copy in Redis before sending it to the client.  
     Response header: `X-Cache: MISS`

3. **Cache duration** – configurable per route (e.g., 300 seconds for product catalog).

**Code excerpt (`cache.middleware.ts`):**

```typescript
const key = `reshma:cache:${req.originalUrl}`;
const cachedData = await redisClient.get(key);
if (cachedData) {
  res.setHeader("X-Cache", "HIT");
  return res.status(200).json(JSON.parse(cachedData));
}

res.setHeader("X-Cache", "MISS");
const originalJson = res.json.bind(res);
res.json = (body) => {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    redisClient.setEx(key, durationInSeconds, JSON.stringify(body));
  }
  return originalJson(body);
};
next();
```  

---  

## 3. Cache Invalidation

Cached data becomes stale when an admin updates a product. Instead of waiting for the TTL to expire, the CacheManager instantly invalidates all keys matching a pattern.

**From** `CacheManager.invalidateCachePattern()` (`cache.utils.ts`):  

```typescript
const searchPattern = `reshma:cache:${pattern}*`;
const keys = await redisClient.keys(searchPattern);
if (keys.length > 0) await redisClient.del(keys);
```  

### Where Invalidation Is Triggered  

Inside `AdminProductController`, after every create, update, or soft‑delete:  

```typescript
CacheManager.invalidateCachePattern("/api/v1/products").catch((err) =>
  logger.error(`Background cache invalidation failed: ${err.message}`)
);
```  

The invalidation is **fire‑and‑forget** – it does not block the admin response.  

---  

## 4. Route Configuration  

The cache middleware is applied only to public read‑only endpoints:  
```typescript
router.get(
  "/",
  standardLimiter,
  cacheMiddleware(300),   // 5 minutes TTL
  validate(GetProductsQuerySchema),
  PublicProductController.getProducts,
);

router.get(
  "/:id",
  standardLimiter,
  cacheMiddleware(300),
  validate(GetProductByIdSchema),
  PublicProductController.getProductById,
);
```  
- **TTL = 300 seconds** – balances freshness with performance.
- **Never cache POST, PUT, PATCH, DELETE** – the middleware checks `req.method !== "GET"` and bypasses caching.  

---  

## 5. Resilience & Failure Handling

- **Redis offline?** The middleware checks `redisClient.isOpen`. If Redis is down, it logs a warning and bypasses the cache – the database is still reachable.
- **Cache write failures** – logged but do not affect the response.
- **No cache stampede protection** – if the cache expires while many requests arrive simultaneously, all will hit the database. However, the 5‑minute TTL makes this unlikely; you can add a mutex lock if needed.  

---  

## 6. Performance Impact

| Scenario | Response Time | Database Load |
|----------|---------------|----------------|
| Cache hit | ~2 ms (Redis RAM) | 0 queries |
| Cache miss + store | Controller + MongoDB (e.g., 50 ms) + Redis write | 1 query |
| Subsequent hits | ~2 ms | 0 queries |

With a 5‑minute TTL, 10,000 concurrent requests to the same endpoint result in only 1 MongoDB query.  

---  

## 7. Related Files

| File | Purpose |
|------|---------|
| `src/shared/middlewares/cache.middleware.ts` | Edge cache middleware (proxy pattern). |
| `src/shared/utils/cache.utils.ts` | `CacheManager` for pattern‑based invalidation. |
| `src/modules/products/product.admin.controller.ts` | Triggers invalidation on admin mutations. |
| `src/modules/products/product.routes.ts` | Applies cache middleware to public GET routes. |   

---  

## Next Steps

- See [Background Jobs & Cron](./background-jobs-and-cron.md) for asynchronous workers (email, PDF, exports).
- Explore [Media & Storage](./media-and-storage.md) for Cloudinary uploads.
- Understand [Security Hardening](./security-hardening.md) for rate limiting and DoS protection.  

---  

*The Reshma-Core Team*  