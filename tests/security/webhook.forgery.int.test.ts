// ──────────────────────────────────────────────
// Webhook Forgery — HMAC and API key attacks
// ──────────────────────────────────────────────
// Verifies that the Razorpay and Shiprocket webhook endpoints reject
// forged, tampered, or unsigned payloads. An attacker who can forge
// these events can trigger refunds, ship orders, or mark them paid.

import crypto from "crypto";
import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestOrder } from "@tests/helpers/order.helper";
import env from "@config/env";
import {
  expectUnauthorized,
} from "@tests/helpers/security.helper";

const RAZORPAY_PATH = "/api/v1/orders/webhook";
const SHIPROCKET_PATH = "/api/v1/orders/shiprocket-webhook";

// ─────────────────────────────────────────────
// Razorpay webhook — HMAC signature attacks
// ─────────────────────────────────────────────

function signRazorpay(rawBody: string): string {
  return crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
}

function buildRazorpayPayload(gatewayOrderId: string) {
  return {
    event: "order.paid",
    payload: {
      payment: {
        entity: {
          id: "pay_webhook_test",
          order_id: gatewayOrderId,
        },
      },
    },
  };
}

async function postRazorpayWebhook(
  rawBody: string,
  signature?: string,
): Promise<ReturnType<typeof request.post>> {
  const req = request
    .post(RAZORPAY_PATH)
    .set("Content-Type", "application/json");
  if (signature !== undefined) {
    req.set("x-razorpay-signature", signature);
  }
  return req.send(rawBody);
}

describe("Razorpay webhook — signature verification", () => {
  it("accepts a webhook signed with the correct secret", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_valid",
    });

    const payload = buildRazorpayPayload(order.gatewayOrderId!);
    const rawBody = JSON.stringify(payload);
    const signature = signRazorpay(rawBody);

    const res = await postRazorpayWebhook(rawBody, signature);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects a webhook with a wrong signature", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_wrong_sig",
    });

    const payload = buildRazorpayPayload(order.gatewayOrderId!);
    const rawBody = JSON.stringify(payload);

    const res = await postRazorpayWebhook(rawBody, "deadbeef".repeat(8));
    expect(res.status).toBe(400);
  });

  it("rejects a webhook with no signature header", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_missing_sig",
    });

    const payload = buildRazorpayPayload(order.gatewayOrderId!);
    const rawBody = JSON.stringify(payload);

    const res = await postRazorpayWebhook(rawBody);
    expect(res.status).toBe(400);
  });

  it("rejects a webhook whose body was tampered after signing", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_tampered",
    });

    const originalPayload = buildRazorpayPayload(order.gatewayOrderId!);
    const originalBody = JSON.stringify(originalPayload);
    const validSignature = signRazorpay(originalBody);

    // Attacker modifies the amount after computing the signature
    const tampered = JSON.parse(originalBody) as Record<string, unknown>;
    (tampered.payload as Record<string, unknown>).payment = {
      entity: {
        id: "pay_attacker",
        order_id: order.gatewayOrderId,
        amount: 1,
      },
    };
    const tamperedBody = JSON.stringify(tampered);

    const res = await postRazorpayWebhook(tamperedBody, validSignature);
    expect(res.status).toBe(400);
  });

  it("rejects a webhook signed with the wrong secret", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken,
      gatewayOrderId: "order_wh_wrong_secret",
    });

    const payload = buildRazorpayPayload(order.gatewayOrderId!);
    const rawBody = JSON.stringify(payload);

    const wrongSig = crypto
      .createHmac("sha256", "wrong-webhook-secret")
      .update(rawBody)
      .digest("hex");

    const res = await postRazorpayWebhook(rawBody, wrongSig);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// Shiprocket webhook — API key attacks
// ─────────────────────────────────────────────

function buildShiprocketPayload() {
  return {
    awb: "TEST-AWB-000",
    courier_name: "Delhivery",
    current_status: "DELIVERED",
    current_status_id: 7,
    shipment_status: "DELIVERED",
    channel_order_id: "ORD-TEST-001",
  };
}

describe("Shiprocket webhook — API key verification", () => {
  it("accepts a webhook with the correct x-api-key header", async () => {
    const res = await request
      .post(SHIPROCKET_PATH)
      .set("x-api-key", env.SHIPROCKET_WEBHOOK_SECRET)
      .send(buildShiprocketPayload());

    // Order not found for the AWB, but auth passed → 200 with success
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("rejects a webhook with the wrong x-api-key", async () => {
    const res = await request
      .post(SHIPROCKET_PATH)
      .set("x-api-key", "wrong-secret")
      .send(buildShiprocketPayload());

    expectUnauthorized(res);
  });

  it("rejects a webhook with no x-api-key header", async () => {
    const res = await request
      .post(SHIPROCKET_PATH)
      .send(buildShiprocketPayload());

    expectUnauthorized(res);
  });
});