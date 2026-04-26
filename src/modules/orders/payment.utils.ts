import crypto from "crypto";
import env from "@config/env";

/**
 * Cryptographic Handshake Verification (Frontend Return)
 * * SECURITY NOTE:
 * CodeQL requires mathematical proof of origin before granting financial state changes.
 * This verifies the HMAC SHA-256 signature returned by the frontend, ensuring the user
 * hasn't spoofed a "Success" network response via browser DevTools.
 */
export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  razorpaySignature: string,
): boolean => {
  const generatedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === razorpaySignature;
};

/**
 * Server-to-Server Webhook Verification
 * Defends the async webhook endpoint against unauthorized external pings.
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
