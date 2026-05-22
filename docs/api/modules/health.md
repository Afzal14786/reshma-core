<div align="center">

  # Health Module
  
  **The liveness and readiness probe – monitoring critical service dependencies for load balancers and orchestration.**

  [![Liveness](https://img.shields.io/badge/Liveness-Health_Check-47A248?style=flat)](#)
  [![Readiness](https://img.shields.io/badge/Readiness-Dependencies_Probe-FF6B6B?style=flat)](#)
  [![Rate Limit](https://img.shields.io/badge/Rate_Limit-3000/15min-3448C5?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoint Overview](#endpoint-overview)
- [Endpoint Details](#endpoint-details)
  - [GET /](#get-)
- [Response Structure](#response-structure)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route : `/api/v1/health`  


The health endpoint is **public** (no authentication required) and is rate‑limited generously to accommodate load balancer probes (AWS ELB, Kubernetes, etc.).

---

## Endpoint Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Public | Returns the health status of the API and its critical dependencies (MongoDB, Redis, Typesense). |

> Rate limit: 3000 requests per 15 minutes per IP (see [Rate Limiting Guide](../rate-limiting.md)). This is intentionally high for production load balancers but still prevents DoS attacks.

---

## Endpoint Details

### `GET /`

Probes the connectivity to MongoDB, Redis, and Typesense. Returns a `200 OK` only if **all** dependencies are reachable. If any dependency fails, returns `503 Service Unavailable` with details about the failing component.

**Headers:** None required.

**Response (200 OK – all services healthy):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "All services are operational",
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-22T10:30:00.000Z",
    "uptime": 86400,
    "services": {
      "mongodb": "connected",
      "redis": "connected",
      "typesense": "connected"
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

**Response (503 Service Unavailable – dependency failure):**  

```json
{
  "success": false,
  "statusCode": 503,
  "message": "Service Unavailable: One or more dependencies are down.",
  "data": {
    "status": "unhealthy",
    "timestamp": "2026-05-22T10:35:00.000Z",
    "uptime": 86400,
    "services": {
      "mongodb": "connected",
      "redis": "disconnected",
      "typesense": "connected"
    },
    "failedService": "redis"
  },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  
---  

## Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `data.status` | string | `"healthy"` if all dependencies are connected, otherwise `"unhealthy"` |
| `data.timestamp` | string (ISO) | Current server time |
| `data.uptime` | number | Server uptime in seconds (since `server.ts` started) |
| `data.services.mongodb` | string | `"connected"` or `"disconnected"` |
| `data.services.redis` | string | `"connected"` or `"disconnected"` |
| `data.services.typesense` | string | `"connected"` or `"disconnected"` |
| `data.failedService` | string | (Only on 503) Name of the first failing dependency |

### How checks are performed

| Service | Check Method |
|---------|--------------|
| MongoDB | `mongoose.connection.readyState === 1` |
| Redis | Ping command via Redis client |
| Typesense | Simple `GET /health` request to the Typesense cluster (timeout 3 seconds) |  

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 200 | `OK` | `"All services are operational"` | All dependencies healthy |
| 503 | `SERVICE_UNAVAILABLE` | `"Service Unavailable: One or more dependencies are down."` | Redis, MongoDB, or Typesense unreachable |
| 429 | `TOO_MANY_REQUESTS` | `"Health check rate limit exceeded."` | More than 3000 requests in 15 minutes |  

> The health endpoint never returns a `500`. Dependency failures always map to `503` to distinguish from application crashes.

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/health-runbook.md` (if created). The runbook covers:

- Normal healthy response
- Simulating Redis failure (stop Redis container)
- Simulating MongoDB failure
- Rate limit testing (3000 requests)  

---  

## Integration with Orchestration

### Docker Compose Healthcheck

In `docker-compose.prod.yml`, the API container does not have its own healthcheck; instead, it depends on the healthchecks of MongoDB, Redis, and Typesense. For production, you can add:

```yaml
reshma-api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:5000/api/v1/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```  

### Kubernetes Liveness & Readiness  

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/v1/health
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
```  

---  

## Related Documentation  

- [Rate Limiting Guide](../rate-limiting.md) – health limiter details.
- [Deployment – Docker Compose](../../deployment/docker-compose.md) – healthchecks in production.
- [Error Handling Guide](../error-codes.md) – 503 vs 500.  

---  

<div align="center">

Always know your service status – the Reshma‑Core health check engine.
</div>  