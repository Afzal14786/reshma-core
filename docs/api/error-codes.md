<div align="center">

  # Error Handling & Status Codes
  
  **Centralized, fail‑safe error handling – predictable JSON errors for every scenario.**

  [![AppError](https://img.shields.io/badge/AppError-Centralized-3448C5?style=flat)](#)
  [![Zod](https://img.shields.io/badge/Zod-Validation_Errors-3068b7?style=flat)](#)
  [![Mongoose](https://img.shields.io/badge/Mongoose-CastError_&_Duplicates-880000?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Standard Error Payload](#standard-error-payload)
- [HTTP Status Code Dictionary](#http-status-code-dictionary)
- [Validation Errors (Zod)](#validation-errors-zod)
- [Business Logic Errors (409 Conflict)](#business-logic-errors-409-conflict)
- [Authentication Errors (401/403)](#authentication-errors-401403)
- [Rate Limiting Errors (429)](#rate-limiting-errors-429)
- [Server Errors (500/503)](#server-errors-500503)
- [Frontend Handling Example (Axios)](#frontend-handling-example-axios)
- [Backend Developer Guide](#backend-developer-guide)

---

## Standard Error Payload

Every error response follows this exact JSON structure:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid or expired refresh token. Please log in again.",
  "data": null,
  "timestamp": "2026-05-22T14:30:00.000Z",
  "stack": "Error: ...at AuthService.refreshSession..."   // ONLY in development
}
```  
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `false` for errors |
| `statusCode` | `number` | HTTP status code (400, 401, 403, etc.) |
| `message` | `string` | Frontend‑friendly, human‑readable error description |
| `data` | `null` | Always `null` for errors |
| `timestamp` | `string` (ISO 8601) | Server time when error occurred |
| `stack` | `string` | Development only – never shown in production |

> **Frontend tip:** Use `response.data.success` to determine success/failure. The `message` is safe to display directly in toast notifications.  

---  

## HTTP Status Code Dictionary  

| Code | Name | Common Scenarios | Example message |
|------|------|------------------|-----------------|
| 400 | Bad Request | Zod validation fails, malformed JSON, invalid ObjectId | `"Validation Failed: email: Invalid email format"` |
| 401 | Unauthorized | Missing/expired/invalid access token | `"Invalid or expired token. Please login again."` |
| 403 | Forbidden | Insufficient role, email not verified, account banned | `"You do not have permission to perform this action"` |
| 404 | Not Found | Route not found, database document missing | `"Product not found"` |
| 409 | Conflict | Duplicate key (email, SKU), business rule violation | `"Email already registered. Please login instead."` |
| 429 | Too Many Requests | Rate limit exceeded (see Rate Limiting) | `"Too many requests from this IP, please try again after 15 minutes"` |
| 500 | Internal Server Error | Unhandled exception – report to backend team | `"Something went wrong on our side."` |
| 503 | Service Unavailable | Redis/MongoDB unreachable | `"Service temporarily unavailable. Please try again later."` |  

---  

## Validation Errors (Zod)  

When a request fails Zod validation (e.g., missing field, wrong type), the API returns `400` with a comma‑separated list of failures:  

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed: email: Invalid email format, password: Password must be at least 8 characters",
  "data": null,
  "timestamp": "2026-05-22T14:30:05.000Z"
}
```  

**Common validation errors per module:**  
| Module | Typical validation failures |
|--------|----------------------------|
| Auth | Invalid email, weak password, missing firstname |
| Products | Invalid `itemType`, missing polymorphic required fields |
| Address | Invalid pincode (not 6 digits), missing street |
| Orders | Negative quantity, invalid address ID |  

> The error message is safe to display directly. No need to parse further.  

---  

## Business Logic Errors (409 Conflict)  

These occur when a request violates a business rule or unique constraint.  

**Examples:**  

| Scenario | `message` |
|----------|-----------|
| Duplicate email on registration | `"Email already registered. Please login instead."` |
| Duplicate SKU on product creation | `"Product with this SKU already exists."` |
| Order already dispatched | `"This order has already been dispatched. Cannot modify."` |
| Review already submitted | `"You have already submitted a review for this product."` |  

> **Frontend action:** Show the message and guide the user (e.g., “Login instead” or “View your existing review”).  

---  

## Authentication Errors (401/403)  

| Status | Scenario | Frontend Action |
|--------|----------|-----------------|
| 401 | Access token missing or expired | Attempt silent refresh; if fails, redirect to login |
| 401 | Refresh token blacklisted or expired | Redirect to login (session permanently dead) |
| 403 | Email not verified | Show verification prompt, resend OTP |
| 403 | Account banned (`isActive: false`) | Show support contact message |
| 403 | User trying admin endpoint | Redirect to customer dashboard or show “Access denied” |

> See [**Authentication Guide**](./authentication.md) for token refresh logic.  

---  

## Rate Limiting Errors (429)  

When a rate limit is exceeded, the API returns `429` with a `Retry-After` header (seconds to wait).  

**Response example:**  

```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many authentication attempts. Your IP has been temporarily blocked.",
  "data": null,
  "timestamp": "2026-05-22T14:30:00.000Z"
}
```  

**Headers:**  

```text
Retry-After: 900
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 1748592000
```  

**Frontend action:** Wait for `Retry-After` seconds before retrying. Do **not** retry immediately.  
See [**Rate Limiting Guide**](./rate-limiting.md) for full details.  

---  

## Server Errors (500/503)  

| Status | Meaning | What to do |
|--------|---------|-------------|
| 500 | Unhandled exception in backend | Report to backend team with timestamp and request details. Retry later. |
| 503 | Downstream service (Redis, MongoDB) unreachable | Wait and retry with backoff. If persists, inform support. |  

> In development, the `stack` field is included – **never expose this in production**. The global error handler strips it when `NODE_ENV=production`.  

---  

## Frontend Handling Example (Axios)  

Here is a complete interceptor that handles all error types gracefully.  

```javascript
import axios from 'axios';

const api = axios.create({ baseURL: process.env.API_URL });

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const originalRequest = config;

    // 1. Handle 401 (expired access token)
    if (response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`);
        // Store new access token (in memory)
        setAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed – redirect to login
        clearAccessToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // 2. Handle 429 (rate limit) – wait and retry
    if (response?.status === 429) {
      const retryAfter = response.headers['retry-after'] || 15;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return api(originalRequest);
    }

    // 3. All other errors – show message to user
    if (response?.data?.message) {
      // Display in toast notification
      showToast(response.data.message, 'error');
    }

    return Promise.reject(error);
  }
);

export default api; 
```

---  

## Backend Developer Guide  

If you are contributing to the backend, **never use** `res.status(400).send(...)`. Always throw an `AppError`.   

### Importing  

```typescript
import { AppError } from '@shared/utils/app-error';
import { HTTP_STATUS } from '@shared/constant/http-codes';
```  

### Usage in Services / Controllers  

```typescript
// Example: Checking if a user exists
const user = await User.findById(userId);
if (!user) {
  throw new AppError(HTTP_STATUS.NOT_FOUND, 'User not found');
}

if (!user.isActive) {
  throw new AppError(HTTP_STATUS.FORBIDDEN, 'This account has been deactivated.');
}

// Example: Business rule violation
if (cart.items.length === 0) {
  throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Cannot checkout with an empty cart');
}
``` 

### Automatic Conversions (Global Error Handler)  

The global error handler (`@shared/middlewares/error.middleware.ts`) automatically converts:  

| Raw Error | Converted Status | Message |
|-----------|------------------|---------|
| Mongoose CastError (invalid ObjectId) | 400 | `"Invalid ID format"` |
| Mongoose duplicate key error (code 11000) | 409 | `"Duplicate field value: {field}"` |
| `JsonWebTokenError` | 401 | `"Invalid token"` |
| `TokenExpiredError` | 401 | `"Token expired"` |  

> You do not need to catch these manually – they are handled centrally.  

---  

## Related Documentation

- [Authentication Guide](./authentication.md) – 401/403 details and refresh flow.
- [Rate Limiting Guide](./rate-limiting.md) – 429 headers and backoff strategies.
- [API README](./README.md) – standard response shapes.  

--- 

<div align="center">

Predictable errors, happy frontend developers – the Reshma‑Core error handling philosophy.
</div>  
