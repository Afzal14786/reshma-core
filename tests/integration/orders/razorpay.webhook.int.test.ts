import crypto from "crypto";
import { request, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestOrder } from "@tests/helpers/order.helper";
import { Order } from "@modules/orders/order.model";
import env from "@config/env";

const API = "/api/v1/orders/webhook";

function sign(body: string): string {
  return crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
}

function buildPayload(gatewayOrderId: string, paymentId: string) {
  return {
    event: "order.paid",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: gatewayOrderId,
        },
      },
    },
  };
}

async function postWebhook(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const req = request.post(API).set("Content-Type", "application/json");
  if (signature !== undefined) req.set("x-razorpay-signature", signature);
  return req.send(raw);
}

describe("POST /api/v1/orders/webhook (Razorpay)", () => {
  it("marks the order PAID on a valid signature", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_1",
    });

    const body = buildPayload(order.gatewayOrderId!, "pay_wh_1");
    const res = await postWebhook(body, sign(JSON.stringify(body)));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");

    const fresh = await Order.findById(order._id);
    expect(fresh!.paymentStatus).toBe("PAID");
    expect(fresh!.orderStatus).toBe("PROCESSING");
  });

  it("returns 400 for an invalid signature", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_2",
    });
    const body = buildPayload(order.gatewayOrderId!, "pay_wh_2");
    const res = await postWebhook(body, "deadbeef");
    expectError(res, 400);
  });

  it("returns 400 when the signature header is missing", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_3",
    });
    const body = buildPayload(order.gatewayOrderId!, "pay_wh_3");
    const res = await postWebhook(body);
    expectError(res, 400);
  });

  it("is idempotent — second webhook for the same order is a no-op", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_4",
    });
    const body = buildPayload(order.gatewayOrderId!, "pay_wh_4");
    const signature = sign(JSON.stringify(body));

    await postWebhook(body, signature);
    await postWebhook(body, signature);

    const fresh = await Order.findById(order._id);
    expect(fresh!.paymentStatus).toBe("PAID");
  });

  it("silently ignores webhooks for unknown orders", async () => {
    const body = buildPayload("order_ghost", "pay_ghost");
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);
  });

  it("does not overwrite an already PAID order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_6",
      paymentStatus: "PAID",
    });

    const body = buildPayload(order.gatewayOrderId!, "pay_wh_6");
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);

    const fresh = await Order.findById(order._id);
    expect(fresh!.paymentStatus).toBe("PAID");
  });

  it("does not mark an order FAILED on an unrelated event", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_7",
    });

    const body = {
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_wh_7", order_id: order.gatewayOrderId } },
      },
    };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);

    const fresh = await Order.findById(order._id);
    expect(fresh!.paymentStatus).toBe("PENDING");
  });

  it("verifies the HMAC against the webhook secret, not the key secret", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_8",
    });
    const body = buildPayload(order.gatewayOrderId!, "pay_wh_8");

    // Sign with WRONG secret
    const wrongSig = crypto
      .createHmac("sha256", "wrong-secret")
      .update(JSON.stringify(body))
      .digest("hex");

    const res = await postWebhook(body, wrongSig);
    expectError(res, 400);
  });
});