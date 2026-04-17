<div align="center">

  # 📚 REST API Reference
  **Reshma Bangles & Boutique Core Engine**

  [![API Version](https://img.shields.io/badge/API_Version-v1.0-3448C5?style=flat&logo=server&logoColor=white)]()
  [![Postman](https://img.shields.io/badge/Postman-Collection_Ready-FF6C37?style=flat&logo=postman&logoColor=white)]()
  [![JSON](https://img.shields.io/badge/Format-JSON-000000?style=flat&logo=json&logoColor=white)]()

</div>

---

## 🌍 Environments & Base URLs
All API endpoints belong to the `v1` namespace. Ensure you are pointing to the correct environment.

| Environment | Base URL | Usage |
| :--- | :--- | :--- |
| **Development** | `http://localhost:5000/api/v1` | Local testing and frontend integration. |
| **Production** | `https://api.reshmabangles.com/api/v1` | Live customer traffic. |

---

## 🔒 Authentication & Authorization
The API uses strict JSON Web Token (JWT) authentication. 

* **Public Routes:** No headers required.
* **Protected Routes:** Requires a valid JWT.
  ```http
  Authorization: Bearer <your_access_token>
  ```  

* **RBAC (Role-Based Access Control):** Admin endpoints (prefixed with `/admin`) require a JWT belonging to a user with the `ADMIN` role. Unauthorized access will return a `403 Forbidden`.  

--- 
## 🛑 Standardized Responses & Error Handling  
This API strictly follows RESTful principles. All responses return a predictable JSON structure.  

**Success Response (2xx)**  
```json
{
  "status": "success",
  "message": "Resource fetched successfully",
  "data": { ... }
}
```  

**Error Response (4xx, 5xx)**  
```json
{
  "status": "error",
  "message": "Validation failed: Phone number must be 10 digits",
  "errorCode": "VALIDATION_ERROR"
}
```  

**🚦 HTTP Status Codes Used** 

| Code | Status | Description |
| :--- | :--- | :--- |
| 200 | OK | Request succeeded. |
| 201 | Created | Resource successfully created (e.g., User registered, Order placed). |
| 400 | Bad Request | Invalid inputs, missing parameters, or validation failures. |
| 401 | Unauthorized | Missing, invalid, or expired JWT. |
| 403 | Forbidden | Valid JWT, but insufficient permissions (e.g., User accessing Admin route). |
| 404 | Not Found | Resource or endpoint does not exist. |
| 429 | Too Many Requests | Rate limit exceeded (Standard: 100 req/15min). |
| 500 | Server Error | Internal system crash or database failure. |


## 📑 Master Endpoint Directory  
As endpoints are implemented, they will be documented using the detailed template below.  

**1. 🔐 Auth Module (`/auth`)**  
* `POST /auth/register` -- Register a new customer
* `POST /auth/login` -- Login and receive JWT
* `POST /auth/forgot-password` -- Request OTP for password reset
* `POST /auth/reset-password` - Reset password using OTP  


**2. 👤 Users Module (`/users`)**  

- **GET** `/users/me` - Get current logged-in user profile
- **PATCH** `/users/me` - Update profile details
- **POST** `/users/me/addresses` - Add a new shipping address
- **GET** `/admin/users` - (Admin) List all registered customers
  
  
**3. 🛍️ Products Module (`/store/products` & `/admin/products`)**

- **GET** `/store/products` - List products (Supports pagination `?page=1&limit=10`)
- **GET** `/store/products/:id` - Get single product details
- **POST** `/admin/products` - (Admin) Create a new polymorphic product variant
- **PATCH** `/admin/products/:id/stock` - (Admin) Quickly update stock levels

**4. 🛒 Orders & Checkout (`/store/orders` & `/admin/orders`)**  

- **POST** `/store/orders/checkout` - Calculate final price and initialize Payment Gateway
- **POST** `/store/orders/verify` - Verify webhook payment signature
- **GET** `/store/orders/my-orders` - List current user's orders
- **GET** `/admin/orders` - (Admin) View all incoming orders
- **PATCH** `/admin/orders/:id/status` - (Admin) Update order status

**5. 📦 Returns Module (`/store/returns` & `/admin/returns`)**  

- **POST** `/store/returns/:orderId` - Submit return request (Requires Cloudinary multipart/form-data)
- **GET** `/admin/returns/pending` - (Admin) View returns awaiting approval
- **PATCH** `/admin/returns/:id/arbitrate` - (Admin) Approve or Reject return

**6. ⭐ Interactions Module (`/store/interactions`)**  

- **POST** `/store/interactions/reviews/:productId` - Submit a star rating and comment
- **GET** `/store/interactions/reviews/:productId` - Fetch paginated reviews for a product

**7. 📊 Dashboard Module (`/admin/dashboard`)**  

- **GET** `/admin/dashboard/overview` - (Admin) Fetch total sales, low stock alerts, and recent orders  

--- 

## 📝 Endpoint Documentation Template  

*(Note: As we build out the API, every endpoint above will be expanded into this format for frontend developers to reference).*  

**`POST /example/route`**  
**Description:** Brief explanation of what the route does.
**Access:** `Public` | `Protected (User)` | `Protected (Admin)`
**Request Body** (`application/json`):  
```json
{
  "field": "type - description"
}
```  

**Successful Response (201 Created):**  
```json
{
  "status": "success",
  "data": {
    "id": "12345"
  }
}
```