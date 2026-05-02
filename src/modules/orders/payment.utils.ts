import crypto from "crypto";
import env from "@config/env"; // Adjust path if necessary

/**
 * @method verifyRazorpaySignature
 * @description Verifies the frontend payment success payload.
 * Prevents malicious users from spoofing successful payments via the client.
 */
export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string,
): boolean => {
  const text = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");

  return generatedSignature === signature;
};

/**
 * @method verifyWebhookEvent
 * @description Verifies server-to-server webhook pings.
 * Prevents attackers from firing fake "order.paid" webhooks to your endpoint.
 */
export const verifyWebhookEvent = (
  rawBody: string,
  signature: string,
): boolean => {
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};
