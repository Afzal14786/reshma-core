<div align="center">

  <img src="../../src/assets/reshma_bangles.jpg" alt="Reshma Bangles & Boutique Logo" width="120" />

  # Local Development Setup
  
  **The definitive guide to getting the Reshma-Core backend running on your local workstation – manually or with Docker.**

  [![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Local_/_Docker-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-Storage_/_Queues-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Typesense](https://img.shields.io/badge/Typesense-Search_Engine-000000?style=flat&logo=typesense&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 📋 Table of Contents

1. [Choosing Your Setup](#choosing-your-setup)
2. [Manual Setup (Native Installation)](#manual-setup-native-installation)
3. [Docker Setup (Containerised)](#docker-setup-containerised)
4. [Environment Configuration](#environment-configuration)
5. [Running the Application](#running-the-application)
6. [Database Seeding](#database-seeding)
7. [Troubleshooting](#troubleshooting)
8. [Available Scripts](#available-scripts)

---

## Choosing Your Setup

| Approach | Pros | Cons |
|----------|------|------|
| **Manual** | Full control, no Docker overhead, easier debugging | Requires installing MongoDB/Redis/Typesense natively |
| **Docker** | One‑command infrastructure, isolated, reproducible | Slightly slower startup, requires Docker knowledge |

**Recommendation:** Use **Docker** if you're new to the project – it avoids manual service installation. Use **Manual** if you already have MongoDB/Redis installed or want to contribute to infra scripts.

---

## Manual Setup (Native Installation)

### 1. Install Prerequisites

| Service | Installation Guide | Verification Command |
|---------|-------------------|----------------------|
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) | `node --version` |
| **MongoDB 6+** | [MongoDB Installation](https://www.mongodb.com/docs/manual/installation/) | `mongod --version` |
| **Redis 7+** | [Redis Installation](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/) | `redis-server --version` |
| **Typesense 0.25+** | [Typesense Installation](https://typesense.org/docs/guide/install-typesense.html) | `typesense --version` |

> **Windows users:** Use WSL2 for Redis and Typesense, or run them via Docker Desktop even for a manual Node setup.

### 2. Start the Services

**MongoDB (local, no auth):**
```bash
# Linux/macOS
sudo systemctl start mongod   # or `mongod --dbpath ~/data/db`

# Windows (if installed as service)
net start MongoDB
```  

**Redis (default port 6379):**  
```bash
redis-server
```  

**Typesense (in-memory, API key required):**  
```bash
typesense --data-dir ./typesense-data --api-key=your_super_secret_key --enable-cors
```  

> Save the API key – you'll need it in the `.env` file as `TYPESENSE_API_KEY`.  

---  

### 3. Clone & Install   

```bash
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core
npm install
```  

---  

### 4. Configure Environment  

```bash
cp .env.example .env
```  

Edit `.env` – for **local manual setup**, use these values:  

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/reshma-boutique-dev
REDIS_URL=redis://localhost:6379
# No REDIS_PASSWORD needed for local
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your_super_secret_key   # must match the one used when starting typesense
# Generate JWT secrets (see environment-variables.md)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```  

All other variables (SMTP, Cloudinary, Razorpay) can be left as placeholders for local testing – the app will log errors but not crash.  

---  

## Docker Setup (Containerised)  

### Prerequisites  

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux)
- Docker Compose (included with Docker Desktop)  

### Steps  

```bash
# 1. Clone the repository
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env – at minimum set:
#    - JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (generate with `openssl rand -hex 32`)
#    - TYPESENSE_API_KEY (any strong string, must match the one in docker-compose.yml)
#    For local Docker, you can leave MONGO_URI as is – it will be overridden by compose.

# 4. Start all services (API, worker, MongoDB, Redis, Typesense)
docker-compose up -d

# 5. Seed the database (run inside the API container)
docker exec -it reshma-api npm run seed

# 6. View logs
docker-compose logs -f
```  

The API will be available at `http://localhost:5000`.  
To stop: `docker-compose down`. To rebuild after code changes: `docker-compose up -d --build`.  

---  

## Environment Configuration  

The `.env` file is validated at startup by `src/config/env.ts`. Missing or malformed variables will crash the app with a clear error.  

### Minimal `.env` for Local Development   

```env
# Core
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# Database (manual)
MONGO_URI=mongodb://localhost:27017/reshma-boutique-dev

# Redis (manual)
REDIS_URL=redis://localhost:6379

# Typesense (manual) – API key must match the one used when starting Typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your_super_secret_key

# JWT – generate strong secrets (see note below)
JWT_ACCESS_SECRET=5f8d9a3c...
JWT_REFRESH_SECRET=7b2e1f6a...

# Optional – can be dummy values for local testing
SMTP_HOST=smtp.ethereal.email
SMTP_USER=dummy@ethereal.email
SMTP_PASS=dummy
```   

> **Generating JWT secrets:**  
> Run `openssl rand -hex 32` (Linux/macOS) or use Node:  
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.  

For a complete reference, see [Environment Variables Guide](./environment-variables.md).  

---  

## Running the Application  

### Manual Setup  

| Terminal | Command | Description |
|----------|---------|-------------|
| **1 (API)** | `npm run dev` | Starts the Express server with hot‑reload (port 5000) |
| **2 (Worker)** | `node dist/shared/queues/email.worker.js` | (after building) processes BullMQ jobs – optional for local testing |  


> The worker is only needed for email notifications and data export. You can ignore it initially – the API will still work.  

### Docker Setup  

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Starts API + worker + all dependencies in background |
| `docker-compose logs -f reshma-api` | Follow API logs |
| `docker-compose exec reshma-api npm run build` | Rebuild TypeScript inside container |

### Database Seeding  

The seed script generates 500+ realistic products across all Mongoose discriminators (Apparel, Bangles, Fabric, Innerwear, Accessory).  

**Manual:**  

```bash
npm run seed
```  

**Docker:**  
```bash
docker exec -it reshma-api npm run seed
```  

**What to expect:**  
- Deletes existing products (destructive – only for development).
- Inserts products with realistic names, prices, images, and stock.
- Outputs a success message with product counts per category.

See [Database Seeding Deep Dive](./database-seeding.md) for details.  

---  

## Troubleshooting  

### 1. Cannot `find module '@config/env'`  

**Cause:** TypeScript path aliases not resolved at runtime.  
**Fix:** Run `npm run build` (or `docker exec reshma-api npm run build`) before starting the server. The development mode (`npm run dev`) uses `ts-node` which respects `tsconfig.json` paths, so this error usually occurs only in production mode.  

### 2. Redis connection refused  

**Manual:** Ensure Redis is running: `redis-server` (Linux/macOS) or `redis-server --service-start` (Windows).  
**Docker:** Run `docker-compose up -d reshma-redis` and check `docker ps`.  

### 3. Typesense not responding / search returns empty

- **Manual:** Start Typesense with the same API key as in `.env`.
- **Docker:** Typesense is included in compose – ensure it's healthy: `docker-compose ps`.
- **After seeding:** Run the seed script – it automatically syncs products to Typesense.

### 4. MongoDB authentication failed

- **Manual:** Use a URI without credentials: `mongodb://localhost:27017/reshma-boutique-dev`.
- **Docker:** The compose file sets no root password – use `mongodb://reshma-db:27017/reshmabangles`.

### 5. Port already in use (5000, 6379, 27017, 8108)

- **Fix:** Stop the conflicting service or change the port in `.env` (and in `docker-compose.yml` if using Docker).

### 6. `npm run dev` crashes with `NODE_OPTIONS=--max-old-space-size=4096` error

- **Fix:** Remove `NODE_OPTIONS` from your shell or reduce memory limit. This is not required for the project.

### 7. Worker cannot connect to Redis after Docker restart

- **Fix:** Ensure the `reshma-redis` container is running: `docker-compose restart reshma-redis`.   

---  

## Available Scripts  

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with ts-node + nodemon (hot‑reload) |
| `npm run build` | Compile TypeScript → `dist/` and resolve path aliases (`tsc-alias`) |
| `npm run start` | Run the compiled production build from `dist/server.js` |
| `npm run seed` | Generate and insert mock product data (destructive) |
| `npm run format` | Format all TypeScript files with Prettier |
| `npm run format:check` | Check formatting without writing |  

---  

## Next Steps

- Read the [Environment Variables](./environment-variables.md) Guide to understand all secrets.
- Explore the [Database Seeding](./database-seeding.md) to customise mock data.
- For production deployment, see `docker-compose.prod.yml` and the [Deployment Guide](../deployment/README.md).  

---  

*The Reshma-Core Team*  