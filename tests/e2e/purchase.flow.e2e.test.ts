// ──────────────────────────────────────────────
// E2E — Full purchase flow
// ──────────────────────────────────────────────
// Exercises the complete buyer journey: register → OTP → browse →
// cart → (coupon) → checkout → sign payment → verify → order confirmed.
// Each test crosses multiple modules in a single transaction-like sequence
// to catch cross-module regressions that isolated tests miss.

import crypto from "crypto";
import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { Cart } from "@modules/cart/cart.model";
import { Order } from "@modules/orders/order.model";
import { Product } from "@modules/products/models";
import { CouponModel } from "@modules/coupons/coupon.model";
import {
  DiscountType,
  PaymentRestriction,
} from "@modules/coupons/interfaces/coupon.interface";
import { redisClient } from "@config/redis";
import env from "@config/env";

const REGISTER = "/api/v1/auth/register";
const VERIFY_OTP = "/api/v1/auth/verify-otp";
const CART_ADD = "/api/v1/carts/add";
const CHECKOUT = "/api/v1/orders/checkout";
const VERIFY_PAYMENT = "/api/v1/orders/verify-payment";

const SHIPPING = {
  fullName: "Test Buyer",
  phone: "+919876543210",
  streetAddress: "123 Test Street",
  city: "Kolkata",
  state: "WB",
  postalCode: "700001",
  country: "India",
};

function signRazorpay(orderId: string, paymentId: string): string {
  return crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

describe("E2E — Purchase flow", () => {
  it("golden path: register → OTP → cart → checkout → verify → order confirmed", async () => {
    const email = `e2e-purchase-${Date.now()}@test.com`;

    // 1. Register → OTP cached in Redis
    const reg = await request.post(REGISTER).send({
      firstname: "E2E",
      lastname: "Buyer",
      email,
      password: "Password123!",
      acceptPrivacyPolicy: true,
    });
    expect(reg.status).toBe(201);

    // 2. Read the generated OTP from Redis
    const otp = await redisClient.get(`otp:${email}`);
    expect(otp).toMatch(/^\d{6}$/);

    // 3. Verify OTP → access token
    const verify = await request.post(VERIFY_OTP).send({ email, otp });
    expect(verify.status).toBe(200);
    const accessToken = verify.body.data.accessToken as string;
    expect(accessToken).toBeDefined();

    // 4. Admin creates a product
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });
    const product = await createTestBangle({
      basePrice: 1500,
      currentStock: 10,
    });

    // 5. Add to cart
    const add = await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 2 });
    expect(add.status).toBe(200);
    expect(add.body.data.items).toHaveLength(1);

    // 6. Checkout with Razorpay
    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ shippingAddress: SHIPPING, paymentMethod: "RAZORPAY" });
    expect(checkout.status).toBe(201);
    const order = checkout.body.data.order;
    expect(order.gatewayOrderId).toBeDefined();
    expect(order.paymentStatus).toBe("PENDING");

    // 7. Simulate Razorpay success + sign
    const paymentId = `pay_e2e_${Date.now()}`;
    const signature = signRazorpay(order.gatewayOrderId, paymentId);

    // 8. Verify payment
    const verified = await request
      .post(VERIFY_PAYMENT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });
    expect(verified.status).toBe(200);
    expect(verified.body.data.order.paymentStatus).toBe("PAID");
    expect(verified.body.data.order.orderStatus).toBe("PROCESSING");

    // 9. Verify DB persistence
    const freshProduct = await Product.findById(product._id);
    expect(freshProduct!.currentStock).toBe(8);

    const freshCart = await Cart.findOne({
      user: verified.body.data.order.user,
    });
    expect(freshCart!.items).toHaveLength(0);

    void adminToken; // admin created only for setup symmetry
  });

  it("with coupon: discount is applied and usage count incremented", async () => {
    const { accessToken, user } = await createUserWithToken();
    const product = await createTestBangle({
      basePrice: 2000,
      currentStock: 5,
    });

    await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    const now = Date.now();
    const coupon = await CouponModel.create({
      code: "E2E20",
      discountType: DiscountType.FLAT,
      discountValue: 200,
      minCartValue: 500,
      startDate: new Date(now - 60_000),
      expiryDate: new Date(now + 86_400_000),
      usageLimit: 100,
      isActive: true,
      paymentMethodRestriction: PaymentRestriction.ANY,
    });
    await Cart.findOneAndUpdate(
      { user: user._id },
      { $set: { appliedCoupon: coupon._id } },
    );

    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ shippingAddress: SHIPPING, paymentMethod: "COD" });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order.pricing.discountAmount).toBe(200);

    const freshCoupon = await CouponModel.findById(coupon._id);
    expect(freshCoupon!.usedCount).toBe(1);
  });

  it("COD: order goes straight to PROCESSING without gatewayOrderId", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1000 });

    await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ shippingAddress: SHIPPING, paymentMethod: "COD" });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order.paymentMethod).toBe("COD");
    expect(checkout.body.data.order.orderStatus).toBe("PROCESSING");
    expect(checkout.body.data.order.gatewayOrderId).toBeUndefined();
  });

  it("idempotent: second verify-payment on same order does not double-process", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ currentStock: 5 });
    await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ shippingAddress: SHIPPING, paymentMethod: "RAZORPAY" });
    const order = checkout.body.data.order;
    const paymentId = `pay_idem_${Date.now()}`;
    const signature = signRazorpay(order.gatewayOrderId, paymentId);

    // First call
    const first = await request
      .post(VERIFY_PAYMENT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });
    expect(first.status).toBe(200);

    // Second call with same payload
    const second = await request
      .post(VERIFY_PAYMENT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });
    expect(second.status).toBe(200);
    expect(second.body.data.order.paymentStatus).toBe("PAID");

    // Stock decremented only once (from 5 to 4, not 3)
    const freshProduct = await Product.findById(product._id);
    expect(freshProduct!.currentStock).toBe(4);

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder!.paymentStatus).toBe("PAID");
  });

  it("inter-state (MH): places order with full IGST split", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1000 });

    await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        shippingAddress: {
          ...SHIPPING,
          state: "MH",
          city: "Mumbai",
          postalCode: "400001",
        },
        paymentMethod: "COD",
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order.pricing.totalCgst).toBe(0);
    expect(checkout.body.data.order.pricing.totalSgst).toBe(0);
    expect(checkout.body.data.order.pricing.totalIgst).toBeGreaterThan(0);
  });
});
