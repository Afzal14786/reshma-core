# Product Catalog Testing Runbook (Manual)

## 1. Overview
This document outlines the sequential testing flow for the Reshma-Core Product Module. These tests verify the polymorphic Zod validation, Cloudinary image uploads, and Admin Role-Based Access Control (RBAC).

**Recommended Tools:** [Thunder Client](https://www.thunderclient.com/) (VS Code) or Postman.

---

## 2. Prerequisites & Environment Setup
Before testing the write operations, you must have an Admin account.
1. Register a new user via `POST /api/v1/auth/register` (or use an existing one).
2. Open MongoDB Compass (or Atlas), find that user document, and manually change `"role": "USER"` to `"role": "ADMIN"`.
3. Hit `POST /api/v1/auth/login` to get a fresh `accessToken`.
4. The Base URL is `http://localhost:5000/api/v1/products`.

---

## 3. The "Happy Path" (Sequential Test Suite)

### Test 1: Create a Bangle Product (Admin)
Because this endpoint handles file uploads, we **cannot** use the raw JSON body tab. We must use the Form Data tab.

* **Action:** Send `POST /`
* **Headers:** `Authorization: Bearer <YOUR_ADMIN_ACCESS_TOKEN>`
* **Body Configuration:**
  1. In Thunder Client, go to the **Body** tab.
  2. Select **Form** (or `multipart/form-data`).
  3. Add the following Text key-value pairs:
     * `itemType`: `BANGLE`
     * `sku`: `TEST-BAN-001`
     * `name`: `Bridal Glass Bangle Set`
     * `mainCategory`: `Bangles`
     * `subCategory`: `Glass Bangles`
     * `material`: `GLASS`
     * `sellingUnit`: `Dozen`
     * `basePrice`: `450`
     * `currentStock`: `50`
     * `weightGrams`: `350`
     * `isFragile`: `true`
     * `bangleSizes[0]`: `2.4` *(Note how arrays are passed in forms)*
     * `bangleSizes[1]`: `2.6`
     * `packSize`: `12`
  4. Add the File field:
     * Key: `images`
     * Type: Change this from "Text" to "File".
     * Value: Select any test image (e.g., `reshma_bangles.jpg` from your assets).
* **Expected Result:** `201 Created`. 
* **Side-Effect Verification:** 1. The JSON response should show the generated MongoDB `_id`. **Copy this ID for the next tests.**
  2. The `images` array in the response should contain a live `https://res.cloudinary.com/...` URL.

### Test 2: Fetch the Catalog (Public)
* **Action:** Send `GET /?page=1&limit=5&itemType=BANGLE`
* **Auth:** None required.
* **Expected Result:** `200 OK`. The response should contain your newly created Bangle inside the `data.products` array, and the `meta` object should show `total: 1`.

### Test 3: Fetch a Single Product (Public)
* **Action:** Send `GET /<PASTE_PRODUCT_ID_HERE>`
* **Auth:** None required.
* **Expected Result:** `200 OK`. Returns the single Bangle document.

### Test 4: Update Inventory Stock (Admin)
Unlike creation, updates can be sent as standard JSON.
* **Action:** Send `PATCH /<PASTE_PRODUCT_ID_HERE>`
* **Headers:** `Authorization: Bearer <YOUR_ADMIN_ACCESS_TOKEN>`
* **Body (JSON):**
  ```json
  {
    "currentStock": 45,
    "basePrice": 499
  }
  ```  

* **Expected Result:** `200 OK`. The product's stock and price should instantly reflect the changes.  

### Test 5: Soft Delete Product (Admin) 

* **Action:** Send `DELETE /<PASTE_PRODUCT_ID_HERE>`
* **Headers:** `Authorization: Bearer <YOUR_ADMIN_ACCESS_TOKEN>`
* **Expected Result:** `200 OK` with message "Product successfully removed...".
* **Side-Effect Verification:** Hit the `GET /<PASTE_PRODUCT_ID_HERE>` (Test 3) again. It should now return a 404 `Not Found` because the `isActive` flag was set to false, hiding it from the public.

--- 

## 4. Security & Edge Case Testing (Negative Tests) 

### Edge Case 1: RBAC Firewall (Unauthorized Role)  

* **Action:** Login with a standard `USER` account (not an ADMIN). Use that access token to hit `DELETE /<PRODUCT_ID>`.
* **Expected Result:** `403 Forbidden`. Message should indicate insufficient permissions.  

### Edge Case 2: Zod Polymorphic Firewall (Wrong Category Fields) 
* **Action:** Try to create an Apparel item, but pass Bangle properties.
    * `itemType`: `APPAREL`
    * `bangleSizes[0]`: `2.4` (Invalid for Apparel)

* **Expected Result:** `400 Bad Request`. Zod should strip out the bangle size, realize `sizes` (required for Apparel) is missing, and throw an error stating: `"Validation Failed: sizes: Required"`.  

### Edge Case 3: Cloudinary File Limit  
* **Action:** Try to `POST /` with a file larger than 5MB.
* **Expected Result:** `400 Bad Request` or `500` caught by Multer's file size limit, preventing server memory exhaustion.