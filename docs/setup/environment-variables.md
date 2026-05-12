# Environment Variables Configuration Guide

## Overview
The Reshma-Core backend utilizes a strict fail-fast initialization strategy. All environment variables are validated at runtime using a Zod schema located in `src/config/env.ts`. If any required variable is missing, empty, or incorrectly formatted, the Node.js process will terminate immediately with a validation error. This ensures that the system never runs in an insecure or partially configured state.

---

## 1. Core Server Settings
These variables define the basic runtime environment and connectivity for the Express application.

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | The network port the server listens on. | `5000` |
| `NODE_ENV` | Defines the environment (development, production, or test). | `development` |
| `CLIENT_URL` | The origin URL of the React/Next.js frontend. | `http://localhost:3000` |
| `ADMIN_URL` | The origin URL of the Admin Dashboard. | `http://localhost:3001` |


* **Server Lifecycle Management:** The application now traps `SIGTERM` and `SIGINT` signals. Upon receiving a termination signal, the server halts new HTTP traffic, drains active requests, and safely disconnects from MongoDB and Redis to prevent database corruption during deployments or scaling events.
---

## 2. Database & Infrastructure
Reshma-Core relies on MongoDB for persistent data and Redis for ephemeral caching and background job management.

- **MONGO_URI**: The full connection string for MongoDB. For local development, this is typically `mongodb://localhost:27017/db_name`. For production, use the srv string provided by MongoDB Atlas.
- **REDIS_URL**: The connection endpoint for the Redis instance. Format: `redis://<host>:<port>`. This is critical for BullMQ workers.
- **REDIS_PASSWORD**: Required for password-protected Redis instances (common in production/managed clouds).
- **Redis Infrastructure(`REDIS_URL`)**: In addition to caching and standard BullMQ workers, Redis now hosts the `search-sync-queue`. This queue is critical for the `Eventual Consistency Protocol`, ensuring that any failed Typesense synchronizations are retried with exponential backoff rather than resulting in "Ghost Products".  
- **Distributed Locking**: The Redis instance now manages distributed locks (using `SET NX`) for maintenance cron jobs. This prevents multiple server instances in a Docker/Cloud environment from executing duplicate inventory recovery tasks simultaneously.

---

## 3. Two-Token Authentication Architecture
The system implements a secure JWT-based session management strategy using short-lived Access Tokens and long-lived Refresh Tokens.

### Access Token
Used for authenticating standard API requests via the `Authorization: Bearer <token>` header.
- **JWT_ACCESS_SECRET**: A high-entropy 64-character hex string.
- **JWT_ACCESS_EXPIRES_IN**: Recommended value is `15m` (15 minutes).

### Refresh Token
Stored strictly in an `HttpOnly` cookie to prevent XSS-based session hijacking.
- **JWT_REFRESH_SECRET**: A separate high-entropy 64-character hex string.
- **JWT_REFRESH_EXPIRES_IN**: Recommended value is `7d` (7 days).

---

## 4. Social Authentication (Google OAuth)
Required for the hybrid OAuth flow where users can sign in using their Google account.

- **GOOGLE_CLIENT_ID**: The public identifier for your application found in the Google Cloud Console.
- **GOOGLE_CLIENT_SECRET**: The private secret used to verify the OAuth handshake.
- **GOOGLE_CALLBACK_URL**: The backend route where Google redirects users after a successful login (e.g., `/api/v1/auth/google/callback`).

---

## 5. Media Pipeline (Cloudinary)
Used for on-the-fly image optimization and secure hosting of product images and DAM (Digital Asset Management).

- **CLOUDINARY_CLOUD_NAME**: The unique identifier for your Cloudinary account.
- **CLOUDINARY_API_KEY**: The public key for API access.
- **CLOUDINARY_API_SECRET**: The private secret for signed uploads and management tasks.

---

## 6. Notification Engine (SMTP)
Handles the dispatch of transactional emails such as OTPs, Welcome emails, and Order updates via BullMQ.

- **SMTP_HOST**: The hostname of the mail server (e.g., `smtp.gmail.com`).
- **SMTP_PORT**: Usually `587` for TLS or `465` for SSL.
- **SMTP_USER**: The email address used for sending.
- **SMTP_PASS**: For Gmail, this must be a 16-character **App Password**, not your primary account password.
- **EMAIL_FROM**: The display name and email address that appear in the recipient's inbox.

---

## 7. Payment Gateway (Razorpay)
Integrated for processing secure payments and handling automated refund logic.

- **RAZORPAY_KEY_ID**: The public key used by the frontend to initialize the checkout widget.
- **RAZORPAY_KEY_SECRET**: The private key used by the backend to verify signatures and process refunds.

## 8. Search Engine (Typesense)
Powers the sub-50ms product discovery, faceted filtering, and typo tolerance. Can be run locally via binary/Docker or remotely via Typesense Cloud.
- **TYPESENSE_HOST**: The IP or Cloud URL (e.g., `127.0.0.1` or `xxx-1.a1.typesense.net`).
- **TYPESENSE_PORT**: Usually `8108` for local, or `443` for Cloud.
- **TYPESENSE_PROTOCOL**: `http` for local, `https` for Cloud.
- **TYPESENSE_API_KEY**: The **ADMIN** API Key required to build schemas and synchronize data. Do NOT use the Search-Only key here.
- **Sync Resilience**: he system no longer fails silently on search engine network timeouts. Failed operations are automatically offloaded to the `search-sync-queue` for background retry, ensuring the search cluster remains a perfect reflection of the MongoDB master record.

---

## Security Best Practices
1. **Source Control**: Never commit the actual `.env` file to GitHub. Ensure it is explicitly listed in `.gitignore`.
2. **Rotation**: Secrets such as `JWT_ACCESS_SECRET` should be rotated periodically in production environments.
3. **Environment Specifics**: Always use distinct databases and Cloudinary buckets for development and production to avoid data contamination.

---
**Standard Documentation | Built by Md Afzal Ansari**