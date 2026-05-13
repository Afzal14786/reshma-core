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
