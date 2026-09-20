import jwt, { SignOptions } from "jsonwebtoken";
import { Response } from "express";
import env from "@config/env";
import { Types } from "mongoose";
import speakeasy from "speakeasy";
import { AppError } from "@shared/utils/app-error";
import crypto from "crypto";
import { HTTP_STATUS } from "@shared/constant/http-codes";
/**
 * Authentication Cryptography Utilities
 * * * ARCHITECTURE NOTE:
 * We isolate token generation and cookie management into a dedicated utility file.
 * This ensures the DRY principle is maintained when we eventually implement
 * Social Logins (Google OAuth), as those controllers will also need to issue
 * Access and Refresh tokens without duplicating this logic.
 */

/**
 * Generates a short-lived Access Token.
 * @param userId - The MongoDB ObjectId of the user.
 * @returns A cryptographically signed JWT string.
 * * SECURITY NOTE: This token should be returned in the JSON response body and
 * kept entirely within the frontend's RAM (e.g., React Context), never LocalStorage.
 */
export const signAccessToken = (userId: Types.ObjectId): string => {
  const options: SignOptions = {};
  if (env.JWT_ACCESS_EXPIRES_IN) {
    // NonNullable forces the TypeScript compiler to recognize this is strictly a string/number
    options.expiresIn = env.JWT_ACCESS_EXPIRES_IN as NonNullable<
      SignOptions["expiresIn"]
    >;
  }
  return jwt.sign(
    { id: userId.toString(), jti: crypto.randomUUID() },
    env.JWT_ACCESS_SECRET,
    options,
  );
};

/**
 * Generates a long-lived Refresh Token.
 * @param userId - The MongoDB ObjectId of the user.
 * @returns A cryptographically signed JWT string.
 */
export const signRefreshToken = (userId: Types.ObjectId): string => {
  const options: SignOptions = {};
  if (env.JWT_REFRESH_EXPIRES_IN) {
    options.expiresIn = env.JWT_REFRESH_EXPIRES_IN as NonNullable<
      SignOptions["expiresIn"]
    >;
  }
  return jwt.sign(
    { id: userId.toString(), jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    options,
  );
};

/**
 * Securely attaches the Access Token to the Express Response object.
 * * * ARCHITECTURE NOTE:
 * While we primarily return the Access Token in the JSON body, attaching it as
 * a signed cookie provides an extra layer of CSRF/XSS protection for Web clients.
 */
export const setAccessCookie = (res: Response, accessToken: string): void => {
  const isProduction: boolean = env.NODE_ENV === "production";
  res.cookie("jwt", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    signed: true,
    maxAge: 15 * 60 * 1000, // 15 minutes
  } as const);
};

/**
 * Securely attaches the Refresh Token to the Express Response object.
 * @param res - The Express Response object.
 * @param refreshToken - The generated Refresh JWT.
 * * SECURITY NOTE:
 * 'httpOnly: true' physically blocks the browser's JavaScript engine from reading the cookie,
 * completely nullifying Cross-Site Scripting (XSS) payload attacks.
 */
export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  const isProduction: boolean = env.NODE_ENV === "production";
  const refreshMaxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

  res.cookie("refreshToken", refreshToken, {
    maxAge: refreshMaxAgeMs,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    signed: true,
  });
};

/**
 * Instantly invalidates the refresh session on the client's browser.
 * Overwrites the existing cookie with a dummy value that expires immediately.
 */
export const clearRefreshCookie = (res: Response): void => {
  const isProduction: boolean = env.NODE_ENV === "production";
  const clearOptions = {
    maxAge: 0,
    httpOnly: true,
    secure: isProduction ? true : false,
    sameSite: "lax",
    signed: true,
  } as const;

  res.cookie("refreshToken", "loggedout", clearOptions);
  res.cookie("jwt", "loggedout", clearOptions);
};

/**
 * TWO-FACTOR AUTHENTICATION UTILITIES
 */

/**
 * Generates a short-lived JWT for the 2FA login challenge.
 * Expires in 5 minutes.
 */
export const signTwoFactorToken = (userId: Types.ObjectId): string => {
  return jwt.sign(
    { id: userId.toString(), purpose: "2fa" },
    env.JWT_ACCESS_SECRET, // Reuse access secret, or create a dedicated ONE
    { expiresIn: "5m" },
  );
};

/**
 * Verifies the 2FA challenge token.
 * Returns the decoded payload if valid, otherwise throws.
 */
export const verifyTwoFactorToken = (token: string): jwt.JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (decoded.purpose !== "2fa") {
      throw new Error("Invalid token purpose");
    }
    return decoded;
  } catch (error) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      "Invalid or expired 2FA session. Please log in again.",
    );
  }
};

/**
 * Generates a new TOTP secret, QR code URL, and backup codes.
 */
export const generateTwoFactorSecret = (
  email: string,
  issuer: string = "Reshma Boutique",
) => {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${email})`,
    length: 20, // 20 bytes = 160-bit secret
  });

  // Generate 8 single-use backup codes (10 characters each)
  const backupCodes: string[] = [];
  for (let i = 0; i < 8; i++) {
    backupCodes.push(crypto.randomBytes(5).toString("hex").toUpperCase());
  }

  return {
    secret: secret.base32, // The base32 secret to encrypt and store
    otpauthUrl: secret.otpauth_url, // The URL for QR code generation
    backupCodes, // Raw codes to show the user (will be hashed before storage)
  };
};
