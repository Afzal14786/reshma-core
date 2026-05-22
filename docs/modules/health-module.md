<div align="center">

  # Health & DevOps Integration Module

  **The deep liveness probe and orchestration bridge for Reshma‑Core.**

  [![Docker](https://img.shields.io/badge/Docker-Orchestration-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com/)
  [![AWS ECS](https://img.shields.io/badge/AWS_ECS-Target_Groups-FF9900?style=flat&logo=amazonaws&logoColor=white)](https://aws.amazon.com/ecs/)
  [![Redis](https://img.shields.io/badge/Redis-Health_Check-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Admin_Ping-47A248?style=flat&logo=mongodb&logoColor=white)](https://mongodb.com/)

</div>

---

## 1. Overview & Purpose

In a cloud‑native, horizontally scaled environment (AWS ECS, Kubernetes, Docker Swarm), the infrastructure orchestrator relies on a **load balancer** to route traffic only to healthy containers.

If a Node.js container loses connection to MongoDB but the Express server is still technically running, a naive load balancer would continue sending user requests to that broken container, causing cascading transaction failures.

The Health Module exposes a **deep liveness probe** (`GET /api/v1/health`). It evaluates the true state of the application and its external dependencies, instructing the load balancer to either keep the container in rotation or pull it out.

---

## 2. Deep Liveness vs. Shallow Pings

A “shallow ping” (e.g., `res.send("OK")`) only proves the Node.js event loop is running – insufficient for enterprise routing.

Our `HealthController` executes a **strict, synchronised deep probe** across all microservice dependencies:

| Dependency | Execution Method | Pass Condition |
|------------|------------------|----------------|
| **MongoDB** | `mongoose.connection.db.admin().ping()` | Database cluster must actively respond to an admin‑level ping, proving the socket is alive. |
| **Redis** | `redisClient.ping()` | Caching and queueing cluster must respond to ensure BullMQ and rate limiters can operate. |
| **Typesense** | `typesenseManager.client.health.retrieve()` | Search engine must return a healthy state. |

**Traffic routing logic:**
- **All dependencies UP** → `HTTP 200 OK`. Load balancer keeps the container in the target group.
- **Any dependency DOWN** → `HTTP 503 Service Unavailable`. Load balancer pulls the container out of rotation and a replacement instance is spun up.

---

## 3. Controller Implementation (`health.controller.ts`)

The controller builds a `healthStatus` object with `status`, `timestamp`, `services` (each with `status` and `latency` in ms), and `system` metrics.

### MongoDB Deep Probe
```typescript
if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
  const mongoStart = Date.now();
  await mongoose.connection.db.admin().ping();
  healthStatus.services.mongodb.latency = Date.now() - mongoStart;
  healthStatus.services.mongodb.status = "UP";
} else {
  throw new Error("Mongoose readyState indicates disconnection.");
}
```  
- Checks `readyState === 1` (connected) and `db` exists.
- Measures latency to help operations teams detect slow database responses.  

### Redis Deep Probe  
```typescript
if (redisClient.isOpen) {
  const redisStart = Date.now();
  await redisClient.ping();
  healthStatus.services.redis.latency = Date.now() - redisStart;
  healthStatus.services.redis.status = "UP";
} else {
  throw new Error("Redis client is not open.");
}
```  
- Uses `redisClient.isOpen` to avoid calling `ping()` on a dead client.    

### Typesense Deep Probe  

```typescript
const tsStart = Date.now();
await typesenseManager.client.health.retrieve();
healthStatus.services.typesense.latency = Date.now() - tsStart;
healthStatus.services.typesense.status = "UP";
```  

- Calls the Typesense server’s built‑in health endpoint.  

### Hardware Metrics  

```typescript
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
healthStatus.system.memoryUsagePercent = parseFloat(((usedMem / totalMem) * 100).toFixed(2));
healthStatus.system.cpuLoadAvg = os.loadavg();
```  

- `memoryUsagePercent` – used by scaling policies.
- `cpuLoadAvg` – array of 1, 5, and 15 minute averages.  

### Final Health Evaluation  
If any dependency probe fails, `isHealthy` becomes `false`, `status` changes to `"DEGRADED"`, and the response status is `503 SERVICE_UNAVAILABLE`. Otherwise `200 OK`.  

---  

## 4. Rate Limiting & DoS Mitigation (`health.routes.ts`)

Exposing a deep probe creates a Denial of Service risk – an attacker could spam the endpoint with 10,000 requests per second, causing the server to execute 30,000 database pings per second.

**Solution:** A dedicated `healthLimiter` (defined in `rate-limit.middleware.ts`) is applied.  

```typescript
router.get("/", healthLimiter, HealthController.checkHealth);
```  

The limiter is **capped at 3000 requests per 15 minutes** – high enough for AWS ELB/Kubernetes health checks, but strictly blocks malicious volumetric botnets.  

### Memory Isolation  

Unlike other limiters, `healthLimiter` is stored in **local Node RAM**, not Redis. If Redis crashes, the health check must still be able to report the `503` degraded state to the load balancer.  

---  

## 5. Expected Response Schemas  

### Healthy State (200 OK)  

```json
{
  "status": "OK",
  "timestamp": "2026-05-22T10:15:00.000Z",
  "services": {
    "mongodb": { "status": "UP", "latency": 12 },
    "redis": { "status": "UP", "latency": 2 },
    "typesense": { "status": "UP", "latency": 4 }
  },
  "system": {
    "memoryUsagePercent": 45.2,
    "cpuLoadAvg": [0.15, 0.20, 0.18]
  }
}
```  

### Degraded State (503 Service Unavailable)  

```json
{
  "status": "DEGRADED",
  "timestamp": "2026-05-22T10:16:00.000Z",
  "services": {
    "mongodb": { "status": "DOWN", "latency": 0 },
    "redis": { "status": "UP", "latency": 2 },
    "typesense": { "status": "UP", "latency": 4 }
  },
  "system": {
    "memoryUsagePercent": 48.1,
    "cpuLoadAvg": [0.22, 0.25, 0.20]
  }
}
```  
---  

## 6. Integration with DevOps Tooling

The `memoryUsagePercent` and `cpuLoadAvg` fields are designed for ingestion by:

- AWS CloudWatch (via the CloudWatch agent or structured logs)
- Prometheus + Grafana (using a metrics exporter)
- Datadog (via the Datadog agent)

Operations teams can set up autoscaling policies: *“If average CPU load exceeds 75% across the cluster, spawn two new containers.”*   

---  

## 7. Security & Reliability Highlights

| Concern | Mitigation |
|---------|-------------|
| DoS attack on `/health` | `healthLimiter` (3000 requests / 15 min) in local memory. |
| Redis outage | Health check does not rely on Redis – bypasses limiter and still returns 503. |
| Mongoose disconnection | `readyState` check prevents `ping()` on a dead connection. |
| Typesense unreachable | `health.retrieve()` called with short timeout (5 seconds, set in `typesense.ts`). |
| Log injection | All error messages pass through `safeLog()` (not shown in snippet but implemented in `typesense.ts`). |  

---  

## 8. Fail‑Fast Boot Sequence

During server startup (`server.ts`), the `typesenseManager.initializeSchema()` method validates the Typesense cluster. If the cluster is unreachable, the server refuses to boot, preventing a partially functional system from serving traffic.

This fail‑fast behaviour ensures that dependencies are fully functional before the API accepts any requests.  

---  

## 9. Related Files

| File | Purpose |
|------|---------|
| `src/modules/health/health.controller.ts` | Deep probe logic (MongoDB, Redis, Typesense, OS metrics). |
| `src/modules/health/health.routes.ts` | Route definition with `healthLimiter`. |
| `src/shared/middlewares/rate-limit.middleware.ts` | `healthLimiter` (memory store, 3000/15 min). |
| `src/config/redis.ts` | Redis client initialisation and `isOpen` handling. |
| `src/config/typesense.ts` | Typesense manager and health check method. |  

---  

## Next Steps

- Explore [Middleware & Validation](../architecture/middleware-and-validation.md) for deeper rate limiting details.
- Understand [DevOps & Infrastructure](../architecture/devops-and-infrastructure.md) for deployment strategies.
- See [Security Hardening](../architecture/security-hardening.md) for CodeQL‑related fixes.  

---  

*The Reshma-Core Team*  