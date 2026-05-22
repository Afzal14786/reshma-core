<div align="center">

  <img src="../../src/assets/app-icon-reshma-boutique.png" alt="Reshma Bangles & Boutique Logo" width="120" />

  # Reshma‑Core Backend – Getting Started
  
  **Your 5‑minute guide to running the enterprise e‑commerce platform locally.**

  [![Node.js](https://img.shields.io/badge/Node.js-20.x-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Local_/_Docker-47A248?style=flat&logo=mongodb&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-Cache_/_Queues-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![Typesense](https://img.shields.io/badge/Typesense-Search_Engine-000000?style=flat&logo=typesense&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 📖 What’s in this folder?

| File | Description |
|------|-------------|
| `local-development.md` | Manual setup (Node, MongoDB, Redis) + available npm scripts. |
| `environment-variables.md` | Complete reference for all `.env` variables (local & Docker). |
| `database-seeding.md` | How to generate 500+ realistic products using the seed script. |
| `README.md` (this file) | Quick start overview – includes Docker Compose and common commands. |

---

## 🚀 Quick Start – Two Options

### Option A: Docker Compose (Recommended)

> **No local MongoDB/Redis/Typesense required** – everything runs in containers.

```bash
# 1. Clone the repository
git clone https://github.com/Afzal14786/reshma-core.git
cd reshma-core

# 2. Copy the environment template
cp .env.example .env

# 3. Edit .env – at minimum, set these values:
#    JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (use `openssl rand -hex 32`)
#    TYPESENSE_API_KEY (any strong string, e.g., "xyz123...")
#    For local Docker, leave MONGO_URI as is (it will be overridden by compose)

# 4. Start all services (API, Worker, MongoDB, Redis, Typesense)
docker-compose up -d

# 5. Seed the database (run inside the API container)
docker exec -it reshma-api npm run seed

# 6. Check logs
docker-compose logs -f
```  

The API will be available at `http://localhost:5000/api/v1`.  
📚 See Docker [Compose Deep Dive](./docker-setup.md) for production file details.  

### Option B: Manual (Without Docker)  

See [**Local Development Setup**](./local-development.md) for installing Node.js, MongoDB, Redis, and Typesense natively.  

---  

## 📦 Essential Commands (Docker & Local)  

| Action | Docker | Local (no Docker) |
|--------|--------|-------------------|
| Start services | `docker-compose up -d` | `npm run dev` (after starting DB/Redis manually) |
| Stop services | `docker-compose down` | `Ctrl + C` |
| Seed database | `docker exec -it reshma-api npm run seed` | `npm run seed` |
| View logs | `docker-compose logs -f reshma-api` | `npm run dev` (terminal output) |
| Rebuild after changes | `docker-compose up -d --build` | `npm run build` + `npm run dev` |
| Run worker separately | `docker-compose up -d reshma-worker` | `node dist/shared/queues/email.worker.js` |  

---  

## 🔧 Environment Variables – Quick Reference  

The most critical variables for local Docker are:  

```env
# Required – generate with `openssl rand -hex 32`
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# Typesense (any string, min 16 chars)
TYPESENSE_API_KEY=your_super_secret_key

# SMTP (for email) – optional for local testing
SMTP_USER=support@yourdomain.com
SMTP_PASS=your_app_password
```  
For a complete list, see [**Environment Variables Reference**](./environment-variables.md).  

---  

## ❓ Troubleshooting  

| Symptom | Likely Fix |
|---------|------------|
| Cannot find module '@config/env' | Run `npm run build` inside the container: `docker exec reshma-api npm run build` |
| Redis connection refused | Ensure Redis container is healthy: `docker ps` – or start manually with `docker-compose up -d reshma-redis` |
| Typesense returns empty results | Re‑seed: `docker exec reshma-api npm run seed`. Also check that `TYPESENSE_API_KEY` matches the one in `docker-compose.yml`. |
| Seeded products missing discriminators | The seed script uses discriminator models – re‑run after any schema changes. |

---  

## 🐳 Production Deployment  

The repository includes a `docker-compose.prod.yml` file for production‑like environments. It adds healthchecks, air‑gapped networks, and separate worker containers.  

```bash
docker-compose -f docker-compose.prod.yml up -d
```  

Refer to the [**Deployment Guide**](../deployment/README.md) for SSL, monitoring, and scaling.  

## 📚 Related Documentation  

- [Main Project README](../architecture/README.md) – high‑level architecture and module design.
- [API Reference](../api/README.md) – endpoint documentation (if available).
- [Database Seeding Deep Dive](./database-seeding.md) – understand the discriminator‑aware factory.
- [Environment Variables Deep Dive](./environment-variables.md) – all secrets and their purposes.  

---  

<div align="center">
Built with ❤️ and strict TypeScript – Reshma‑Core Team
</div>