import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "@shared/middlewares/validate.middleware";
import { authLimiter } from "@shared/middlewares/rate-limit.middleware";
import { protect } from "@shared/middlewares/auth.middleware";
import { RegisterSchema } from "./dtos/register.dto";
import { LoginSchema } from "./dtos/login.dto";
import { VerifyOtpSchema } from "./dtos/verify-otp.dto";
import { googleLoginSchema } from "./dtos/google.dto";

const router = Router();

/**
 * Authentication Routing Pipeline
 * * * ARCHITECTURE NOTE:
 * Every public-facing authentication route is protected by an 'authLimiter'
 * to prevent brute-force and credential-stuffing attacks. Furthermore,
 * the 'validate' middleware acts as an absolute firewall, guaranteeing
 * malicious payloads never reach the AuthController.
 */

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

// GET /api/v1/auth/logout -> Blacklists current session and drops cookies
// Requires an active Access session to execute via the 'protect' gatekeeper.
router.get("/logout", authLimiter, protect, AuthController.logout);

export const authRoutes = router;
