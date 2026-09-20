import crypto from "crypto";
import {
  verifyRazorpaySignature,
  verifyWebhookEvent,
} from "@modules/orders/payment.utils";
import env from "@config/env";

describe("verifyRazorpaySignature", () => {
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";

  const sign = (order: string, payment: string): string =>
    crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${order}|${payment}`)
      .digest("hex");

  it("returns true for a genuine signature", () => {
    const signature = sign(orderId, paymentId);
    expect(verifyRazorpaySignature(orderId, paymentId, signature)).toBe(true);
  });

  it("returns false when the signature is tampered", () => {
    const signature = sign(orderId, paymentId);
    const tampered =
      signature.slice(0, -1) + (signature.slice(-1) === "0" ? "1" : "0");
    expect(verifyRazorpaySignature(orderId, paymentId, tampered)).toBe(false);
  });

  it("returns false when the order ID is substituted", () => {
    const signature = sign(orderId, paymentId);
    expect(
      verifyRazorpaySignature("order_attacker", paymentId, signature),
    ).toBe(false);
  });

  it("returns false when the payment ID is substituted", () => {
    const signature = sign(orderId, paymentId);
    expect(verifyRazorpaySignature(orderId, "pay_attacker", signature)).toBe(
      false,
    );
  });

  it("returns false for an empty signature", () => {
    expect(verifyRazorpaySignature(orderId, paymentId, "")).toBe(false);
  });
});

describe("verifyWebhookEvent", () => {
  const rawBody = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { amount: 50000 } } },
  });

  const sign = (body: string): string =>
    crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

  it("returns true for a genuine webhook signature", () => {
    expect(verifyWebhookEvent(rawBody, sign(rawBody))).toBe(true);
  });

  it("returns false when the body is tampered (amount changed)", () => {
    const signature = sign(rawBody);
    const tampered = rawBody.replace("50000", "1");
    expect(verifyWebhookEvent(tampered, signature)).toBe(false);
  });

  it("returns false for a random hex signature", () => {
    expect(verifyWebhookEvent(rawBody, "deadbeef")).toBe(false);
  });

  it("returns false for an empty signature", () => {
    expect(verifyWebhookEvent(rawBody, "")).toBe(false);
  });
});
