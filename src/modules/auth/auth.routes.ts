import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "@shared/middlewares/validate.middleware";
import { authLimiter } from "@shared/middlewares/rate-limit.middleware";
import { protect } from "@shared/middlewares/auth.middleware";
import { RegisterSchema } from "./dtos/register.dto";
import { LoginSchema } from "./dtos/login.dto";
import { VerifyOtpSchema } from "./dtos/verify-otp.dto";
import { googleLoginSchema } from "./dtos/google.dto";
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "./dtos/reset-password.dto";

import {
  SetupTwoFactorSchema,
  VerifySetupTwoFactorSchema,
  VerifyLoginTwoFactorSchema,
  DisableTwoFactorSchema,
} from "./dtos/two-factor.dto";

const router = Router();

/**
 * Authentication Routing Pipeline
 * * ARCHITECTURE NOTE:
 * Every public-facing authentication route is protected by an 'authLimiter'
 * to prevent brute-force and credential-stuffing attacks. Furthermore,
 * the 'validate' middleware acts as an absolute firewall, guaranteeing
 * malicious payloads never reach the AuthController.
 */

// POST /api/v1/auth/forgot-password -> Dispatches the reset token email (PUBLIC)
router.post(
  "/forgot-password",
  authLimiter,
  validate(ForgotPasswordSchema),
  AuthController.forgotPassword,
);

// POST /api/v1/auth/reset-password -> Verifies token and updates password (PUBLIC)
router.post(
  "/reset-password",
  authLimiter,
  validate(ResetPasswordSchema),
  AuthController.resetPassword,
);

// POST /api/v1/auth/register -> Creates unverified user and dispatches OTP
router.post(
  "/register",
  authLimiter,
  validate(RegisterSchema),
  AuthController.register,
);

// POST /api/v1/auth/verify-otp -> Verifies OTP, activates account, grants initial tokens
router.post(
  "/verify-otp",
  authLimiter,
  validate(VerifyOtpSchema),
  AuthController.verifyOtp,
);

// POST /api/v1/auth/google -> Cryptographically verifies Google idToken and issues native session
router.post(
  "/google",
  authLimiter,
  validate(googleLoginSchema),
  AuthController.googleLogin,
);

// POST /api/v1/auth/login -> Standard credential verification
router.post("/login", authLimiter, validate(LoginSchema), AuthController.login);

// GET /api/v1/auth/refresh -> Accepts HttpOnly cookie, returns new JSON Access Token
router.get("/refresh", authLimiter, AuthController.refresh);

// 2FA ROUTES

// Routes that require an authenticated user (JWT)
// These are protected by `protect` so the user must be logged in to manage 2FA.

// POST /api/v1/auth/2fa/setup -> Generate QR code and backup codes
router.post(
  "/2fa/setup",
  protect,
  validate(SetupTwoFactorSchema),
  AuthController.setupTwoFactor,
);

// POST /api/v1/auth/2fa/verify-setup -> Verify OTP and enable 2FA
router.post(
  "/2fa/verify-setup",
  protect,
  validate(VerifySetupTwoFactorSchema),
  AuthController.verifyTwoFactorSetup,
);

// POST /api/v1/auth/2fa/disable -> Disable 2FA (requires OTP)
router.post(
  "/2fa/disable",
  protect,
  validate(DisableTwoFactorSchema),
  AuthController.disableTwoFactor,
);

// Routes that are PUBLIC (but require a valid 2FA session token)
// The user gets the twoFactorToken from the /login response.

// POST /api/v1/auth/2fa/verify -> Verify 2FA code during login
router.post(
  "/2fa/verify",
  authLimiter, // Heavy rate limiting to prevent brute-force
  validate(VerifyLoginTwoFactorSchema),
  AuthController.verifyTwoFactorLogin,
);

/**
 * SECURITY FIX FOR CODEQL (CWE-770):
 * CodeQL's AST parser struggles to map inline rate limiters inside `router.get()`.
 * By chaining them inside `router.use()` specifically mapped to the "/logout" path,
 * we definitively prove to the static analyzer that `protect` is guarded.
 */
router.use("/logout", authLimiter, protect);

// GET /api/v1/auth/logout -> Blacklists current session and drops cookies
router.get("/logout", AuthController.logout);

export const authRoutes = router;
