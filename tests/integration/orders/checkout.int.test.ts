import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { buildShippingAddress } from "@tests/factories/order.factory";
import { Cart } from "@modules/cart/cart.model";
import { Product } from "@modules/products/models";
import { CouponModel } from "@modules/coupons/coupon.model";
import {
  DiscountType,
  PaymentRestriction,
} from "@modules/coupons/interfaces/coupon.interface";

const API = "/api/v1/orders/checkout";

async function addToCart(
  accessToken: string,
  productId: string,
  quantity: number,
) {
  return request
    .post("/api/v1/carts/add")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ productId, quantity });
}

async function checkout(
  accessToken: string,
  overrides: Record<string, unknown> = {},
) {
  return request
    .post(API)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      shippingAddress: buildShippingAddress(),
      paymentMethod: "RAZORPAY",
      ...overrides,
    });
}

/**
 * Attaches a coupon to the user's cart directly in the DB.
 * The /carts/coupon/apply HTTP route is not currently wired in cart.route.ts,
 * so we bypass the HTTP layer for this setup step.
 */
async function attachCouponToCart(
  userId: string | unknown,
  couponId: unknown,
): Promise<void> {
  await Cart.findOneAndUpdate(
    { user: userId },
    { $set: { appliedCoupon: couponId } },
  );
}

describe("POST /api/v1/orders/checkout", () => {
  it("RAZORPAY: creates order, returns gatewayOrderId, clears cart, decrements stock", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({
      basePrice: 1000,
      currentStock: 10,
    });
    await addToCart(accessToken, String(product._id), 2);

    const res = await checkout(accessToken);

    expectSuccess(res, 201);
    expect(res.body.data.order.gatewayOrderId).toBeDefined();
    expect(res.body.data.order.paymentMethod).toBe("RAZORPAY");
    expect(res.body.data.order.paymentStatus).toBe("PENDING");
    expect(res.body.data.order.orderStatus).toBe("PENDING");

    const cart = await Cart.findOne({ user: res.body.data.order.user });
    expect(cart!.items).toHaveLength(0);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct!.currentStock).toBe(8);
  });

  it("COD: creates order with PROCESSING status and no gatewayOrderId", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1000 });
    await addToCart(accessToken, String(product._id), 1);

    const res = await checkout(accessToken, { paymentMethod: "COD" });

    expectSuccess(res, 201);
    expect(res.body.data.order.gatewayOrderId).toBeUndefined();
    expect(res.body.data.order.paymentMethod).toBe("COD");
    expect(res.body.data.order.orderStatus).toBe("PROCESSING");
  });

  it("rejects an empty cart with 400", async () => {
    const { accessToken } = await createUserWithToken();
    const res = await checkout(accessToken);
    expectError(res, 400);
  });

  it("rejects insufficient stock with 409", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ currentStock: 5 });

    // Add 3 to the cart (valid at the time of adding)
    await addToCart(accessToken, String(product._id), 3);

    // Simulate a concurrent purchase that drains the stock below the
    // cart's requested quantity. The checkout's atomic reservation
    // must now fail because currentStock < 3.
    await Product.findByIdAndUpdate(product._id, {
      $set: { currentStock: 1 },
    });

    const res = await checkout(accessToken);
    expectError(res, 409);
  });

  it("rejects without auth with 401", async () => {
    const res = await request.post(API).send({
      shippingAddress: buildShippingAddress(),
      paymentMethod: "RAZORPAY",
    });
    expectError(res, 401);
  });

  it("rejects invalid pincode with 400", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle();
    await addToCart(accessToken, String(product._id), 1);

    const res = await checkout(accessToken, {
      shippingAddress: buildShippingAddress({ postalCode: "abc" }),
    });
    expectError(res, 400);
  });

  it("applies coupon and creates order with discount", async () => {
    const { accessToken, user } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1500 });
    await addToCart(accessToken, String(product._id), 1);

    const now = Date.now();
    const coupon = await CouponModel.create({
      code: "TESTFLAT100",
      discountType: DiscountType.FLAT,
      discountValue: 100,
      minCartValue: 500,
      startDate: new Date(now - 60_000),
      expiryDate: new Date(now + 86_400_000),
      usageLimit: 100,
      isActive: true,
      paymentMethodRestriction: PaymentRestriction.ANY,
    });

    // Attach coupon directly to the cart — the /carts/coupon/apply
    // HTTP route is not currently wired in cart.route.ts.
    await attachCouponToCart(user._id, coupon._id);

    const res = await checkout(accessToken, { paymentMethod: "COD" });
    expectSuccess(res, 201);
    expect(res.body.data.order.pricing.discountAmount).toBe(100);

    // COD path increments usage inside the transaction
    const freshCoupon = await CouponModel.findById(coupon._id);
    expect(freshCoupon!.usedCount).toBe(1);
  });

  it("rejects expired coupon with 409", async () => {
    const { accessToken, user } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1500 });
    await addToCart(accessToken, String(product._id), 1);

    const now = Date.now();
    const coupon = await CouponModel.create({
      code: "EXPIRED",
      discountType: DiscountType.FLAT,
      discountValue: 100,
      minCartValue: 500,
      startDate: new Date(now - 60_000),
      expiryDate: new Date(now + 60_000),
      usageLimit: 100,
      isActive: true,
      paymentMethodRestriction: PaymentRestriction.ANY,
    });

    // Attach coupon to cart, then expire it before checkout
    await attachCouponToCart(user._id, coupon._id);
    await CouponModel.updateOne(
      { _id: coupon._id },
      { $set: { expiryDate: new Date(now - 1000) } },
    );

    const res = await checkout(accessToken);
    expectError(res, 409);
  });

  it("intra-state (WB): splits tax into CGST + SGST", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({
      basePrice: 1000,
      currentStock: 10,
    });
    await addToCart(accessToken, String(product._id), 1);

    const res = await checkout(accessToken);
    expectSuccess(res, 201);
    expect(res.body.data.order.pricing.totalCgst).toBeGreaterThan(0);
    expect(res.body.data.order.pricing.totalSgst).toBeGreaterThan(0);
    expect(res.body.data.order.pricing.totalIgst).toBe(0);
  });

  it("inter-state (MH): puts full tax in IGST", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({
      basePrice: 1000,
      currentStock: 10,
    });
    await addToCart(accessToken, String(product._id), 1);

    const res = await checkout(accessToken, {
      shippingAddress: buildShippingAddress({
        state: "MH",
        city: "Mumbai",
        postalCode: "400001",
      }),
    });
    expectSuccess(res, 201);
    expect(res.body.data.order.pricing.totalCgst).toBe(0);
    expect(res.body.data.order.pricing.totalSgst).toBe(0);
    expect(res.body.data.order.pricing.totalIgst).toBeGreaterThan(0);
  });
});
