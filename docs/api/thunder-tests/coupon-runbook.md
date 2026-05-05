# Thunder Client Runbook: Coupon Module

**Base URL:** `{{API_URL}}/api/v1/coupons`

## 1. The "Happy Path" (Sequential Test Suite)

### Test 1: Admin Creates a Coupon
* **Method:** `POST /`
* **Headers:** `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`
* **Body (JSON):**
  ```json
  {
    "code": "DIWALI500",
    "discountType": "FLAT",
    "discountValue": 500,
    "minCartValue": 2500,
    "startDate": "2026-05-01T00:00:00.000Z",
    "expiryDate": "2026-12-31T23:59:59.000Z",
    "usageLimit": 100
  }
  ```  
* **Expected:** `201 Created`.  

### Test 2: Public Discovery (Customer Facing)

- **Method:** `GET /available?cartValue=3000`
- **Headers:** `Authorization: Bearer <USER_ACCESS_TOKEN>`
- **Expected:** `200 OK`. Should return the newly created `DIWALI500` coupon.

### Test 3: Apply Coupon to Cart

- **Method:** `POST {{API_URL}}/api/v1/cart/coupon/apply`
- **Body:**
  ```json
  {
    "code": "DIWALI500"
  }
  ```  
* **Expected:** `200 OK`. The cart payload should now feature discountAmount: 500 and a recalculated totalAfterDiscount.  

## 2. Edge Case Testing  

* **Test the Zod Firewall:** Try creating a `PERCENTAGE` coupon with `discountValue: 105`. It should fail with a `400 Bad Request` preventing >100% discounts.

* **Test the Failsafe:** Apply `DIWALI500` to a cart. Then, delete an item from the cart so the subtotal falls below ₹2500. The API should succeed, but the cart's `appliedCoupon` should silently reset to `null`.  

