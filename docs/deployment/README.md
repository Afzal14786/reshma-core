<div align="center">

  # Deployment Guide – Reshma‑Core Backend
  
  **How to deploy the production stack to a VPS, cloud VM, or any Docker‑capable host.**

  [![Docker](https://img.shields.io/badge/Docker-Compose_Production-2496ED?style=flat&logo=docker&logoColor=white)](#)
  [![SSL](https://img.shields.io/badge/SSL-Let's_Encrypt-3A75C0?style=flat&logo=letsencrypt&logoColor=white)](#)
  [![Monitoring](https://img.shields.io/badge/Monitoring-Docker_Stats-FF6B6B?style=flat)](#)

</div>

---

## 📁 What’s in this folder?

| File | Description |
|------|-------------|
| `production-checklist.md` | Pre‑flight checklist – environment, secrets, security, backups. |
| `docker-compose.md` | Deep dive into `docker-compose.prod.yml` – running the stack, health checks, volumes. |
| `ci-cd.md` | Automated deployment with GitHub Actions / GitLab CI (optional). |
| `README.md` (this file) | High‑level overview and deployment options. |

---

## 🚀 Quick Deployment (TL;DR)

```bash
# 1. Clone the repository on your production server
git clone https://github.com/your-org/reshma-core.git
cd reshma-core

# 2. Create .env from template (fill all required values)
cp .env.example .env
nano .env   # set secrets, database passwords, JWT keys, API URLs

# 3. Start the production stack
docker-compose -f docker-compose.prod.yml up -d

# 4. Seed the database (first time only)
docker exec -it reshma-api npm run seed

# 5. Set up a reverse proxy (Nginx/Traefik) with SSL
# See docker-compose.md for recommended proxy configuration  
```   

The API will be available at `http://your-server-ip:5000`.  
For HTTPS, place Nginx in front (see proxy example in `docker-compose.md`).  

---  

## 🔗 Next Steps  

- Read the [Production Checklist](./production-checklist.md) before going live.
- Understand [Docker Compose in production](./docker-compose.md) – health checks, volumes, networking.
- (Optional) Set up [CI/CD automation](./ci-cd.md) for zero‑downtime updates.

---  

*The Reshma-Core Team*  