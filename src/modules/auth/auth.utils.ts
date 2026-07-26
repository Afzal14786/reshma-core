import jwt, { SignOptions } from "jsonwebtoken";
import { Response } from "express";
import env from "@config/env";
import { Types } from "mongoose";

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
  return jwt.sign({ id: userId }, env.JWT_ACCESS_SECRET, options);
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
  return jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, options);
};

/**
 * Securely attaches the Access Token to the Express Response object.
 * * * ARCHITECTURE NOTE:
 * While we primarily return the Access Token in the JSON body, attaching it as
 * a signed cookie provides an extra layer of CSRF/XSS protection for Web clients.
 */
export const setAccessCookie = (res: Response, accessToken: string): void => {
  res.cookie("jwt", accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "none",
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
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace("d", "")) || 7;
  const expirationMs = days * 24 * 60 * 60 * 1000;

  res.cookie("refreshToken", refreshToken, {
    expires: new Date(Date.now() + expirationMs),
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "none",
    signed: true,
  });
};

/**
 * Instantly invalidates the refresh session on the client's browser.
 * Overwrites the existing cookie with a dummy value that expires immediately.
 */
export const clearRefreshCookie = (res: Response): void => {
  const clearOptions = {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    signed: true,
  } as const;

  res.cookie("refreshToken", "loggedout", clearOptions);
  res.cookie("jwt", "loggedout", clearOptions);
};
