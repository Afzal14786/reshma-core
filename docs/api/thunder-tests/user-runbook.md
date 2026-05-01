# Thunder Client Runbook: User Module

**Base URL:** `{{API_URL}}/api/v1/users`
**Auth Requirement:** All endpoints require a valid `Bearer {{JWT_TOKEN}}` in the Authorization header.

---

## 1. Identity & Profile

### A. Get Current Profile
* **Method:** `GET`
* **Endpoint:** `/me`
* **Expected Result:** `200 OK` (Returns User object including the addresses array).

### B. Update Demographics
* **Method:** `PATCH`
* **Endpoint:** `/me`
* **Body (JSON):**
  ```json
  {
    "firstname": "Afzal",
    "lastname": "Ansari",
    "phone": "9876543210",
    "gender": "MALE"
  }
  ```  

* **Security Test:** Try adding `"role": "ADMIN"` to the JSON above. It should fail with `400 Bad Request`.  

### C. Upload Avatar  

* **Method:** `POST` 
* **Endpoint:** `/profile/avatar`
* **Body (Form-Data):**
    * Key: `avatar` (Type: File) -> Select an image.
* **Expected Result:** `200 OK` (Avatar URL updates to a Cloudinary link). 

---  
## 2. Address Book (Logistics)  

### A. Add Address  

* **Method:** `POST`
* **Endpoint:** `/profile/addresses`
* **Body (JSON):**
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
### B. Update Address (Partial)  
* **Method:** `PATCH`
* **Endpoint:** `/profile/addresses/{{ADDRESS_ID}}`
* **Body (JSON):**
    ```json
    {
        "pincode": "400709",
        "isDefault": false
    }
    ```

### C. Delete Address  
* **Method:** `DELETE`
* **Endpoint:** `/profile/addresses/{{ADDRESS_ID}}`
* **Expected Result:** `200 OK` (Address removed. If it was the default, another address is automatically promoted).  

--- 

## 3. Security  

### A. Update Password
* **Method:** `PATCH`
* **Endpoint:** `/profile/security/password`
* **Body (JSON):**
    ```json
    {
        "currentPassword": "OldPassword123!",
        "newPassword": "NewSecurePassword456@"
    }
    ```  
* **Expected Result:** `200 OK`.