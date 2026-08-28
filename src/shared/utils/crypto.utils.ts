import {
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import env from "@config/env";

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

/**
 * Encrypts text using AES-256-GCM.
 * Returns a base64 string containing: iv:authTag:encryptedData
 */
export const encrypt = (text: string): string => {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag().toString("base64");
  return `${iv.toString("base64")}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a base64 string encrypted with the above function.
 */
export const decrypt = (encryptedData: string): string => {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  const [ivBase64, authTagBase64, encryptedText] = encryptedData.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedText) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};
