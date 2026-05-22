<div align="center">

  # Users Module
  
  **The central hub for customer identity, logistics (address book), security credentials, and DPDP‑compliant data governance.**

  [![Profile](https://img.shields.io/badge/Profile-Identity_Management-47A248?style=flat)](#)
  [![Address Book](https://img.shields.io/badge/Address_Book-Embedded_Logistics-FF6B6B?style=flat)](#)
  [![Security](https://img.shields.io/badge/Security-Step_Up_Authentication-3448C5?style=flat)](#)
  [![DPDP](https://img.shields.io/badge/DPDP-Right_to_be_Forgotten-000000?style=flat)](#)

</div>

---

## 📖 Table of Contents

- [Base Route](#base-route)
- [Endpoints Overview](#endpoints-overview)
- [Endpoint Details](#endpoint-details)
  - [Profile Management](#profile-management)
    - [GET /profile](#get-profile)
    - [PATCH /profile](#patch-profile)
    - [POST /profile/avatar](#post-profileavatar)
    - [DELETE /profile](#delete-profile)
    - [POST /profile/export](#post-profileexport)
  - [Address Book (Logistics)](#address-book-logistics)
    - [POST /profile/addresses](#post-profileaddresses)
    - [PATCH /profile/addresses/:addressId](#patch-profileaddressesaddressid)
    - [DELETE /profile/addresses/:addressId](#delete-profileaddressesaddressid)
  - [Security & Credentials](#security--credentials)
    - [POST /profile/security/password/otp](#post-profilesecuritypasswordotp)
    - [PATCH /profile/security/password](#patch-profilesecuritypassword)
- [Validation Rules (Zod)](#validation-rules-zod)
- [Error Responses](#error-responses)
- [Runbook](#runbook)

---

## Base Route  :  `/api/v1/users`  

All endpoints are **private** (require a valid access token) and are rate‑limited (100 requests per 15 minutes per IP). The `protect` middleware guarantees a valid JWT.

---

## Endpoints Overview

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| **Profile** | | | |
| `GET` | `/profile` | Private | Fetch authenticated user's profile + address book |
| `PATCH` | `/profile` | Private | Update demographics (firstname, lastname, phone, gender, dob) |
| `POST` | `/profile/avatar` | Private | Upload avatar image (multipart/form-data → Cloudinary) |
| `DELETE` | `/profile` | Private | DPDP Right to be Forgotten – delete account & anonymize data |
| `POST` | `/profile/export` | Private | Request data export (BullMQ async, emailed JSON) |
| **Address Book** | | | |
| `POST` | `/profile/addresses` | Private | Add a new shipping/billing address |
| `PATCH` | `/profile/addresses/:addressId` | Private | Update address fields or toggle `isDefault` |
| `DELETE` | `/profile/addresses/:addressId` | Private | Remove an address (auto‑reassigns default if needed) |
| **Security** | | | |
| `POST` | `/profile/security/password/otp` | Private | Request OTP for password change (email) |
| `PATCH` | `/profile/security/password` | Private | Change password using OTP + current password |

---

## Endpoint Details

### Profile Management

#### `GET /profile`

Fetch the authenticated user's complete profile, including the embedded address book.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "_id": "64a7b...",
    "email": "user@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "phone": "9876543210",
    "avatar": "https://res.cloudinary.com/...",
    "role": "USER",
    "isEmailVerified": true,
    "addresses": [
      {
        "_id": "64a7c...",
        "street": "123 Main St",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "label": "HOME",
        "isDefault": true
      }
    ],
    "loyaltyPoints": 250,
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```  

> The password hash is **never** returned (`select: false` in the schema).  

### `PATCH /profile`

Update demographic fields. Only the fields provided are updated. Mass assignment is prevented by Zod strict schema.

**Headers:** `Authorization: Bearer <access_token>`  
**Content-Type:** `application/json`  

**Request body (partial):**  
```json
{
  "firstname": "Jonathan",
  "phone": "9876543222",
  "gender": "MALE"
}
```  

**Response (200 OK):** Returns the updated profile (same shape as `GET /profile`).  
> The `role`, `email`, `isEmailVerified`, and `loyaltyPoints` cannot be changed via this endpoint.  

### `POST /profile/avatar`

Upload a new profile picture. The image is streamed directly from memory to Cloudinary (no disk write), converted to WebP, and stored in the `avatars` folder.

**Headers:** `Authorization: Bearer <access_token>`  
**Content-Type:** `multipart/form-data` 

**File field:**  
- `avatar` – image file (JPEG, PNG, WebP; max 10MB).  

**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatar": "https://res.cloudinary.com/reshma-core/avatars/abc123.webp"
  },
  "timestamp": "2026-05-22T10:35:00.000Z"
}
```  

> The previous avatar is **not** automatically deleted from Cloudinary to avoid accidental data loss. Admin can clean up orphaned images separately.  

### `DELETE /profile`

DPDP / GDPR Right to be Forgotten. Permanently deletes the user account and anonymises all related data (orders, returns, support tickets, cart, wishlist).

**Headers:**  
`Authorization: Bearer <access_token>`  

**Response (200 OK):**  

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Account successfully deleted and personal data anonymized.",
  "data": null,
  "timestamp": "2026-05-22T10:40:00.000Z"
}
```  

**What happens server‑side (ACID transaction):**  

| Module   | Action                                                                 |
|----------|------------------------------------------------------------------------|
| Cart     | `deleteUserCart` – wipes ephemeral cart                                |
| Wishlist | `deleteUserWishlist` – removes wishlist document                       |
| Orders   | `anonymizeUserOrders` – scrambles PII (name, address)                  |
| Returns  | `anonymizeUserReturns` – same as orders                                |
| Support  | `anonymizeUserTickets` – nullifies user reference, redacts user messages |
| User     | `findOneAndDelete` – permanently removes the user document             |  

> After deletion, the refresh token cookie is cleared. Any remaining JWTs will expire within 15 minutes.  

### `POST /profile/export`

DPDP / GDPR Right to Access. Asynchronously compiles all user data into a JSON file and emails it to the user. The response is immediate (202 Accepted); the actual work is queued in BullMQ.

**Headers:**  
`Authorization: Bearer <access_token>`  

**Response (202 Accepted):**  
```json
{
  "success": true,
  "statusCode": 202,
  "message": "Your data export has been queued. We will email you the file shortly.",
  "data": null,
  "timestamp": "2026-05-22T10:45:00.000Z"
}
```  

**What is included in the export:** profile, addresses, order history, returns, support tickets, wishlist, notifications.  

> The export job may take several minutes depending on the amount of data.  

---  

## Address Book (Logistics)  

### `POST /profile/addresses`

Add a new address to the user's address book (max 10 addresses). If this is the first address or `isDefault: true`, it becomes the default (previous default is demoted atomically).

**Headers:** `Authorization: Bearer <access_token>`  
**Content-Type:** `application/json`  

**Request body:**  

```json
{
  "street": "123 Tech Park, Sector 4",
  "city": "Navi Mumbai",
  "state": "Maharashtra",
  "pincode": "400708",
  "label": "WORK",
  "isDefault": true
}
```
**Response (201 Created):** Returns the updated `addresses` array.  

> Pincode is validated against regex `^[1-9][0-9]{5}$` (Indian 6‑digit postal code).  

### `PATCH /profile/addresses/:addressId`

Update an existing address. All fields are optional. If `isDefault` is set to `true`, all other addresses are demoted automatically.

**Headers:** `Authorization: Bearer <access_token>`  
**Content-Type:** `application/json`  

**URL Parameter:**  
- `addressId` – the MongoDB `_id` of the address sub‑document.  

**Request body (partial):**  
```json
{
  "pincode": "400709",
  "isDefault": false
}
```  
**Response (200 OK):** Returns the updated `addresses` array.  


### `DELETE /profile/addresses/:addressId`

Remove an address from the address book. If the deleted address was the default, the system automatically assigns the first remaining address as the new default.

**Headers:** `Authorization: Bearer <access_token>`

**URL Parameter:**  
- `addressId` – the MongoDB `_id` of the address sub‑document.

**Response (200 OK):** Returns the updated `addresses` array.

> Deleting the last address is allowed; the user will have an empty address book.  

---  

## Security & Credentials  

### `POST /profile/security/password/otp`

Request a 6‑digit OTP for password change. The OTP is sent to the user's registered email and stored in Redis with a 10‑minute TTL.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP sent to registered email",
  "data": null,
  "timestamp": "2026-05-22T10:50:00.000Z"
}
```  
> This endpoint is not available for Google OAuth users (returns `400 Bad Request`).  


### `PATCH /profile/security/password`

Change the account password. Requires the OTP (from previous step) and the current password. The new password is hashed with bcrypt before storage.

**Headers:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`

**Request body:**  
```json
{
  "otp": "123456",
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456@"
}
```  

**Response (200 OK):**  
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Security credentials updated successfully",
  "data": null,
  "timestamp": "2026-05-22T10:55:00.000Z"
}
```  

**Security notes:**  
- The OTP is deleted from Redis after successful change.
- A confirmation email is sent (fire‑and‑forget via BullMQ).
- The current password is verified using `bcrypt.compare`.
> Google OAuth users cannot use this endpoint.  

---

## Validation Rules (Zod)

| Endpoint | Field | Rules |
|----------|-------|-------|
| `PATCH /profile` | `firstname` | string, 2‑50 chars, optional |
| | `lastname` | string, 2‑50 chars, optional |
| | `phone` | regex `^[6-9]\d{9}$`, optional |
| | `gender` | enum `["MALE","FEMALE","OTHER"]`, optional |
| | `dob` | ISO 8601 datetime string, optional |
| `POST /profile/addresses` | `street` | string, 5‑100 chars, required |
| | `city` | string, 2‑50 chars, required |
| | `state` | string, 2‑50 chars, required |
| | `pincode` | regex `^[1-9][0-9]{5}$`, required |
| | `label` | enum `["HOME","WORK","OTHER"]`, required |
| | `isDefault` | boolean, optional (default false) |
| `PATCH /profile/addresses/:addressId` | (all fields from POST, but all optional) | |
| `PATCH /profile/security/password` | `otp` | string, exactly 6 digits, required |
| | `currentPassword` | string, min 1 char, required |
| | `newPassword` | min 8 chars, one uppercase, one number, one special char, required |

> All schemas use `.strict()` – extra fields are rejected.

---  

## Error Responses

| Status | Code | Example message | When |
|--------|------|----------------|------|
| 400 | `BAD_REQUEST` | `"Address book limit reached (Max 10)"` | Adding 11th address |
| 400 | `BAD_REQUEST` | `"Invalid phone number format"` | Zod validation fails |
| 400 | `BAD_REQUEST` | `"OAuth accounts do not use passwords"` | Google user tries password OTP |
| 401 | `UNAUTHORIZED` | `"Authentication required"` | Missing/invalid token |
| 404 | `NOT_FOUND` | `"User profile not found"` | User deleted or invalid |
| 404 | `NOT_FOUND` | `"Address not found"` | Invalid addressId |
| 409 | `CONFLICT` | `"Phone number already registered"` | Duplicate phone on update |
| 429 | `TOO_MANY_REQUESTS` | `"Too many requests, please try again later."` | Rate limit exceeded |  

---  

## Runbook

For manual testing with Thunder Client / Postman, see `../../testing/user-runbook.md`. The runbook covers:

- Fetching and updating profile
- Avatar upload
- Address book CRUD (add, update, delete, default toggle)
- Password change with OTP flow
- Account deletion (DPDP)
- Data export request

---  

## Related Documentation

- [Authentication Guide](../authentication.md) – token requirements and refresh flow.
- [Error Handling Guide](../error-codes.md) – 400/404/409 handling.
- [Support Module](./support.md) – ticket anonymisation during account deletion.
- [Orders Module](./orders.md) – order anonymisation.  

---  

<div align="center">

Identity, logistics, and privacy – the Reshma‑Core user engine.
</div>  