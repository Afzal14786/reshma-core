import crypto from "crypto";
import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestOrder } from "@tests/helpers/order.helper";
import { Order } from "@modules/orders/order.model";
import env from "@config/env";

const API = "/api/v1/orders/verify-payment";

function sign(orderId: string, paymentId: string): string {
  return crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

describe("POST /api/v1/orders/verify-payment", () => {
  it("marks the order PAID when the signature is valid", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_test_verify_1",
    });

    const paymentId = "pay_test_verify_1";
    const signature = sign(order.gatewayOrderId!, paymentId);

    const res = await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });

    expectSuccess(res, 200);
    expect(res.body.data.order.paymentStatus).toBe("PAID");
    expect(res.body.data.order.orderStatus).toBe("PROCESSING");
  });

  it("returns 400 for an invalid signature", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_test_verify_2",
    });

    const res = await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: "pay_test_verify_2",
        gatewaySignature: "deadbeef",
      });

    expectError(res, 400);
  });

  it("returns 404 for a non-existent gateway order", async () => {
    const { accessToken } = await createUserWithToken();
    const res = await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: "order_ghost",
        gatewayPaymentId: "pay_ghost",
        gatewaySignature: "abc",
      });
    expectError(res, 404);
  });

  it("is idempotent — returns the same order if already PAID", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_test_verify_4",
    });

    const paymentId = "pay_test_verify_4";
    const signature = sign(order.gatewayOrderId!, paymentId);

    // First call
    await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });

    // Second call
    const res = await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: signature,
      });

    expectSuccess(res, 200);
    expect(res.body.data.order.paymentStatus).toBe("PAID");
  });

  it("returns 401 when auth is missing", async () => {
    const res = await request.post(API).send({
      gatewayOrderId: "x",
      gatewayPaymentId: "y",
      gatewaySignature: "z",
    });
    expectError(res, 401);
  });
});