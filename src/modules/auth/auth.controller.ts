import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import {
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from "./auth.utils";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { RegisterInput } from "./dtos/register.dto";
import { LoginInput } from "./dtos/login.dto";
import { VerifyOtpInput } from "./dtos/verify-otp.dto";
import { GoogleLoginInput } from "./dtos/google.dto";
import logger from "@config/logger";

/**
 * Authentication Controller (Presentation Layer)
 * * * ARCHITECTURE NOTE:
 * This acts strictly as an HTTP boundary layer. Its sole responsibilities are:
 * 1. Read sanitized payloads from the `req.body` (guaranteed by Zod Middlewares).
 * 2. Delegate the heavy execution to the Domain layer (`AuthService`).
 * 3. Handle Token distribution (Memory Access Token + HttpOnly Refresh Cookie).
 * 4. Dispatch a standardized `ApiResponse` back to the client.
 */
export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Initiates the registration pipeline. Returns a success message but NO tokens.
   */
  public static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = req.body as RegisterInput;
      const result = await AuthService.registerLocal(data);

      new ApiResponse(res, HTTP_STATUS.CREATED, result.message, {
        user: result.user,
      }).send();
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Validates the OTP. Upon success, opens the user's first secure session by
   * issuing both the Access and Refresh tokens.
   */
  public static async verifyOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = req.body as VerifyOtpInput;
      const user = await AuthService.verifyEmailOtp(data.email, data.otp);

      // Establish the Two-Token Session
      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      setRefreshCookie(res, refreshToken);

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Email verified successfully. Welcome!",
        { user, accessToken },
      ).send();
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Standard email/password authentication yielding a new secure session.
   */
  public static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = req.body as LoginInput;
      const user = await AuthService.loginLocal(data);

      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      setRefreshCookie(res, refreshToken);

      new ApiResponse(res, HTTP_STATUS.OK, "Login successful", {
        user,
        accessToken,
      }).send();
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/refresh
   * Silently polled by the React frontend when its in-memory Access Token expires.
   * Uses the browser-attached HttpOnly refresh cookie to grant a new Access Token.
   */
  public static async refresh(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        // Return a specific 401 message so the frontend router knows to hard-redirect to /login
        new ApiResponse(
          res,
          HTTP_STATUS.UNAUTHORIZED,
          "Session expired. Please log in.",
          null,
        ).send();
        return;
      }

      const newAccessToken = await AuthService.refreshSession(refreshToken);

      new ApiResponse(res, HTTP_STATUS.OK, "Token refreshed", {
        accessToken: newAccessToken,
      }).send();
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/google
   * Bridges the "Continue with Google" flow into our native Two-Token session architecture.
   * * * SECURITY NOTE:
   * Even though the user authenticated via Google, we instantly discard Google's session
   * and issue our own native Access (Memory) and Refresh (HttpOnly) tokens. This ensures
   * complete vendor lock-in avoidance and maintains our strict XSS/CSRF immunity.
   */
  public static async googleLogin(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = req.body as GoogleLoginInput;

      // 1. Hand off the raw ID Token to the Domain Service for cryptographic verification
      const user = await AuthService.loginWithGoogle(data.idToken);

      // 2. Establish the Native Two-Token Session
      const accessToken = signAccessToken(user._id);
      const refreshToken = signRefreshToken(user._id);

      // 3. Telemetry Update (Bypass hooks for performance)
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // 4. Secure Transport (Attach HttpOnly Cookie)
      setRefreshCookie(res, refreshToken);

      new ApiResponse(res, HTTP_STATUS.OK, "Google Login successful", {
        user,
        accessToken,
      }).send();
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/logout
   * Securely destroys the session locally (clearing cookies) and remotely (Redis Blacklist).
   */
  public static async logout(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        await AuthService.logoutUser(refreshToken);
      }

      // Command the browser to drop the HttpOnly cookie instantly
      clearRefreshCookie(res);

      logger.info(`Session securely terminated`);
      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Logged out successfully",
        null,
      ).send();
    } catch (error: unknown) {
      next(error);
    }
  }
}
