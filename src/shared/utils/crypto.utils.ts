import { timingSafeEqual } from "crypto";

/**
 * Securely compares two strings in constant time to prevent timing attacks.
 *
 * @param a - The first string (e.g., the computed HMAC signature)
 * @param b - The second string (e.g., the received webhook signature)
 * @returns true if the strings match, false otherwise
 *
 * ARCHITECTURE NOTE:
 * This function guarantees constant-time execution. Even if the string lengths
 * differ, we return false without early-exiting based on character comparisons.
 * This is critical for webhook HMAC verification where attackers can measure
 * response times to brute-force signatures.
 */
export const safeCompare = (a: string, b: string): boolean => {
  // Guard against null/undefined inputs
  if (!a || !b) {
    return false;
  }

  // If lengths differ, return false.
  // For HMAC hex strings (Razorpay, Shiprocket webhooks), length is always fixed,
  // so this check doesn't leak variable-length info.
  if (a.length !== b.length) {
    return false;
  }

  try {
    // Convert to buffers. timingSafeEqual throws if lengths differ,
    // but we already checked lengths above as a defensive measure.
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    // Any error (e.g., invalid encoding) means the strings are not equal.
    return false;
  }
};
