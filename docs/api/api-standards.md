# API Design & Integration Standards

## 1. Overview
The Reshma-Core API follows strict RESTful conventions, utilizes a Two-Token stateless authentication architecture, and guarantees a predictable JSON response structure for every single endpoint.

**Base URL:** `http://localhost:5000/api/v1` (Development)
**Content-Type:** `application/json`

--- 

## 2. Standardized Response Payload
To eliminate guesswork for the frontend team, every successful and failed request routes through our `ApiResponse` or `AppError` classes. You will *always* receive this exact JSON shape:

### Success Response (2xx)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable success message",
  "data": {
    // The requested resource(s) will always be nested inside 'data'
    "user": { ... },
    "accessToken": "..." 
  },
  "timestamp": "2026-04-22T14:30:00.000Z"
}
```  

### Error Response (4xx, 5xx)  
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed: firstname is required, email is Invalid format",
  "stack": "..." // ONLY included if NODE_ENV=development
}
```
**Frontend Implementation Tip:**  
You do not need to manually check HTTP status codes if you don't want to. You can safely write your frontend Axios/Fetch interceptors to simply check `if (!response.data.success) { throw new Error(...) }`.  

---  

## 3. The Two-Token Authentication Flow  

Reshma-Core uses an enterprise-grade stateless JWT architecture designed to completely prevent XSS and CSRF attacks.  

**The Tokens**  
1. **Access Token (The VIP Pass):** Short-lived (15 mins). Returned in the JSON response payload. **Must be stored in React Memory (Zustand/Context/Closure)**. Never store this in `localStorage`.  

2. **Refresh Token (The Vault Key):** Long-lived (7 days). Automatically attached to the browser as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. It is invisible to JavaScript.  

**The Flow**  

1. **Login/Verify:** Send credentials. Receive accessToken in JSON. The browser automatically saves the refreshToken cookie.  

2. **Protected Requests:** Attach the Access Token to the Authorization header: 
    ```http
    Authorization: Bearer <YOUR_ACCESS_TOKEN>
    ```  

3. **Silent Refresh:** When the Access Token expires (HTTP 401), the frontend must silently call **GET /api/v1/auth/refresh**. The browser will automatically attach the HttpOnly cookie, and the server will return a fresh `accessToken`.  

4. **Logout:** Call `GET /api/v1/auth/logout` with the Access Token. The server will blacklist the token in Redis and command the browser to destroy the HttpOnly cookie.  

--- 

## 4. HTTP Status Code Dictionary  

The API strictly adheres to the following HTTP status codes mapping (`@shared/constant/http-codes.ts`):  

**Success Codes**  
* `200 OK:` Standard success (Login, fetching data, updating data).
* `201 Created:` Resource created successfully (Registration, creating a product).
* `204 No Content:` Resource deleted successfully (Response body will be empty).  

**Client Error Codes**  

* `400 Bad Request:` Validation failure (Zod caught a bad payload).
* `401 Unauthorized:` Authentication failure (Missing token, expired token, or invalid credentials).  
* `403 Forbidden:` Authorization failure (Valid token, but user lacks ADMIN role or account is deactivated).
* `404 Not Found:` The requested endpoint or database resource does not exist.
* `409 Conflict:` Database collision (e.g., trying to register with an email that is already verified).
* `429 Too Many Requests:` Rate limit exceeded.  

**Server Error Codes**  
* `500 Internal Server Error:` Unhandled exception.
* `503 Service Unavailable:` Redis or Database connection failure.  

---  

## 5. Request Validation (Zod)  

Every incoming request (`body`, `query`, and `params`) is intercepted by strict Zod schemas.  

* Extraneous fields sent in the JSON body will be silently stripped out to prevent NoSQL injection.  
* If required fields are missing or malformed, the API will fail-fast and return a 400 Bad `Request` with a comma-separated list of exactly which fields failed.  

--- 

## 6. Rate Limiting & Security Limits  

To protect against brute-force and DDoS attacks, the following limits are enforced globally:  

* `Global API Limit:` 100 requests per 15 minutes per IP.
* `Authentication Limit:` 10 attempts per 15 minutes per IP on all /auth/* routes.  
* `Payload Limit:` Maximum JSON body size is restricted to 10kb.  

