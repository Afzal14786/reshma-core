# Docker Compose in Production

This document explains how to run the Reshma‑Core backend using `docker-compose.prod.yml` on a production server.

---

## File Overview

`docker-compose.prod.yml` defines five services:

| Service | Image / Build | Purpose |
|---------|---------------|---------|
| `reshma-api` | Builds from `Dockerfile` | Express API (Node.js) |
| `reshma-worker` | Same build, overridden command | BullMQ email/export worker |
| `reshma-db` | `mongo:7.0` | MongoDB database |
| `reshma-redis` | `redis:7-alpine` | Redis (caching, queues, rate limiting) |
| `reshma-typesense` | `typesense/typesense:0.25.2` | Search engine (RAM‑based) |

**Networking:** All services communicate on an internal bridge network. Only the `reshma-api` port `5000` is exposed to the host.

---

## Prerequisites

- A server with Docker and Docker Compose (≥20.10, ≥2.0)
- At least **2GB RAM** (4GB recommended)
- Domain name (optional but recommended for SSL)

---

## Step‑by‑Step Setup

### 1. Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose (if not bundled)
sudo apt install docker-compose-plugin
```  

### 2. Clone and Configure  

```bash
git clone https://github.com/your-org/reshma-core.git
cd reshma-core

cp .env.example .env
nano .env
```  

**Required variables for production** (must be set):  

```env
NODE_ENV=production
CLIENT_URL=https://shop.yourdomain.com
ADMIN_URL=https://admin.yourdomain.com

MONGO_URI=mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@reshma-db:27017/reshmabangles?authSource=admin

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

TYPESENSE_API_KEY=your_super_secret_key   # must match the one in docker-compose.prod.yml

REDIS_PASSWORD=strong_redis_password

# SMTP, Razorpay, Shiprocket – fill with live credentials
```  

> The compose file uses variable substitution for `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `REDIS_PASSWORD`, and `TYPESENSE_API_KEY`. Ensure these are defined in `.env`.  

### 3. Start the Stack  

```bash
docker-compose -f docker-compose.prod.yml up -d
``` 

Check containers:  

```bash
Check containers:
```  

All should show `Up (healthy)` after ~30 seconds.  

### 4. Seed the Database (First Run Only)  

```bash
docker exec -it reshma-api npm run seed
```  

### 5. Verify Operation  

```bash
curl http://localhost:5000/health   # should return 200 OK
docker-compose -f docker-compose.prod.yml logs --tail=50 reshma-api
```  

---  

## Environment Variables Override  

The compose file passes the following environment variables to containers:

| Container | Variables (excerpt) |
|-----------|---------------------|
| `reshma-api` | `NODE_ENV`, `PORT`, `MONGO_URI`, `REDIS_URL`, `TYPESENSE_*`, all JWT variables, SMTP, Razorpay, etc. |
| `reshma-worker` | `MONGO_URI`, `REDIS_URL` (no API‑related vars) |
| `reshma-db` | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| `reshma-redis` | `REDIS_PASSWORD` (via command) |
| `reshma-typesense` | `TYPESENSE_API_KEY` (via command) |

> **Note:** `REDIS_URL` inside `reshma-api` becomes `redis://default:${REDIS_PASSWORD}@reshma-redis:6379`. Do **NOT** set `REDIS_URL` in `.env` – it is constructed by Compose.  

---  

## Health Checks & Resilience  

Each service has a health check:

| Service | Health Check | Interval | Retries |
|---------|--------------|----------|---------|
| `reshma-db` | `mongosh --eval 'db.runCommand("ping").ok'` | 10s | 5 |
| `reshma-redis` | `redis-cli -a $REDIS_PASSWORD ping` | 10s | 5 |
| `reshma-typesense` | `wget -qO- http://localhost:8108/health` | 10s | 5 |
| `reshma-api` | Depends on the above via `depends_on` | – | – |

The API will **not start** until DB, Redis, and Typesense are healthy.  

---  

## Persistent Storage (Volumes)  

| Volume | Mounted on | Purpose |
|--------|------------|---------|
| `mongodb_data` | `/data/db` | MongoDB data files |
| `redis_data` | `/data` | Redis persistence (RDB/AOF) |
| `typesense_data` | `/data` | Typesense index snapshots |  

These volumes are named and persist across container restarts. To **reset all data:**  

```bash
docker-compose -f docker-compose.prod.yml down -v
```  

> ⚠️ This deletes all databases, caches, and search indexes. Use only during disaster recovery.  

---  

## Reverse Proxy & SSL (Recommended)  

Do **not** expose port `5000` directly to the internet. Instead, place Nginx in front.  

### Example nginx.conf snippet  

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```  

Use Certbot to obtain SSL certificates:  

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```  

---  

## Updating the Application  

To deploy a new version:  

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs --tail=50 reshma-api
```  

The old containers are replaced one by one (no downtime if you have multiple replicas – but this single‑node setup has a brief interruption).  

---  

## Monitoring & Logs  

### Basic Monitoring  

```bash
# Container resource usage
docker stats

# Health status
docker-compose -f docker-compose.prod.yml ps
```  

### Log Aggregation  

Winston writes logs to files (if configured) and console. To persist logs outside containers, mount a volume:  

```yaml
volumes:
  - ./logs:/app/logs
```  

Then set `Winston` file transport to write to `/app/logs`.  

---  

## Troubleshooting  

| Problem | Likely Fix |
|---------|-------------|
| `reshma-api` exits with code 1 | Check logs: `docker-compose logs reshma-api`. Usually an env validation error. |
| MongoDB refuses connection | Verify `MONGO_INITDB_ROOT_USERNAME` and `PASSWORD` are set in `.env`. |
| Typesense fails to start | Ensure `TYPESENSE_API_KEY` is strong (no special characters causing shell issues). |
| Redis connection error | Redis password mismatch – check `REDIS_PASSWORD` in `.env` matches the command. |
| API returns 503 (Service Unavailable) | Dependency health check failed – wait longer or check DB/Redis logs. |  

---  

## Next Steps  

- Set up [CI/CD](./ci-cd.md) for automated builds and deployments.
- Implement backup scripts for MongoDB volumes.
- Add a second API replica + load balancer for high availability (optional).  

---  

*The Reshma-Core Team*  
