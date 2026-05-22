# Environment Variables Configuration Guide

## Overview
The Reshma-Core backend utilizes a **strict fail-fast initialization** strategy. All environment variables are validated at runtime using a Zod schema located in [`src/config/env.ts`](../../src/config/env.ts). If any required variable is missing, empty, or incorrectly formatted, the Node.js process will terminate immediately with a descriptive validation error. This ensures that the system never runs in an insecure or partially configured state.

---

## Validation Rules & Defaults

The table below reflects the exact rules defined in `env.ts`. Variables marked **Required** must be present in your `.env` file – the server will not start without them.

| Variable | Required | Default | Validation / Notes |
| :--- | :---: | :--- | :--- |
| `PORT` | ❌ | `"5000"` | String (coerced to number internally) |
| `NODE_ENV` | ❌ | `"development"` | Must be `development`, `production`, or `test` |
| `CLIENT_URL` | ✅ | – | Valid URL (e.g., `http://localhost:3000`) |
| `ADMIN_URL` | ✅ | – | Valid URL (e.g., `http://localhost:3001`) |
| `MONGO_URI` | ✅ | – | Non‑empty string – MongoDB connection string |
| `JWT_ACCESS_SECRET` | ✅ | – | Min 10 characters – strong secret recommended |
| `JWT_ACCESS_EXPIRES_IN` | ❌ | `"15m"` | String (e.g., `15m`, `1h`, `7d`) |
| `JWT_REFRESH_SECRET` | ✅ | – | Min 10 characters – different from access secret |
| `JWT_REFRESH_EXPIRES_IN` | ❌ | `"7d"` | String |
| `GOOGLE_CLIENT_ID` | ✅ | – | Non‑empty string |
| `GOOGLE_CLIENT_SECRET` | ❌ | – | Optional – only needed if using Google OAuth |
| `GOOGLE_CALLBACK_URL` | ❌ | – | Optional – valid URL |
| `CLOUDINARY_CLOUD_NAME` | ✅ | – | Non‑empty |
| `CLOUDINARY_API_KEY` | ✅ | – | Non‑empty |
| `CLOUDINARY_API_SECRET` | ✅ | – | Non‑empty |
| `REDIS_URL` | ❌ | `"redis://localhost:6379"` | Valid Redis URL |
| `REDIS_PASSWORD` | ❌ | – | Optional – used if Redis requires auth |
| `SMTP_HOST` | ✅ | – | Non‑empty string (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | ❌ | `587` | Coerced to number |
| `SMTP_USER` | ✅ | – | Valid email address |
| `SMTP_PASS` | ✅ | – | Non‑empty |
| `EMAIL_FROM` | ✅ | – | Non‑empty (e.g., `"Reshma <support@...>"`) |
| `RAZORPAY_KEY_ID` | ✅ | – | Non‑empty |
| `RAZORPAY_KEY_SECRET` | ✅ | – | Non‑empty |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | – | Non‑empty |
| `SHIPROCKET_EMAIL` | ✅ | – | Valid email |
| `SHIPROCKET_PASSWORD` | ✅ | – | Non‑empty |
| `SHIPROCKET_API_BASE_URL` | ❌ | `"https://apiv2.shiprocket.in"` | Valid URL |
| `SHIPROCKET_WEBHOOK_SECRET` | ✅ | – | Non‑empty |
| `TYPESENSE_HOST` | ✅ | – | Non‑empty (e.g., `localhost` or `xxx.typesense.net`) |
| `TYPESENSE_PORT` | ❌ | `8108` | Coerced to number |
| `TYPESENSE_PROTOCOL` | ❌ | `"http"` | Must be `http` or `https` |
| `TYPESENSE_API_KEY` | ✅ | – | Non‑empty – **Admin** API key (not search‑only) |

> **Important:** `CLIENT_URL` and `ADMIN_URL` have **no default** – you must set them even for local development. They are used for CORS and email link generation.

---

## 1. Core Server Settings

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Port the Express server listens on | `5000` |
| `NODE_ENV` | Environment – affects logging, error messages, and CORS | `development` / `production` / `test` |
| `CLIENT_URL` | Origin of the main customer frontend (React/Next.js) | `http://localhost:3000` |
| `ADMIN_URL` | Origin of the admin dashboard | `http://localhost:3001` |

**Graceful Shutdown:** The server traps `SIGTERM` and `SIGINT` signals, stops accepting new requests, drains active connections, and safely closes MongoDB & Redis connections to prevent data corruption during deployments or container stops.

---

## 2. Database & Infrastructure

| Variable | Description | Local Example | Docker Example |
| :--- | :--- | :--- | :--- |
| `MONGO_URI` | Full MongoDB connection string | `mongodb://localhost:27017/reshma-boutique-dev` | `mongodb://admin:pass@reshma-db:27017/reshmabangles?authSource=admin` |
| `REDIS_URL` | Redis connection endpoint | `redis://localhost:6379` | `redis://default:${REDIS_PASSWORD}@reshma-redis:6379` |
| `REDIS_PASSWORD` | Optional – for password‑protected Redis | (leave blank) | Set in `.env` and referenced in compose |

**Additional Redis usage:**
- **BullMQ queues** – email dispatch, data export, search sync retries.
- **Distributed locking** – prevents duplicate cron jobs across multiple server instances.
- **Rate limiting** – stores request counts (when using `rate-limit-redis`).

---

## 3. Two‑Token Authentication Architecture

The system uses short‑lived **Access Tokens** (in memory, `Authorization` header) and long‑lived **Refresh Tokens** (HttpOnly cookies).

| Variable | Required | Recommended Value | Generation Command |
| :--- | :---: | :--- | :--- |
| `JWT_ACCESS_SECRET` | ✅ | 64‑character hex | `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN` | ❌ | `15m` | – |
| `JWT_REFRESH_SECRET` | ✅ | 64‑character hex (different from above) | `openssl rand -hex 32` |
| `JWT_REFRESH_EXPIRES_IN` | ❌ | `7d` | – |

> **Security:** Never use the same secret for access and refresh tokens. Rotate secrets periodically in production.

---

## 4. Social Authentication (Google OAuth)

| Variable | Required | Notes |
| :--- | :---: | :--- |
| `GOOGLE_CLIENT_ID` | ✅ | Obtained from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | ❌ | Only needed if you enable Google login |
| `GOOGLE_CALLBACK_URL` | ❌ | Default callback route: `/api/v1/auth/google/callback` |

> If you are not using Google OAuth, you can leave the optional variables blank – but `GOOGLE_CLIENT_ID` must still have a dummy value to pass validation (the auth routes will be unavailable).

---

## 5. Media Pipeline (Cloudinary)

All images (product photos, user avatars) are uploaded directly from memory buffers to Cloudinary.

| Variable | Required | Where to find |
| :--- | :---: | :--- |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary Dashboard |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary Dashboard (keep secret) |

The integration is defined in [`src/config/cloudinary.ts`](../../src/config/cloudinary.ts). It automatically converts uploaded images to WebP format for bandwidth savings.

---

## 6. Notification Engine (SMTP)

Used for transactional emails (OTP, password change confirmation, order updates, data export).

| Variable | Required | Example |
| :--- | :---: | :--- |
| `SMTP_HOST` | ✅ | `smtp.gmail.com` |
| `SMTP_PORT` | ❌ | `587` (default) |
| `SMTP_USER` | ✅ | `support@reshmabangles.com` |
| `SMTP_PASS` | ✅ | For Gmail: 16‑character **App Password** |
| `EMAIL_FROM` | ✅ | `"Reshma Bangles <support@reshmabangles.com>"` |

> **Gmail users:** Enable 2‑Factor Authentication and generate an **App Password**. Your regular Gmail password will not work.

---

## 7. Payment Gateway (Razorpay)

| Variable | Required | Format |
| :--- | :---: | :--- |
| `RAZORPAY_KEY_ID` | ✅ | Starts with `rzp_test_` or `rzp_live_` |
| `RAZORPAY_KEY_SECRET` | ✅ | Secret from Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | Used to verify webhook signatures |

Webhook secret is mandatory – even for local testing you can set a dummy value, but the endpoint will validate it.

---

## 8. Logistics & Shipping (Shiprocket)

| Variable | Required | Notes |
| :--- | :---: | :--- |
| `SHIPROCKET_EMAIL` | ✅ | Email used to log into Shiprocket |
| `SHIPROCKET_PASSWORD` | ✅ | Shiprocket account password |
| `SHIPROCKET_API_BASE_URL` | ❌ | Defaults to production API |
| `SHIPROCKET_WEBHOOK_SECRET` | ✅ | Used to verify delivery status callbacks |

> These are required for shipping label generation and order tracking. For local development without Shiprocket, you can use dummy values – but the integration will log errors.

---

## 9. Search Engine (Typesense)

| Variable | Required | Local (Docker) | Cloud |
| :--- | :---: | :--- | :--- |
| `TYPESENSE_HOST` | ✅ | `localhost` or `reshma-typesense` | `xxx.a1.typesense.net` |
| `TYPESENSE_PORT` | ❌ | `8108` | `443` |
| `TYPESENSE_PROTOCOL` | ❌ | `http` | `https` |
| `TYPESENSE_API_KEY` | ✅ | any strong string (must match compose) | Admin API key from Typesense Cloud |

**Important:** The API key must be the **Admin** key (capable of creating collections and indexing). The search‑only key will cause schema initialisation to fail.

**Sync resilience:** Failed Typesense operations (e.g., network timeout) are automatically queued in BullMQ for retry with exponential backoff – see [`src/config/typesense.ts`](../../src/config/typesense.ts).

---

## Quick Start: Minimal `.env` for Local Development (Manual)

```env
# Core
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# Database
MONGO_URI=mongodb://localhost:27017/reshma-boutique-dev

# Redis (no password)
REDIS_URL=redis://localhost:6379

# JWT (generate actual secrets)
JWT_ACCESS_SECRET=5f8d9a3c7e2b1f6a4d8c0e9b7a3f2d6c1e8b4a7f9d2c5b8e1a6f4c3d7e9b2a1
JWT_REFRESH_SECRET=7b2e1f6a4d8c0e9b7a3f2d6c1e8b4a7f9d2c5b8e1a6f4c3d7e9b2a1f5c8d2e

# Typesense (local binary or Docker)
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your_super_secret_key

# Cloudinary (required, but can be dummy for local testing)
CLOUDINARY_CLOUD_NAME=dummy
CLOUDINARY_API_KEY=dummy
CLOUDINARY_API_SECRET=dummy

# SMTP (optional – use ethereal.email for testing)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=dummy@ethereal.email
SMTP_PASS=dummy
EMAIL_FROM="Test <test@example.com>"

# Razorpay (required but can be dummy)
RAZORPAY_KEY_ID=rzp_test_dummy
RAZORPAY_KEY_SECRET=dummy
RAZORPAY_WEBHOOK_SECRET=dummy

# Shiprocket (required but can be dummy)
SHIPROCKET_EMAIL=dummy@example.com
SHIPROCKET_PASSWORD=dummy
SHIPROCKET_WEBHOOK_SECRET=dummy

# Google OAuth (required but can be dummy – login will not work)
GOOGLE_CLIENT_ID=dummy.apps.googleusercontent.com
```  

> Save this as `.env` in the project root. Replace JWT secrets with your own generated values.  

---  

## Docker Compose Overrides

When using Docker (see `docker-compose.yml`), the following environment variables are **automatically set** or **overridden** inside containers – you do not need to set them in `.env`:

- `MONGO_URI` → `mongodb://reshma-db:27017/reshmabangles`
- `REDIS_URL` → `redis://reshma-redis:6379`
- `TYPESENSE_HOST` → `reshma-typesense`

However, you **must** still define in `.env`:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `TYPESENSE_API_KEY` (must match the one in `docker-compose.yml`)

For production `docker-compose.prod.yml`, variables like `MONGO_INITDB_ROOT_USERNAME` and `REDIS_PASSWORD` are used – those are also read from `.env`.

## Troubleshooting Validation Errors

If the server fails to start with an error like:  

```text
Invalid environment variables: { "MONGO_URI": { "_errors": ["Required"] } }
```  
**Solution:** Add the missing variable to your `.env` file.  

Common errors and fixes

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `MONGO_URI: Required` | Missing `MONGO_URI` in `.env` | Add `MONGO_URI=mongodb://localhost:27017/reshma-boutique-dev` |
| `CLIENT_URL: Invalid url` | `CLIENT_URL` is not a valid URL | Use `http://localhost:3000` (no trailing slash) |
| `JWT_ACCESS_SECRET: At least 10 characters` | Secret too short | Generate a 32‑byte hex string: `openssl rand -hex 32` |
| `TYPESENSE_HOST: Required` | Typesense variables missing | Add all four `TYPESENSE_*` variables (see example) |
| `SMTP_USER: Invalid email` | SMTP user is not a valid email | Use a real email address or a dummy like `test@example.com` |

> **Note:** If you are **not using** a particular integration (e.g., Shiprocket), you can still provide dummy values that pass validation (non‑empty, correct format) – the code will log errors but will not crash.  

---  

## Security Best Practices

- **Never commit** `.env` – it is already listed in `.gitignore`. Use `.env.example` as a template.
- **Rotate secrets** – change `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` periodically in production.
- **Use different databases** – separate development and production MongoDB instances.
- **Limit API key scope** – the Typesense API key should be the **Admin** key for indexing, but use a Search‑only key in the frontend.
- **SMTP App Password** – never use your primary email password; generate an App Password for Gmail/Outlook.  

---  

## Code References

| File | Purpose |
|------|---------|
| `src/config/env.ts` | Validation schema for environment variables |
| `src/config/cloudinary.ts` | Cloudinary integration |
| `src/config/redis.ts` | Redis client |
| `src/config/typesense.ts` | Typesense manager |  

--- 

*The Reshma-Core Team*  