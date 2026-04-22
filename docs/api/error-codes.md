# API Error Codes & Handling Guide

## 1. Overview
The Reshma-Core API utilizes a centralized, fail-safe error handling architecture. No matter where an error occurs—whether it is a Zod validation failure, a MongoDB duplicate key conflict, or an expired JWT—the frontend will **always** receive a predictable JSON payload.

---

## 2. Standardized Error Payload
When an API request fails, it will return an HTTP status code in the `4xx` or `5xx` range, accompanied by this exact JSON structure:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid or expired refresh token. Please log in again.",
  "stack": "Error: ...at AuthService.refreshSession..." // ONLY VISIBLE IN NODE_ENV=development
}
```  

**Frontend Implementation Notes:**  

* `success`: Will always be `false` for errors. You can use this boolean for simple `if/else` checks in Axios interceptors.
* `message`: This string is heavily sanitized by the backend to be entirely "Frontend-Friendly." You can safely inject `response.data.message` directly into your React toast notifications or UI error alerts without parsing it further.
* `stack`: This is strictly stripped out in production environments to prevent sensitive internal directory paths from leaking to the public.  

--- 

## 3. Standard HTTP Status Code Dictionary  
The API strictly adheres to RESTful standard status codes. Below is the dictionary of error codes you will encounter and what they mean in the context of Reshma-Core.  

**Client Errors (4xx) - The frontend did something wrong** 
* `400 Bad Request`
    * **Cause:** The request payload failed Zod schema validation, or the JSON was malformed.
    * **Example:** Sending a string instead of an integer, or omitting a required email field.
    * **Message Format:** Comma-separated list of failures (e.g., `"Validation Failed: firstname: First name is required, email: Invalid format"`).  

* `401 Unauthorized`
    * **Cause:** Authentication failure. The user is entirely anonymous to the system.  
    * **Scenarios:** `Missing Authorization`: Bearer token.
        * The Access Token has expired mathematically.
        * The Refresh Token cookie is stale, invalid, or was blacklisted during logout.  

* `403 Forbidden`
    * **Cause:** The user is logged in (mathematically verified token), but they lack the infrastructure permissions to perform the action.
    * **Scenarios:**
        * A standard `USER` trying to hit an `/admin` endpoint.
        * The user's account has `isActive: false` (Banned by an administrator).
        * The user's account has `isEmailVerified: false` and they are trying to access a protected commerce route.

* `404 Not Found`
    * **Cause:** The requested resource does not exist.
    * **Scenarios:**
        * Hitting an API endpoint that isn't mapped (e.g., `/api/v1/auth/fake-route`).
        * Requesting a database document that doesn't exist (e.g., `/products/123` where `123` is not a valid ObjectId).  

* `409 Conflict`
    * **Cause:** Database unique constraint violation.
    * **Example:** Trying to register an account with an email that is already actively verified in the database. 

* `429 Too Many Requests`
    * **Cause:** The IP address has exceeded the rate limiter threshold.
    * **Default Limit:** 100 requests per 15 minutes globally, 10 requests per 15 minutes for Auth routes.  

**Server Errors (5xx) - The backend did something wrong**  
* `500 Internal Server Error`
    * **Cause:** An unhandled exception, syntax error, or completely unexpected failure occurred on the Node.js server.
    * *Note: If a 500 occurs, it triggers an immediate Winston Logger alert for backend maintainers.*

* `503 Service Unavailable`
    * **Cause:** The Node.js server is running, but a critical downstream service is dead.
    * **Scenarios:** Redis has disconnected, MongoDB is unreachable, or the SMTP server refused connection. 

--- 

## 4. Backend Developer Guide: Throwing Errors  
If you are contributing to the backend, you must never use `res.status(400).send(...)`.  

All errors must be thrown using the `AppError` utility class. The Global Error Handler (`@shared/middlewares/error.middleware.ts`) will catch it, format it, and dispatch it securely.  

**Importing**  
```typescript
import { AppError } from '@shared/utils/app-error';
import { HTTP_STATUS } from '@shared/constant/http-codes';
```  

**Usage in Services/Controllers**  
If a business rule fails, throw the error directly. The `catchAsync` or `try/catch` block will automatically forward it to the `NextFunction`.  

```typescript
// Example: Checking if a user exists
const user = await User.findById(userId);

if (!user) {
    // Correct way to throw an error
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'The requested user could not be found.');
}

if (!user.isActive) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'This account has been deactivated.');
}
```  

**Architectural Failsafes**  
*   **Mongoose Duplicate Keys** (`11000`): Automatically intercepted by the global error handler and converted from a 500 crash into a safe `409 Conflict`.
*   **Mongoose CastErrors:** Automatically intercepted and converted to a `400 Bad Request` (e.g., passing `"abc"` to an endpoint expecting a 24-character hex `ObjectId`).
*   **JWT Errors:** `JsonWebTokenError` and `TokenExpiredError` are automatically caught and formatted as safe `401 Unauthorized` errors.  

