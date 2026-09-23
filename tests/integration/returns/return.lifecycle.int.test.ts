import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import {
  createTestOrder,
  createDeliveredOrder,
} from "@tests/helpers/order.helper";
import { createTestInnerwear } from "@tests/helpers/product.helper";
import { Order } from "@modules/orders/order.model";
import { ReturnModel } from "@modules/returns/return.model";
import {
  ReturnReason,
  ReturnStatus,
} from "@modules/returns/interfaces/return.interface";
import { buildOrderDoc } from "@tests/factories/order.factory";
import { buildReturnItem } from "@tests/factories/return.factory";
import { initiateReturn } from "@tests/helpers/return.helper";
import { Types } from "mongoose";

describe("POST /api/v1/returns/:orderId/initiate", () => {
  it("user initiates a return on a DELIVERED order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1, ReturnReason.NOT_NEEDED)],
    });

    expectSuccess(res, 201);
    expect(res.body.data.returnRequest.status).toBe(
      ReturnStatus.PENDING_APPROVAL,
    );
    expect(res.body.data.returnRequest.items).toHaveLength(1);
  });

  it("rejects initiation on a non-DELIVERED order (PENDING)", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createTestOrder({
      accessToken,
      paymentMethod: "COD",
      orderStatus: "PENDING",
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 400);
  });

  it("rejects initiation on a CANCELLED order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createTestOrder({
      accessToken,
      paymentMethod: "COD",
      orderStatus: "CANCELLED",
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 400);
  });

  it("returns 404 when the order belongs to another user (IDOR)", async () => {
    const { accessToken: ownerToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken: ownerToken,
      paymentMethod: "COD",
    });

    const { accessToken: attackerToken } = await createUserWithToken();
    const res = await initiateReturn(attackerToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 404);
  });

  it("rejects when the 7-day window has expired", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    // Bypass Mongoose timestamps — force updatedAt to 8 days ago
    await Order.collection.updateOne(
      { _id: order._id },
      { $set: { updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } },
    );

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 400);
  });

  it("rejects when requested quantity exceeds purchased quantity", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
      quantity: 1,
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 5)],
    });

    expectError(res, 400);
  });

  it("rejects when the product is not part of the order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem("000000000000000000000000", 1)],
    });

    expectError(res, 400);
  });

  it("blocks INNERWEAR returns (hygiene policy)", async () => {
    const { accessToken, user } = await createUserWithToken();
    const innerwear = await createTestInnerwear({ basePrice: 1000 });

    const order = await Order.create(
      buildOrderDoc({
        user: user._id as Types.ObjectId,
        items: [
          {
            product: innerwear._id as Types.ObjectId,
            name: innerwear.name,
            sku: innerwear.sku,
            quantity: 1,
            priceAtPurchase: innerwear.basePrice,
            imageSnapshot: innerwear.images[0]!,
            hsnCode: "6108",
            gstRate: 5,
          },
        ],
        paymentMethod: "COD",
        paymentStatus: "PAID",
        orderStatus: "DELIVERED",
      }),
    );

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(innerwear._id), 1)],
    });

    expectError(res, 403);
  });

  it("requires photo proof for fragile items", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    // Mark the product as fragile AFTER order creation — the return service
    // looks up the live product, so this triggers the fragile requirement.
    const { Product } = await import("@modules/products/models");
    await Product.updateOne(
      { _id: product._id },
      { $set: { isFragile: true } },
    );

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 400);
  });

  it("accepts a fragile return when images are provided", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    const { Product } = await import("@modules/products/models");
    await Product.updateOne(
      { _id: product._id },
      { $set: { isFragile: true } },
    );

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
      images: ["https://example.com/damage.jpg"],
    });

    expectSuccess(res, 201);
    expect(res.body.data.returnRequest.proofOfDamageImages).toHaveLength(1);
  });

  it("prevents a duplicate return on the same order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    // Second attempt: the order is now in RETURN_REQUESTED state, so the
    // state-machine guard fires before the DB-level unique-index check.
    // Both are legitimate protections; the state check runs first.
    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectError(res, 400);
    expect(res.body.message).toMatch(/RETURN_REQUESTED|Cannot return/i);
  });

  it("computes a proportional refund without inflating by tax/shipping", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
      basePrice: 1000,
      quantity: 1,
    });

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });

    expectSuccess(res, 201);
    const estimate = res.body.data.returnRequest.refundAmountEstimate as number;

    // No discount → refund should equal raw item value (1000)
    // The buggy version would inflate this to include tax + shipping.
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThanOrEqual(1000);
  });
});

describe("GET /api/v1/returns/me", () => {
  it("returns only the caller's returns", async () => {
    const { accessToken: userA } = await createUserWithToken();
    const { accessToken: userB } = await createUserWithToken();

    const { order: orderA, product: productA } = await createDeliveredOrder({
      accessToken: userA,
      paymentMethod: "COD",
    });
    await initiateReturn(userA, String(orderA._id), {
      items: [buildReturnItem(String(productA._id), 1)],
    });

    // Second user has no returns
    const res = await request
      .get("/api/v1/returns/me")
      .set("Authorization", `Bearer ${userB}`);

    expectSuccess(res, 200);
    expect(res.body.data.returns).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const res = await request.get("/api/v1/returns/me");
    expectError(res, 401);
  });
});
