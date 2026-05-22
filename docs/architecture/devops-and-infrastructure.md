<div align="center">

  # DevOps & Cloud Infrastructure

  **The architectural blueprints for deploying Reshma‑Core as a highly available, horizontally scalable distributed system.**

  [![AWS ECS](https://img.shields.io/badge/AWS-Elastic_Container_Service-FF9900?style=flat&logo=amazonaws&logoColor=white)](#)
  [![Kubernetes](https://img.shields.io/badge/Kubernetes-Zero_Downtime-326CE5?style=flat&logo=kubernetes&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-Distributed_State-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Docker](https://img.shields.io/badge/Docker-Multi‑Stage_Build-2496ED?style=flat&logo=docker&logoColor=white)](#)

</div>

---

## 1. Cluster Readiness (Horizontal Scalability)

Reshma‑Core is designed to run multiple identical instances behind a load balancer. The application is **stateless**:

- **Sessions** – cryptographically signed JWTs (no server‑side storage).
- **Background jobs** – centralised Redis/BullMQ queue; no instance owns a task.
- **Rate limits** – centralised in Redis; all instances share the same strike counter.

---

## 2. Multi‑Stage Docker Build (Production Image)

The `Dockerfile` uses a **multi‑stage build** to keep the final image small and secure.

| Stage | Purpose |
|-------|---------|
| `base` | Node.js 20‑alpine, sets working directory. |
| `deps` | Installs all dependencies (including dev). |
| `builder` | Compiles TypeScript to JavaScript and resolves path aliases with `tsc-alias`. |
| `runner` | Copies only production dependencies (`npm ci --omit=dev`) and compiled `dist/`. |

**Security:** The final image runs as the unprivileged `node` user (not root). The build step runs as root, but the runtime user is switched.

**Example command:**
```bash
docker build -t reshma-core:latest .
```  

---  

## 3. Docker Compose Configurations

### Development (`docker-compose.yml`)

- Spins up **MongoDB, Redis, Typesense, API, and worker**.
- No authentication on databases (simpler local testing).
- Mounts source code via bind mount? (not shown, but can be added).
- Network isolation (`reshma-network`) but ports exposed for local access.

### Production (`docker-compose.prod.yml`)

- **Environment variables** for credentials (`MONGO_INITDB_ROOT_USERNAME`, `REDIS_PASSWORD`, `TYPESENSE_API_KEY`).
- **Health checks** on all dependencies – the API waits for healthy services before starting.
- Air‑gapped internal network – only the API port (5000) is exposed.
- Volumes for persistent data (MongoDB, Redis, Typesense).

#### Health check examples:

```bash
# MongoDB
mongosh --eval 'db.runCommand("ping").ok'

# Redis
redis-cli -a $REDIS_PASSWORD ping

# Typesense
wget -qO- http://localhost:8108/health
```  

---  

## 4. Graceful Shutdown Protocol (`SIGTERM`)

When a container receives `SIGTERM` (Docker/Kubernetes) or `SIGINT` (Ctrl+C), the server:

1. Stops accepting **new** HTTP requests.
2. Keeps the event loop alive to finish active requests.
3. Drains and closes MongoDB and Redis connections.
4. Exits with code `0`.  

**Implementation (`server.ts`):**  

```typescript
const gracefulShutdown = (signal: string) => {
  logger.info(`[${signal}] Received. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      await mongoose.connection.close(false);
      await redisClient.quit();
      process.exit(0);
    });
  }
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```  

A **15‑second force‑kill timer** prevents hanging if connections do not close.  

---  

## 5. Deep Liveness & Readiness Probes (`/api/v1/health`)

See the [Health Module](../modules/health-module.md) for full details. In short:

- Executes `ping()` against MongoDB, Redis, and Typesense.
- Returns `200 OK` only if all dependencies are healthy.
- Returns `503 Service Unavailable` if any dependency fails.
- The load balancer routes traffic only to healthy containers.  

---  

## 6. Distributed Rate Limiting

All rate limiters are backed by **Redis** (`rate-limit-redis`), so strike counters are shared across all instances. Defined in `rate-limit.middleware.ts`:

| Limiter | Window | Max Requests | Target |
|---------|--------|--------------|--------|
| `standardLimiter` | 15 min | 100 | All API routes |
| `authLimiter` | 1 hour | 10 | `/auth/*` |
| `checkoutLimiter` | 1 hour | 5 | `/orders/checkout` |
| `healthLimiter` | 15 min | 3000 | `/health` (local memory – bypasses Redis) |  

> The Redis store factory waits for the Redis client to become `ready` before sending commands, preventing race conditions during server startup.  

---  

## 7. Observability & Enterprise Logging

### Pipeline

- **Morgan** (`http-logger.ts`) – intercepts every HTTP request, logs: `remote-addr`, method, URL, status, content‑length, response‑time (ms).
- **Winston** (`logger.ts`) – receives Morgan’s output and formats it:
  - **Development:** human‑readable, colorized text with timestamps.
  - **Production:** JSON (mandatory for CloudWatch/Datadog).
- **Daily rotation** – `winston-daily-rotate-file`:
  - `error-%DATE%.log` – only `error` level and above.
  - `combined-%DATE%.log` – all levels.
  - Auto‑zipped, max size 20 MB, deleted after 14 days.

**Security:** Morgan **does not log** `req.body` – no accidental PII exposure.

### Startup Logs

The `server.ts` boot sequence logs:

- MongoDB connection success.
- Redis connection success.
- Typesense schema initialisation.
- HTTP server start with port and environment.  

---  

## 8. Production Deployment Checklist

Before deploying to production, ensure:

- All secrets are injected via environment variables (no hardcoded values).
- `NODE_ENV=production` is set.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are 64‑character hex strings, different from development.
- MongoDB and Redis are password‑protected and not exposed to the public internet.
- Typesense API key is a strong secret.
- Health checks are configured on the load balancer target group (expecting `200 OK`).
- Graceful shutdown is verified (send `SIGTERM` to a running container and observe logs).
- Logging output is captured by a log aggregator (CloudWatch, Datadog, or ELK).
- Rate limits are adjusted if needed (e.g., higher limits for authenticated admin endpoints).
- Docker images are scanned for vulnerabilities (e.g., Trivy, Snyk).  

### Example CI/CD Pipeline (GitHub Actions – planned)

A typical workflow would:

1. Run `npm run build` and `npm run format:check`.
2. Run CodeQL analysis.
3. Build the Docker image and push to a registry (ECR, GHCR).
4. Deploy to staging (Docker Compose or ECS).
5. Run integration tests (Thunder Client runbooks).
6. Promote to production.  

---  

## 9. Related Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi‑stage production image. |
| `docker-compose.yml` | Local development stack. |
| `docker-compose.prod.yml` | Production stack with health checks and secrets. |
| `src/server.ts` | Graceful shutdown, bootstrap, cron initialisation. |
| `src/app.ts` | Middleware order, rawBody capture for webhooks. |
| `src/config/logger.ts` | Winston configuration (JSON/text, rotation). |
| `src/shared/middlewares/http-logger.ts` | Morgan → Winston bridge. |
| `src/shared/middlewares/rate-limit.middleware.ts` | Distributed limiters. |
| `src/modules/health/health.controller.ts` | Deep liveness probe. |  

---  

## Next Steps

- Read [Health Module](../modules/health-module.md) for deep probe implementation.
- Explore [Background Jobs & Cron](./background-jobs-and-cron.md) for queue architecture.
- See [Security Hardening](./security-hardening.md) for rate limiting details.  

---  

*The Reshma-Core Team*  