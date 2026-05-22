<div align="center">

  <img src="../../src/assets/app-icon-reshma-boutique.png" alt="Reshma Bangles & Boutique Logo" width="120" />

  # Docker Setup Guide
  
  **Run the entire Reshma‑Core stack (API, worker, MongoDB, Redis, Typesense) in isolated containers – perfect for consistent development and production deployments.**

  [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](#)
  [![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-7-Alpine-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Typesense](https://img.shields.io/badge/Typesense-0.25.2-000000?style=flat&logo=typesense&logoColor=white)](#)

</div>

---

## 📋 Table of Contents

1. [Overview: Two Compose Files](#overview-two-compose-files)
2. [Prerequisites](#prerequisites)
3. [Development Environment (docker-compose.yml)](#development-environment-docker-composeyml)
4. [Production / Staging (docker-compose.prod.yml)](#production--staging-docker-composeprodyml)
5. [Environment Variables for Docker](#environment-variables-for-docker)
6. [Common Commands](#common-commands)
7. [Building & Rebuilding](#building--rebuilding)
8. [Database Seeding in Docker](#database-seeding-in-docker)
9. [Troubleshooting](#troubleshooting)
10. [Architecture Deep Dive](#architecture-deep-dive)

---

## Overview: Two Compose Files

| File | Purpose | Key Differences |
|------|---------|----------------|
| `docker-compose.yml` | **Local development** | No passwords, ports exposed, live reload bind mounts (optional), `restart: unless-stopped` |
| `docker-compose.prod.yml` | **Production / Staging** | Healthchecks, air‑gapped network, passwords required, `restart: always`, separate worker service |

> Both files use the same `Dockerfile` (multi‑stage build) but with different environment overrides.

---

## Prerequisites

- **Docker Engine** 20.10+ or **Docker Desktop** (Windows/Mac)
- **Docker Compose** V2 (included with Docker Desktop)
- At least **4GB RAM** allocated to Docker (for Typesense + MongoDB)

Verify installation:
```bash
docker --version
docker-compose --version
```  

## Development Environment (`docker-compose.yml`)  

### What’s included  

| Service | Container Name | Port (host) | Purpose |
|---------|----------------|-------------|---------|
| `reshma-api` | `reshma-api` | 5000 | Express API (Node.js) |
| `reshma-worker` | `reshma-worker` | – | BullMQ email/export worker |
| `reshma-db` | `reshma-db` | 27017 | MongoDB 7.0 |
| `reshma-redis` | `reshma-redis` | 6379 | Redis 7 Alpine |
| `reshma-typesense` | `reshma-typesense` | 8108 | Typesense 0.25.2 |  

All services run on a custom bridge network `reshma-network` for internal communication.  

### Step‑by‑Step  

```bash
# 1. Clone the repository (if not already)
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env – at minimum set:
#    - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (any strong string, min 10 chars)
#    - TYPESENSE_API_KEY (must match the one in docker-compose.yml, default: your-super-secret-key)
#    Leave other variables as placeholders for now.

# 4. Start all services in detached mode
docker-compose up -d

# 5. Check container status
docker-compose ps

# 6. Seed the database (products, categories, etc.)
docker exec -it reshma-api npm run seed

# 7. Follow API logs
docker-compose logs -f reshma-api
```  

The API will be available at `http://localhost:5000`.  
To stop: `docker-compose down`.  

### Development with Live Reload (Optional)  

If you want code changes to automatically rebuild and restart the API container, uncomment the `volumes` section in `docker-compose.yml`:  

```yaml
volumes:
  - ./src:/app/src   # mounts local source code
```  

Then rebuild and run:  

```bash
docker-compose up -d --build
```  

> **Note:** This is slower on Windows/macOS due to file system overhead. For active development, consider running `npm run dev` natively and only use Docker for dependent services (MongoDB, Redis, Typesense).

---  

## Production / Staging (`docker-compose.prod.yml`)  

### Differences from Development  

| Feature | Development | Production |
|---------|-------------|------------|
| **Authentication** | No DB/Redis passwords | `MONGO_INITDB_ROOT_USERNAME` + `REDIS_PASSWORD` required |
| **Healthchecks** | None (basic `depends_on`) | Active healthchecks on all services |
| **Port exposure** | All ports exposed to host | Only API port 5000 exposed |
| **Restart policy** | `unless-stopped` | `always` |
| **Networking** | Bridge network with exposed ports | Internal network only (air‑gapped) |
| **Worker** | Same image but runs `email.worker.js` | Same |  

### Environment Preparation  

Create a `.env.production` file (or reuse `.env`) with **all required variables**:  

```bash
# Must be set (no defaults in production compose)
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=strong_password_here
REDIS_PASSWORD=another_strong_password
TYPESENSE_API_KEY=your_super_secret_key   # must match the one in compose

# JWT secrets (required)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```  

### Running Production  

```bash
# Use the production compose file
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```  

> **Security:** Never expose MongoDB or Redis ports to the internet. The production compose file only publishes port `5000` (API). All other services are accessible only inside the Docker network.  

---  

## Environment Variables for Docker  

The `.env` file is **shared** between both compose files. However, certain variables are **overridden** inside containers:  

| Variable | Local (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|----------|------------------------------|----------------------------------------|
| `MONGO_URI` | `mongodb://reshma-db:27017/reshmabangles` | `mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@reshma-db:27017/reshmabangles?authSource=admin` |
| `REDIS_URL` | `redis://reshma-redis:6379` | `redis://default:${REDIS_PASSWORD}@reshma-redis:6379` |
| `TYPESENSE_HOST` | `reshma-typesense` | `reshma-typesense` |

> **You do not need to set these in your** `.env` – they are passed directly by the compose file.  

### Minimum `.env` for Docker (both modes)  

```env
# Core (required)
NODE_ENV=development          # or production
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# JWT (generate actual secrets)
JWT_ACCESS_SECRET=5f8d9a3c7e2b1f6a4d8c0e9b7a3f2d6c
JWT_REFRESH_SECRET=7b2e1f6a4d8c0e9b7a3f2d6c1e8b4a7f

# Typesense (must match the compose file's --api-key)
TYPESENSE_API_KEY=your-super-secret-key

# Optional for production – add if you need email/payment/shipping
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASS=...
```  

---  

## Common Commands  

| Action | Command |
|--------|---------|
| Start dev services | `docker-compose up -d` |
| Start prod services | `docker-compose -f docker-compose.prod.yml up -d` |
| Stop all | `docker-compose down` (add `-f docker-compose.prod.yml` for prod) |
| View logs (API) | `docker-compose logs -f reshma-api` |
| View logs (worker) | `docker-compose logs -f reshma-worker` |
| Execute command inside API container | `docker exec -it reshma-api bash` |
| Rebuild after code changes | `docker-compose up -d --build` |
| Remove volumes (reset data) | `docker-compose down -v` (⚠️ deletes databases) |
| Check resource usage | `docker stats` |

---  

## Building & Rebuilding  

The `Dockerfile` uses a multi‑stage build:  

| Stage | Purpose |
|-------|---------|
| `base` | Node 20 Alpine, sets working directory |
| `deps` | Installs all dependencies (including dev) |
| `builder` | Runs `npm run build` (TypeScript → JS + path alias resolution) |
| `runner` | Copies only production dependencies and compiled `dist/`, runs as `node` user |  

### When to rebuild  

- After changing `package.json` or `package-lock.json`
- After changing TypeScript source code (but not environment variables)
- After changing `tsconfig.json` or `Dockerfile`

```bash
docker-compose up -d --build --force-recreate
```  

> **Tip:** For rapid frontend/backend iteration, mount your source code as a volume (development only) to avoid rebuilding on every change.  

---  

## Database Seeding in Docker  

Even when running inside containers, you seed the database by executing `npm run seed` inside the API container.  

```bash
# Seed the database (development)
docker exec -it reshma-api npm run seed

# If using production compose file, container name is still "reshma-api"
docker exec -it reshma-api npm run seed
```  

The seed script will:  
- Delete existing products (destructive – only for development)
- Generate 500+ realistic products across all discriminators
- Automatically sync them to Typesense

To verify seeding succeeded:  
```bash
docker exec -it reshma-api node -e "require('./dist/db/seed.js')"   # alternative
```  

---  

## Troubleshooting  

### 1. `Error: Cannot find module '@config/env'`  

**Cause:** TypeScript not compiled inside the container.
**Fix:** Rebuild the image:  

```bash
docker-compose up -d --build
```  

### 2. MongoDB connection refused  

**Check:** Is the MongoDB container healthy?  

```bash
docker-compose ps
# Look for "reshma-db" with status "Up (healthy)" or "Up"

# Test connection from API container
docker exec -it reshma-api node -e "require('mongoose').connect('mongodb://reshma-db:27017/reshmabangles').then(()=>console.log('OK')).catch(e=>console.error(e))"
```  

### 3. Typesense returns empty search results  

**Check:** Has the seed script been run? Also verify the API key matches between `.env` and `docker-compose.yml`.  
```bash
# Check Typesense collections
docker exec -it reshma-typesense curl -H "X-TYPESENSE-API-KEY: your-super-secret-key" http://localhost:8108/collections
```  

### 4. Port conflicts (5000, 27017, 6379, 8108 already in use)  

**Solution A:** Stop the conflicting service on your host.
**Solution B:** Change the host port mapping in `docker-compose.yml` (e.g., `"5001:5000"`).  

### 5. Container exits immediately with code 1  
View the logs:  
```bash
docker-compose logs reshma-api
```  

Most likely an environment variable validation error – check your `.env` file matches the required schema.  

### 6. Worker cannot connect to Redis  

Ensure Redis is running and the `REDIS_URL` is correct. In development compose, it should be `redis://reshma-redis:6379`.  

```bash
docker-compose restart reshma-worker
```  

### 7. Out of memory (Typesense)  
Typesense keeps the entire index in RAM. For local development, reduce the number of seeded products by modifying `src/db/seed.ts` (change `500` to `100`).  

---  

## Architecture Deep Dive

### Internal Network

All services communicate via the `reshma-network` bridge network. Service names are resolvable as hostnames:

- `reshma-api` → API container
- `reshma-worker` → worker container
- `reshma-db` → MongoDB
- `reshma-redis` → Redis
- `reshma-typesense` → Typesense

### Healthchecks (Production only)

| Service | Healthcheck Command |
|---------|---------------------|
| `reshma-db` | `mongosh --eval 'db.runCommand("ping").ok'` |
| `reshma-redis` | `redis-cli -a $REDIS_PASSWORD ping` |
| `reshma-typesense` | `wget -qO- http://localhost:8108/health` |
| `reshma-api` | (implicitly depends on the above) |

### Volumes (Persistent Data)

| Volume | Mounted Path | Purpose |
|--------|--------------|---------|
| `mongodb_data` | `/data/db` | MongoDB database files |
| `redis_data` | `/data` | Redis persistence (RDB/AOF) |
| `typesense_data` | `/data` | Typesense index (snapshots) |

> **Warning:** Removing volumes (`docker-compose down -v`) will delete all data.  

### Worker Service  

The `reshma-worker` container runs the same image but overrides the command:  

```yaml
command: ["node", "dist/shared/queues/email.worker.js"]
```  

It processes BullMQ jobs (email sending, data export, search sync retries). The worker does not expose any ports.  

---  

## Next Steps

- Read the [Environment Variables Guide](./environment-variables.md) for production secrets.
- Learn how to [seed custom data](./database-seeding.md) for your local environment.
- For production deployment, add a reverse proxy (Nginx/Traefik) in front of the API container.
- Set up monitoring with `docker stats` or Prometheus + Grafana.  

---  

*The Reshma-Core Team*  