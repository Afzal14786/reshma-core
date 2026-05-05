<div align="center">

  # REST API Reference & Integration Standards
  **Reshma Bangles & Boutique Core Engine**

  [![API Version](https://img.shields.io/badge/API_Version-v1.0-3448C5?style=flat&logo=server&logoColor=white)]()
  [![Format](https://img.shields.io/badge/Format-JSON-000000?style=flat&logo=json&logoColor=white)]()
  [![Auth](https://img.shields.io/badge/Auth-Two--Token_JWT-DC382D?style=flat)]()

</div>

---

## 1. Environments & Base URLs
The Reshma-Core API follows strict RESTful conventions. All API endpoints belong to the `v1` namespace. Ensure you are pointing to the correct environment.

| Environment | Base URL | Usage |
| :--- | :--- | :--- |
| **Development** | `http://localhost:5000/api/v1` | Local testing and frontend integration. |
| **Production** | `https://api.reshmabangles.com/api/v1` | Live customer traffic. |

--- 

## 2. Standardized Response Payload
To eliminate guesswork for the frontend team, every successful and failed request routes through our custom `ApiResponse` or `AppError` wrapper classes. You will *always* receive this exact JSON shape.

### Success Response (2xx)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Catalog retrieved successfully",
  "data": {
    "products": [ ... ],
    "meta": {
      "total": 500,
      "page": 1
    }
  },
  "timestamp": "2026-04-24T14:30:00.000Z"
}
```  

### Error Response (4xx, 5xx)  
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Failed: itemType is required, basePrice cannot be negative",
  "data": null,
  "timestamp": "2026-04-24T14:30:05.000Z",
  "stack": "..." // ONLY included if NODE_ENV=development
}
```  
**Frontend Implementation Tip:** You do not need to manually check HTTP status codes. You can safely write your frontend Axios/Fetch interceptors to simply check `if (!response.data.success) { throw new Error(response.data.message) }`.  

---  

## 3. The Two-Token Authentication Flow  
Reshma-Core uses an enterprise-grade stateless JWT architecture designed to prevent XSS and CSRF attacks.  

**The Tokens**  
1. **Access Token (The VIP Pass):** Short-lived (15 mins). Returned in the JSON response payload. **Must be stored in React Memory (Zustand/Context)**. Never store this in localStorage.

2. **Refresh Token (The Vault Key):** Long-lived (7 days). Automatically attached to the browser as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. It is invisible to JavaScript.  

**The Flow**  
1. **Login:** Send credentials. Receive `accessToken` in JSON. The browser automatically saves the `refreshToken` cookie.  

2. **Protected Requests:** Attach the Access Token to the **Authorization header:** `http Authorization: Bearer <YOUR_ACCESS_TOKEN>`  

3. **Silent Refresh:** When the Access Token expires (HTTP 401), the frontend must silently call **POST /api/v1/auth/refresh**. The browser will automatically attach the HttpOnly cookie, and the server will return a fresh `accessToken`.  

4. **Logout:** Call **GET /api/v1/auth/logout**. The server will command the browser to destroy the HttpOnly cookie and clear the session.  

---  
## 4. HTTP Status Code Dictionary  

The API strictly adheres to the following HTTP status codes mapping:  
| Code | Status               | Description                                                                                     |
|------|----------------------|-------------------------------------------------------------------------------------------------|
| 200  | OK                   | Standard success (Login, fetching data, updating data).                                        |
| 201  | Created              | Resource created successfully (Registration, creating a product).                              |
| 204  | No Content           | Resource deleted successfully (Response body will be empty).                                   |
| 400  | Bad Request          | Validation failure (Zod caught a bad payload).                                                 |
| 401  | Unauthorized         | Authentication failure (Missing token, expired token, or invalid credentials).                 |
| 403  | Forbidden            | Authorization failure (Valid token, but user lacks ADMIN role).                                |
| 404  | Not Found            | The requested endpoint or database resource does not exist.                                    |
| 409  | Conflict             | Database collision (e.g., Duplicate SKU, email already registered, out of stock).              |
| 429  | Too Many Requests    | Rate limit exceeded.                                                                           |
| 500  | Server Error         | Unhandled internal exception.                                                                  |  

---  

## 5. Request Validation (Zod) & Security Limits  

* **NoSQL Injection Prevention:** Every incoming request (`body`, `query`, and `params`) is intercepted by strict Zod schemas. Extraneous fields sent in the JSON body will be silently stripped out.

* **Fail-Fast:** If required fields are missing, the API immediately returns a `400 Bad Request`. 

* **Global API Limit:** 100 requests per 15 minutes per IP.
* **Authentication Limit:** 10 attempts per 15 minutes per IP on all `/auth/*` routes.  
* **Checkout Limit:** 5 attempts per 15 minutes per IP to prevent financial DDoS.
* **Payload Limit:** Maximum JSON body size is restricted to 10kb. (Images are handled separately via Multer `multipart/form-data` with a 10MB strict limit).  

---  

## 6. Master Endpoint Directory  

**1. Auth Module (`/auth`)** `POST /auth/register` - Register a new customer  

* `POST /auth/login` - Login and receive JWT pair
* `POST /auth/verify-otp` - Verify email via asynchronous OTP
* `POST /auth/refresh` - Issue new access token via HttpOnly Cookie
* `GET /auth/logout` - Clear session and destroy HttpOnly cookies  

**2. Users Module (`/users`)**  `GET /users/profiles` - Get current logged-in user profile  
* `PATCH /users/profiles` - Update profile details
* `GET /users` - *(Admin)* List all registered customers  

**3. Products Module (`/products`) - Polymorphic Catalog**  

* `GET /products` - *(Public)* List catalog. Supports pagination and text search (`?page=1&limit=15&q=red&itemType=BANGLE`)
* `GET /products/:id` - *(Public)* Get single product details 
* `POST /products` - *(Admin)* Create a new product. **Requires** `multipart/form-data` for Cloudinary image uploads. 
* `PATCH /products/:id` - *(Admin)* Update product details or stock counts.
* `DELETE /products/:id` - *(Admin)* Soft-delete a product to preserve historical receipts. 

**4. Cart Module (`/cart`)**
* `GET /cart` - Retrieve the active user's cart
* `POST /cart/merge` - Merge guest carts
* `POST /cart/add` - Add/increment items
* `PATCH /cart/update` - Override specific quantity
* `DELETE /cart/item/:productId` - Drop product
* `DELETE /cart/clear` - Empty cart
* `POST /cart/coupon/apply` - **(New)** Apply a promotional code to the cart.
* `DELETE /cart/coupon/remove` - **(New)** Strip the active promotional code.

**5. Orders & Checkout (`/orders`)**  
* `POST /orders/checkout` - Initialize ACID transaction and Razorpay Order.
* `POST /orders/verify-payment` - Verify webhook payment signature
* `POST /orders/webhook` - Public HMAC-secured background handler for Razorpay pings.
* `GET /orders/:id/invoice` - Stream on-the-fly PDF tax invoice
* `GET /orders/me` - List current user's order history.
* `GET /orders` - *(Admin)* View all incoming orders
* `PATCH /orders/:id/status` - *(Admin)* Update order shipping status `PATCH /orders/:id/status` - *(Admin)* Update order shipping status

**6. Returns Module (/returns) - Upcoming Phase 8**  `POST /returns/:orderId` - Submit return request (Requires Cloudinary image proof for Fragile items)  

* `GET /returns/pending` - *(Admin)* View returns awaiting approval 

**7. Interactions Module (/interactions)**  

* `GET /interactions/product/:productId` - (*Public*) Fetch paginated top-level reviews for a product.
* `POST /interactions` - Create a new review or threaded comment.
* `PATCH /interactions/:interactionId/vote` - Upvote or downvote a specific interaction.   

**8. Coupon Module (`/coupons`)**
* `GET /coupons/available` - *(Public)* Dynamically fetch active coupons based on `?cartValue=X`.
* `POST /coupons` - *(Admin)* Generate a new promotional code.
* `PATCH /coupons/:id` - *(Admin)* Update coupon limits or toggle kill-switch.
* `GET /coupons` - *(Admin)* Paginated and filtered fetching of system promotions.

--- 

## Endpoint Documentation Template  

*(Note: As we build out frontend integrations, specific endpoints will be documented below using this exact template)*.  

`POST /products`  

**Description:** Creates a new polymorphic product and processes Cloudinary image streams.  

**Access:** `Protected (Admin)`  
**Request Type:** `multipart/form-data`  
**Expected Payload:** `itemType` (String: BANGLE, APPAREL, etc.)  
* `sku` (String)
* `images` (File Array - max 10MB)
* *...[Polymorphic fields dynamically required based on itemType]*  

### Successful Response (201 Created):  
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "product": {
      "_id": "64a7b...",
      "sku": "RB-APP-1001",
      "images": ["[suspicious link removed]..."]
    }
  },
  "timestamp": "2026-04-24T14:30:00.000Z"
}
```  

--- 

*Maintained by Md Afzal Ansari | Core System Architecture*