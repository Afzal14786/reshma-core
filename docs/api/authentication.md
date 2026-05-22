<div align="center">

  # Authentication Guide
  
  **The two‑token JWT architecture – secure, stateless, and frontend‑friendly.**

  [![JWT](https://img.shields.io/badge/JWT-Access_&_Refresh-000000?style=flat&logo=jsonwebtokens&logoColor=white)](#)
  [![Cookies](https://img.shields.io/badge/Cookies-HttpOnly_Secure-FF6B6B?style=flat)](#)
  [![Redis](https://img.shields.io/badge/Redis-Blacklist-DC382D?style=flat&logo=redis&logoColor=white)](#)

</div>

---

## 📖 Table of Contents

- [Token Overview](#token-overview)
- [Authentication Flow Diagram](#authentication-flow-diagram)
- [Step‑by‑Step Guide](#step‑by‑step-guide)
  - [1. Registration](#1-registration)
  - [2. OTP Verification (First Login)](#2-otp-verification-first-login)
  - [3. Standard Login](#3-standard-login)
  - [4. Using the Access Token](#4-using-the-access-token)
  - [5. Refreshing an Expired Token](#5-refreshing-an-expired-token)
  - [6. Logout](#6-logout)
- [Password Reset Flow](#password-reset-flow)
- [Google OAuth Login](#google-oauth-login)
- [Error Responses](#error-responses)
- [Frontend Integration Example (Axios)](#frontend-integration-example-axios)

---

## Token Overview

Reshma‑Core uses a **two‑token JWT architecture** that is both stateless and secure against XSS and CSRF attacks.

| Token | Storage | Lifetime | Purpose | Where to keep |
|-------|---------|----------|---------|----------------|
| **Access Token** | React memory (Zustand/Context) | 15 minutes (`JWT_ACCESS_EXPIRES_IN`) | Authorise API requests via `Authorization: Bearer` header | In‑memory (never `localStorage`) |
| **Refresh Token** | HttpOnly cookie | 7 days (`JWT_REFRESH_EXPIRES_IN`) | Obtain new access tokens without re‑login | Automatically managed by browser |

**Why this design?**
- Access token short lifespan limits damage if leaked.
- Refresh token in `HttpOnly` cookie is invisible to JavaScript → XSS cannot steal it.
- `SameSite=Strict` prevents CSRF on the refresh endpoint.
- Redis blacklist ensures logout cannot be replayed.

---

## Authentication Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Browser

    Note over Client,Browser: 1. Registration & OTP Verification
    Client->>API: POST /auth/register
    API-->>Client: OTP sent to email
    Client->>API: POST /auth/verify-otp (email + otp)
    API-->>Browser: Set-Cookie: refreshToken (HttpOnly, Secure, SameSite=Strict)
    API-->>Client: accessToken (JSON)

    Note over Client,Browser: 2. Subsequent API calls
    Client->>API: GET /users/profile (Header: Bearer accessToken)
    API-->>Client: 200 OK

    Note over Client,Browser: 3. Access token expired (401)
    Client->>API: GET /users/profile (expired token)
    API-->>Client: 401 Unauthorized
    Client->>API: POST /auth/refresh (cookie auto-attached)
    API-->>Client: new accessToken (JSON)
    Client->>API: Retry original request with new token

    Note over Client,Browser: 4. Logout
    Client->>API: GET /auth/logout (Bearer valid accessToken)
    API-->>Browser: Clear-Cookie: refreshToken
    API-->>Client: 200 OK
```  

## Step‑by‑Step Guide  

### 1. Registration

- **Endpoint:** `POST /auth/register`
- **Rate limit:** 10 requests per 15 minutes per IP

**Request body:**  

```json
{
  "firstname": "Test",
  "lastname": "User",
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```  
**Validation rules (Zod):**  
- `firstname`: string, 2‑50 characters
- `lastname`: string, 2‑50 characters
- `email`: valid email format
- `password`: min 8 chars, at least one uppercase, one number, one special character  

**Response (201 Created):**  
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. OTP sent to your email.",
  "data": {
    "user": {
      "_id": "...",
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

> **Note:** The user is created with `isEmailVerified: false`. They cannot log in until OTP is verified.  

---  

### 2. OTP Verification (First Login)  

- **Endpoint:** `POST /auth/verify-otp`
- **Rate limit:** 10 requests per 15 minutes per IP  

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
      "_id": "...",
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

> **Important:** The refresh token cookie is **only** set during OTP verification and login. It is not returned in JSON.  

---  

### 3. Standard Login  

- **Endpoint:** `POST /auth/login`
- **Rate limit:** 10 requests per 15 minutes per IP   

**Request body:**  

```json
{
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```  

**Response:** Exactly the same as `/verify-otp` – returns `accessToken` and sets the `refreshToken` cookie.  

---  

### 4. Using the Access Token  

For every protected API request, include the access token in the `Authorization` header:  

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```  

**Example (JavaScript fetch):**  
```javascript
fetch('http://localhost:5000/api/v1/users/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```  

> **Never store the access token in `localStorage` or `sessionStorage`** – they are vulnerable to XSS. Keep it in memory (React state, Zustand, Redux).  

---  

### 5. Refreshing an Expired Token  

When an API request returns `401 Unauthorized` (and you know the token was valid before), call the refresh endpoint.  

- **Endpoint:** `POST /auth/refresh`
- **No body, no auth header** – the browser automatically attaches the `refreshToken` cookie.  

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

- If the refresh token cookie is missing, expired, or blacklisted → user must login again.

**Implementation pattern (axios interceptor):** see Frontend Integration Example.  

---  

### 6. Logout  

- **Endpoint:** `POST /auth/refresh`
- **Headers:** `Authorization: Bearer <valid_access_token>`  

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

- The refresh token cookie is immediately expired (overwritten).
- The refresh token is added to a Redis blacklist – cannot be reused even if stolen.
- The access token is not blacklisted (short lifespan anyway).

**After logout:**  The frontend should clear the in‑memory access token and redirect to login.  

---  

## Password Reset Flow  

Users who forget their password can reset it without being logged in.  

### Step 1: Request Reset Token  

**Endpoint:** `POST /auth/forgot-password`  

```json
{
  "email": "test@example.com"
}
```  

**Response (200 OK):** A reset token is sent to the email (the API does not return it).  

### Step 2: Reset Password  

**Endpoint:** `POST /auth/reset-password`  

```json
{
  "email": "test@example.com",
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword456!"
}
```  

**Response (200 OK):** Password updated. User can now login with the new password.  

> Both endpoints are rate‑limited (10 requests per 15 minutes per IP).  

---  

## Google OAuth Login  

**Endpoint:** `POST /auth/google`

This endpoint accepts a Google `idToken` (obtained from the frontend Google Sign-In library) and either logs in an existing user or creates a new one.  

**Request body:**  
```json
{
  "idToken": "google-oauth-id-token-string"
}
```  

**Response:**  Same as `/login` – returns `accessToken` and sets `refreshToken` cookie.   

> Google OAuth users do not have a password. They cannot use the password reset or change password endpoints.  

---  

## Error Responses  

| HTTP Code | message example | When it happens | Frontend action |
|-----------|----------------|----------------|-----------------|
| 400 | `Validation Failed: email: Invalid email format` | Zod validation fails | Display the message; fix input |
| 401 | `Invalid or expired token. Please login again.` | Access token missing/malformed/expired (refresh also failed) | Redirect to login |
| 403 | `Please verify your email address before logging in.` | User tries to login without OTP verification | Show verification UI |
| 403 | `This account has been deactivated.` | Admin banned the user (`isActive: false`) | Show support contact |
| 409 | `Email already registered. Please login instead.` | Duplicate email on registration | Suggest login or password reset |
| 429 | `Too many requests, please try again later.` | Rate limit exceeded | Wait 15 minutes or implement backoff |  

---  

## Frontend Integration Example (Axios)  

Here is a complete interceptor that handles token refresh automatically.  

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Store access token in memory (Zustand / React context)
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

// Request interceptor: add Authorization header
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`);
        setAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed – logout user
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```  

**Usage in React component:**  

```javascript
import api, { setAccessToken } from './api';

// After login / OTP verification
setAccessToken(response.data.accessToken);

// Now all api calls will include the token automatically
const { data } = await api.get('/users/profile');
```  

---  

## Security Best Practices (Frontend)  

| Do | Don't |
|----|-------|
| Store access token in memory (React state, Zustand, Redux) | ❌ Store access token in `localStorage` or `sessionStorage` |
| Use axios interceptors to handle refresh automatically | ❌ Manually refresh on every 401 without retry logic |
| Clear access token on logout and redirect to login | ❌ Keep token after logout |
| Use HTTPS in production (cookies require Secure flag) | ❌ Test without HTTPS – cookies may be rejected |  

---  

## Related Documentation

- [Error Handling Guide](./error-codes.md) – detailed status codes.
- [Rate Limiting](./rate-limiting.md) – auth endpoint limits.
- [Auth Runbook](./thunder-tests/auth-runbook.md) – manual test sequence (internal).  

---  

<div align="center">

Stateless, secure, and production‑proven – the Reshma‑Core authentication system.
</div>