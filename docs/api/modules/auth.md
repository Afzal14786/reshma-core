<div align="center">

  # Auth Module
  
  **User registration, login, OTP verification, token refresh, and logout – the complete authentication gateway.**

  [![JWT](https://img.shields.io/badge/JWT-Two_Token-000000?style=flat&logo=jsonwebtokens&logoColor=white)](#)
  [![OTP](https://img.shields.io/badge/OTP-Email_Delivery-FF6B6B?style=flat)](#)
  [![Google](https://img.shields.io/badge/Google-OAuth_2.0-4285F4?style=flat&logo=google&logoColor=white)](#)
  [![Rate Limit](https://img.shields.io/badge/Rate_Limit-10/hour-FF6B6B?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [POST /register](#post-register)
  - [POST /verify-otp](#post-verify-otp)
  - [POST /login](#post-login)
  - [POST /google](#post-google)
  - [POST /forgot-password](#post-forgot-password)
  - [POST /reset-password](#post-reset-password)
  - [GET /refresh](#get-refresh)
  - [GET /logout](#get-logout)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/auth`    

All endpoints are public (no authentication required) **except** `/logout`, which requires a valid access token.

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/register` | Public | Register a new user (sends OTP email) |
| `POST` | `/verify-otp` | Public | Verify OTP, activate account, issue tokens |
| `POST` | `/login` | Public | Login with email + password |
| `POST` | `/google` | Public | Google OAuth login (idToken) |
| `POST` | `/forgot-password` | Public | Request password reset email |
| `POST` | `/reset-password` | Public | Reset password using token |
| `GET` | `/refresh` | Public (cookie) | Obtain new access token using refresh token cookie |
| `GET` | `/logout` | Private (Bearer) | Logout, blacklist refresh token, clear cookie |

> **Rate limits:** All endpoints except `/logout` are protected by `authLimiter` (10 requests per hour per IP). See [Rate Limiting](../rate-limiting.md).

---

## Endpoint Details

### `POST /register`

Create a new user account. An OTP is sent to the provided email address. The user must verify the OTP before logging in.

**Request body:**

```json
{
  "firstname": "Test",
  "lastname": "User",
  "email": "test@example.com",
  "password": "SecurePassword123!",
  "acceptPrivacyPolicy": true
}
```  

**Response (201 Created):**  

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. OTP sent to your email.",
  "data": {
    "user": {
      "_id": "64a7b...",
      "email": "test@example.com",
      "firstname": "Test",
      "lastname": "User",
      "role": "USER",
      "isEmailVerified": false
    }
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

**Validation rules:** See Validation Rules below.  

> **Note:** The password is hashed with bcrypt (12 rounds) before storage. The plaintext password is never logged.  

### `POST /verify-otp`  

Verify the OTP sent during registration. Activates the account and issues access + refresh tokens.  

**Request body:**  

```json
{
  "email": "test@example.com",
  "otp": "123456"
}
```  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "_id": "64a7b...",
      "email": "test@example.com",
      "firstname": "Test",
      "lastname": "User",
      "role": "USER",
      "isEmailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-05-22T10:32:00.000Z"
}
```  

**Cookie automatically set (invisible to JavaScript):**  

```text
refreshToken: <jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```  

> The OTP is stored in Redis with a 10‑minute TTL. After verification, it is immediately deleted (prevents replay attacks).  

### `POST /login`  

Authenticate an existing user with email and password. Issues access + refresh tokens.  

**Request body:**  

```json
{
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```  

**Response:** Same as `/verify-otp` (200 OK with `accessToken` and cookie).  

**Error cases:**  

- **Account not verified** → `403 Forbidden` with `"Please verify your email address before logging in."`
- **Account banned (`isActive: false`)** → `403 Forbidden` with account deactivated message (e.g., `"This account has been deactivated."`)
- **Invalid credentials** → `401 Unauthorized` with `"Invalid email or password"`    

### `POST /google`  

Authenticate using Google OAuth 2.0. Accepts a Google `idToken` obtained from the frontend Google Sign-In library. If the email does not exist, a new user is created (with `authProvider: "GOOGLE"` and no password). If it exists, the user is logged in.  

**Request body:**  

```json
{
  "idToken": "google-oauth-id-token-string"
}
```  

**Response:** Same as `/login` (200 OK with `accessToken` and cookie).  

> Google OAuth users **cannot** use password‑based endpoints (login, forgot/reset password). Attempting to call those endpoints will return `400 Bad Request`.  

---  

### `POST /forgot-password`  

Request a password reset token. The token is sent to the user's email (the API does not return it). Only works for local (`authProvider: "LOCAL"`) users.  

**Request body:**  

```json
{
  "email": "test@example.com"
}
```  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "If an account with that email exists, a password reset link has been sent.",
  "data": null
}
```  

> For security, the response is the same even if the email does not exist (prevents email enumeration).  

---  

### `POST /reset-password`  

Reset the password using the token received via email.  

**Request body:**  

```json
{
  "email": "test@example.com",
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword456!"
}
```  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successfully. You can now log in with your new password.",
  "data": null
}
```  

> The token is invalidated after use (stored in Redis with TTL). Expired tokens return `400 Bad Request`.  


### `GET /refresh`  

Obtain a new access token using the refresh token stored in the `HttpOnly` cookie. **No Authorization header required**.  

**Request:** No body, no headers (cookie is automatically sent).  
**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Access token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-05-22T10:45:00.000Z"
}
```  

**Error (401 Unauthorized):**  

- Missing or invalid refresh token cookie.
- Refresh token expired (7 days).
- Refresh token blacklisted (after logout).

> **Frontend implementation:** Automatically call this endpoint when you receive a 401 on a protected request. See [**Authentication Guide**](./auth.md).  

---  

### `GET /logout`  

Logout the current user. Requires a valid access token in the `Authorization` header.  

**Headers:** `Authorization: Bearer <access_token>`  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null,
  "timestamp": "2026-05-22T10:50:00.000Z"
}
```  

**What happens server‑side:**  

- The refresh token cookie is cleared (overwritten with expired value).
- The refresh token is added to a Redis blacklist (prevents reuse). 
- The access token is not blacklisted (short lifespan anyway).

**Error (401 Unauthorized):** If the access token is missing or invalid.  

---  

## Validation Rules (Zod)  

| Endpoint | Field | Rules |
|----------|-------|-------|
| `/register` | `firstname` | string, 2‑50 chars, required |
| | `lastname` | string, 2‑50 chars, required |
| | `email` | valid email format, required |
| | `password` | min 8 chars, at least one uppercase, one number, one special character, required |
| `/verify-otp` | `email` | valid email format, required |
| | `otp` | string, exactly 6 digits, required |
| `/login` | `email` | valid email format, required |
| | `password` | string, min 1 char (actual validation is done by bcrypt compare), required |
| `/google` | `idToken` | string, non‑empty, required |
| `/forgot-password` | `email` | valid email format, required |
| `/reset-password` | `email` | valid email format, required |
| | `token` | string, non‑empty, required |
| | `newPassword` | same as password rule above, required |  

> All schemas use `.strict()` – extra fields are rejected with `400 Bad Request`.   

---  

## Error Responses   

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `VALIDATION_FAILED` | `"Validation Failed: email: Invalid email format"` | Zod validation fails |
| 401 | `UNAUTHORIZED` | `"Invalid email or password"` | Wrong credentials |
| 401 | `UNAUTHORIZED` | `"Invalid or expired refresh token"` | Refresh endpoint fails |
| 403 | `FORBIDDEN` | `"Please verify your email address before logging in."` | Login before OTP verification |
| 403 | `FORBIDDEN` | `"This account has been deactivated."` | User banned (`isActive: false`) |
| 409 | `CONFLICT` | `"Email already registered. Please login instead."` | Duplicate email on register |
| 429 | `TOO_MANY_REQUESTS` | `"Too many authentication attempts..."` | Rate limit exceeded (10/hour) |  

> See [**Error Handling Guide**](../error-codes.md) for full details.    

---  

## Runbook  

For manual testing with Thunder Client / Postman, see `../../testing/auth-runbook.md`. The runbook covers:  

- Registration → OTP verification → token issuance
- Login → refresh → logout
- Edge cases (invalid OTP, expired token, blacklist check)  

---  

### Related Documentation  

- [Authentication Guide](../authentication.md) – two‑token flow, refresh logic, frontend interceptor.
- [Rate Limiting Guide](../rate-limiting.md) – auth limiter details.
- [Error Handling Guide](../error-codes.md) – 401/403/409 handling.  

---  

<div align="center">

Secure, stateless, and production‑proven – the Reshma‑Core authentication system.
</div>  

