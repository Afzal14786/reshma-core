# Production Deployment Checklist

Before deploying the Reshma‑Core backend to production, verify each item below.

---

## ✅ Environment & Secrets

| Item | Status | Notes |
|------|--------|-------|
| `.env` file created from `.env.example` | ☐ | Do NOT commit to Git |
| `NODE_ENV=production` | ☐ | Must be exactly "production" |
| `CLIENT_URL` set to actual frontend domain (e.g., `https://shop.example.com`) | ☐ | No trailing slash |
| `ADMIN_URL` set to actual admin dashboard domain | ☐ | |
| `MONGO_URI` uses credentials and `authSource=admin` | ☐ | Example: `mongodb://user:pass@reshma-db:27017/reshmabangles?authSource=admin` |
| `JWT_ACCESS_SECRET` – strong, random, ≥32 hex bytes | ☐ | Run `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` – different from access secret | ☐ | |
| `TYPESENSE_API_KEY` – strong Admin API key | ☐ | Must match the key in `docker-compose.prod.yml` |
| `REDIS_PASSWORD` set (not blank) | ☐ | Used in production compose |
| `SMTP_*` – verified credentials (send test email) | ☐ | |
| `RAZORPAY_*` – live keys (not test) | ☐ | |
| `SHIPROCKET_*` – live credentials | ☐ | |

---

## ✅ Infrastructure & Security

| Item | Status | Notes |
|------|--------|-------|
| Docker & Docker Compose installed (≥20.10, ≥2.0) | ☐ | |
| Firewall allows only port 80, 443 (and 22 for SSH) | ☐ | Do NOT expose 5000 directly to the internet |
| Reverse proxy (Nginx/Traefik) configured with SSL | ☐ | Let’s Encrypt recommended |
| SSL certificate valid and auto‑renewal set up | ☐ | |
| Server timezone set to UTC (or your region) | ☐ | Affects JWT expiration, logs |
| Regular security updates enabled (unattended‑upgrades) | ☐ | |

---

## ✅ Health & Monitoring

| Item | Status | Notes |
|------|--------|-------|
| Health endpoint exists (e.g., `GET /health`) | ☐ | Should return `200 OK` |
| Docker healthchecks defined in `docker-compose.prod.yml` | ☐ | Included by default |
| Logging configured (Winston to files + console) | ☐ | Ensure log rotation |
| Monitoring alerts set (e.g., Uptime Kuma, Prometheus) | ☐ | At minimum, check container status |
| Backup strategy for MongoDB volumes | ☐ | `mongodump` to separate location |
| Backup strategy for Typesense data (optional) | ☐ | Snapshot volume or re‑seed from MongoDB |

---

## ✅ Application Readiness

| Item | Status | Notes |
|------|--------|-------|
| Database seeded with initial products / categories | ☐ | Run `npm run seed` inside API container |
| Typesense schema initialised (auto on first start) | ☐ | Check logs for `[Typesense] Schema successfully built` |
| Admin user created (if needed) | ☐ | Use `User.create` via MongoDB shell or script |
| Rate limiting tuned for expected traffic | ☐ | Default `standardLimiter` = 100 per 15 min |
| Email templates (MJML) compiled and tested | ☐ | Send a test OTP email |

---

## ✅ Pre‑Launch Dry Run

| Test | Expected Result | Pass? |
|------|----------------|-------|
| `docker-compose -f docker-compose.prod.yml up -d` | All containers start without errors | ☐ |
| `curl http://localhost:5000/health` | `200 OK` | ☐ |
| `docker-compose logs reshma-api` | No fatal errors | ☐ |
| Register a new user via API | User created, email sent | ☐ |
| Search products (`GET /api/v1/search?q=bangle`) | Returns results | ☐ |
| Check that refresh tokens are HttpOnly (no `document.cookie`) | Cookies flagged correctly | ☐ |
| Load test (e.g., `ab -n 100 -c 10 http://...`) | No crashes, rate limiting works | ☐ |

---

## ✅ Post‑Deployment

| Item | Status | Notes |
|------|--------|-------|
| `.env` file backed up securely (off‑server) | ☐ | Not in Git |
| Monitoring dashboard configured | ☐ | |
| On‑call / incident response plan | ☐ | |
| Regular backup restore tested | ☐ | |

---

**Sign‑off:** _________________   **Date:** _______________
