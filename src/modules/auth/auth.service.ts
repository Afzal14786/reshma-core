import mongoose from "mongoose";
import { User } from "@modules/users/user.model";
import { IUser } from "@modules/users/interfaces/user.interface";
import { RegisterInput } from "./dtos/register.dto";
import { LoginInput } from "./dtos/login.dto";
import { AppError } from "@shared/utils/app-error";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import logger from "@config/logger";
import { redisClient } from "@config/redis";
import jwt, { decode } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import env from "@config/env";
import crypto from "crypto";
import { NotificationService } from "../notifications/notification.service";
import { signAccessToken, signRefreshToken } from "./auth.utils";
import { encrypt, decrypt } from "@shared/utils/crypto.utils";
import speakeasy from "speakeasy";
import bcrypt from "bcrypt";
import {
  generateTwoFactorSecret,
  signTwoFactorToken,
  verifyTwoFactorToken,
} from "./auth.utils";
import QRCode from "qrcode";
import type { BookModule } from "@faker-js/faker";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Authentication Service (Domain Layer)
 * * * ARCHITECTURE NOTE:
 * This class encapsulates the core business logic of the authentication flow.
 * It is deliberately agnostic to HTTP constraints (Request/Response objects).
 * It interacts exclusively with MongoDB (Persistence), Redis (Caching/Blacklisting),
 * and the Notification Service (Queues).
 */
export class AuthService {
  /**
   * Phase 1 of Registration: Captures user intent and issues an OTP.
   * * * DESIGN DECISION: Safe Collision Recovery
   * If a user registers but closes their browser before entering the OTP, their
   * account exists in a 'limbo' (unverified) state. If they attempt to register
   * again tomorrow, we do NOT throw a 'Conflict' error. Instead, we safely overwrite
   * their previous credentials and issue a fresh OTP, optimizing the UX.
   */
  public static async registerLocal(
    data: RegisterInput,
  ): Promise<{ user: IUser; message: string }> {
    let targetUser = await User.findOne({ email: { $eq: String(data.email) } });

    if (targetUser) {
      // Hard block if the account is already verified and active
      if (targetUser.isEmailVerified) {
        logger.warn(`Registration failed: Verified email already exists`, {
          email: data.email,
        });
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          "An account with this email already exists",
        );
      }

      // Safe Collision Recovery for unverified accounts
      targetUser.firstname = data.firstname;
      targetUser.lastname = data.lastname;
      targetUser.password = data.password;
      if (data.phone) targetUser.phone = data.phone;

      // LEGAL & COMPLIANCE: Stamp the exact timestamp of Privacy Policy Consent
      targetUser.preferences = {
        newsletter: targetUser.preferences?.newsletter ?? true,
        smsAlerts: targetUser.preferences?.smsAlerts ?? true,
        privacyPolicyAcceptedAt: new Date(),
      };

      await targetUser.save();
      logger.info(`Updated existing unverified user during registration`, {
        userId: targetUser._id,
      });
    } else {
      // New account initialization
      const userData = {
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        password: data.password,
        authProvider: "LOCAL" as const,
        isEmailVerified: false,
        // LEGAL & COMPLIANCE: Initial Consent Stamping
        preferences: {
          newsletter: true,
          smsAlerts: true,
          privacyPolicyAcceptedAt: new Date(),
        },
        ...(data.phone && { phone: data.phone }),
      };
      targetUser = await User.create(userData);
      logger.info(`New unverified user created`, { userId: targetUser._id });
    }

    // Generate a cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const TTL_SECONDS = 600; // 10 minutes
    const expiryTimeIso = new Date(
      Date.now() + TTL_SECONDS * 1000,
    ).toISOString();

    // Cache in Redis with a strict 10-minute (600s) TTL
    await redisClient.setEx(`otp:${targetUser.email}`, TTL_SECONDS, otp);

    // Hand off to the background worker to dispatch the HTML email
    await NotificationService.sendOtpEmail(
      targetUser.email,
      targetUser.firstname,
      otp,
      expiryTimeIso,
    );

    return {
      user: targetUser,
      message:
        "Registration initiated. Please check your email for the verification OTP.",
    };
  }

  /**
   * Phase 2 of Registration: Verifies the OTP and activates the account.
   * * * SECURITY NOTE: Replay Attack Mitigation
   */
  public static async verifyEmailOtp(
    email: string,
    otp: string,
  ): Promise<IUser> {
    /**
     * implementing rate limiting per email for OTP verificaion
     */
    const attempKey: string = `otp_attempts:${email}`;
    const attempts: number = await redisClient.incr(attempKey);

    if (attempts == 1) {
      await redisClient.expire(attempKey, 900); // 15 minute window
    }

    if (attempts > 5) {
      logger.warn(`otp brute force detected`, { email });
      throw new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        "Too many failed OTP attempts. Please request a new OTP and wait 15 minutes",
      );
    }

    const storedOtp = await redisClient.get(`otp:${email}`);

    if (!storedOtp || storedOtp !== otp) {
      logger.warn(`Failed OTP verification attempt`, { email });
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Invalid or expired OTP. Please request a new one.",
      );
    }

    // Activate the account in the database
    const user = await User.findOneAndUpdate(
      { email: { $eq: String(email) } },
      { isEmailVerified: true },
      { new: true },
    );

    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found.");

    // Replay Attack Prevention
    await redisClient.del(`otp:${email}`);

    // Trigger the asynchronous onboarding sequence (Email + In-App Dashboard Alert)
    await NotificationService.triggerWelcome(
      user._id,
      user.email,
      user.firstname,
    );

    logger.info(`User email verified successfully`, { userId: user._id });
    return user;
  }

  /**
   * Authenticates an existing, fully verified user.
   */
  public static async loginLocal(data: LoginInput): Promise<IUser> {
    // The password field has 'select: false' in the Schema. We must explicitly request it here.
    const user = await User.findOne({
      email: { $eq: String(data.email) },
    }).select("+password");

    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Incorrect email or password",
      );
    }

    // check if the account is already locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const waitMinute = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );
      throw new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        `Account temporarily locked. Please try again in ${waitMinute} minutes`,
      );
    }

    const isMatch: boolean = await user.comparePassword(data.password);

    if (!isMatch) {
      const attempts: number = (user.failedLoginAttempts || 0) + 1;
      const updateAttempts: Partial<IUser> = {
        failedLoginAttempts: attempts,
        lockUntil: null,
      };

      if (attempts >= 5) {
        updateAttempts.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        logger.warn(`Account locked due to multiple failed attempts`, {
          email: data.email,
          attempts,
        });
      }

      await User.updateOne({ _id: user._id }, { $set: updateAttempts });

      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Incorrect email and password",
      );
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      },
    );

    // Infrastructure Gatekeepers
    if (!user.isEmailVerified)
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        "Please verify your email address before logging in.",
      );
    if (!user.isActive)
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        "This account has been deactivated. Please contact support.",
      );

    // Update session telemetry without triggering heavy pre-save hooks
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    logger.info(`User logged in successfully`, { userId: user._id });
    return user;
  }

  /**
   * Rehydrates an expired Access session using a valid Refresh Token.
   */
  public static async refreshSession(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // first check blacklist
      const isBlacklisted = await redisClient.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        logger.warn(`Attempted refresh with blacklisted token`);
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "Session revoked. Please log in again.",
        );
      }

      // verify the old
      const decoded = jwt.verify(
        refreshToken,
        env.JWT_REFRESH_SECRET,
      ) as jwt.JwtPayload;

      const user = await User.findOne({ _id: { $eq: String(decoded.id) } });
      if (!user)
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "The user belonging to this token no longer exists.",
        );
      if (!user.isActive) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          "This account has been deactivated.",
        );
      }

      // blacklist the old refresh token
      if (decoded.exp) {
        const timeToLive: number = decoded.exp - Math.floor(Date.now() / 1000);
        if (timeToLive > 0) {
          await redisClient.setEx(
            `blacklist:${refreshToken}`,
            timeToLive,
            "revoked",
          );
        }
      }

      const newAccessToken = signAccessToken(user._id);
      const newRefreshToken = signRefreshToken(user._id);

      logger.info(`Refresh token rotated successfully`, { userId: user._id });

      // Issue a fresh 15-minute Access Token
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Invalid or expired refresh token. Please log in again.",
      );
    }
  }

  /**
   * Stateless Google OAuth Verification & Upsert
   * * * ARCHITECTURE NOTE:
   * We utilize the "Client-Side Token Flow" to maintain our stateless JWT architecture.
   */
  public static async loginWithGoogle(idToken: string) {
    try {
      // 1. Cryptographic Verification: Ask Google if this token is genuinely theirs
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new AppError(401, "Invalid or malformed Google Token payload");
      }

      const { email, given_name, family_name } = payload;
      const sanitizedEmail = email.toLowerCase();

      // 2. State Management & Collision Recovery
      let user = await User.findOne({ email: { $eq: String(sanitizedEmail) } });

      if (user) {
        // 2a. Infrastructure Gatekeeper
        if (!user.isActive) {
          throw new AppError(
            403,
            "This account has been deactivated. Please contact support.",
          );
        }

        // 2b. Safe Account Merging (UX Optimization)
        if (!user.isEmailVerified) {
          user.isEmailVerified = true;
          await user.save({ validateBeforeSave: false });
        }

        return user;
      }

      // 3. New User Onboarding
      user = await User.create({
        firstname: given_name || "User",
        lastname: family_name || "",
        email: sanitizedEmail,
        authProvider: "GOOGLE",
        isEmailVerified: true, // Implicitly true: Google already verified their identity
        // LEGAL & COMPLIANCE: Implicit consent tracking for OAuth onboarding
        preferences: {
          newsletter: true,
          smsAlerts: true,
          privacyPolicyAcceptedAt: new Date(),
        },
      });

      // Trigger the asynchronous onboarding Welcome Sequence
      await NotificationService.triggerWelcome(
        user._id,
        user.email,
        user.firstname,
      );

      return user;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Google authentication failed or token expired. Please try again.",
      );
    }
  }

  /**
   * PUBLIC RESET STAGE 1: Initiates the Password Reset Flow
   * Used when a user is locked out and clicks "Forgot Password".
   */
  public static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email: { $eq: email } });

    // SECURITY BEST PRACTICE: Prevent Email Enumeration.
    // Return silently if user doesn't exist, preventing attackers from guessing emails.
    if (!user) return;

    if (user.authProvider === "GOOGLE") {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "OAuth accounts do not use passwords. Please log in with Google.",
      );
    }

    // Generate a 64-character cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store in Redis with a 15-minute TTL
    const TTL_SECONDS = 900;
    await redisClient.setEx(
      `pwd_reset:${hashedToken}`,
      TTL_SECONDS,
      user._id.toString(),
    );

    // Dispatch the Reset Email
    await NotificationService.sendPasswordReset(
      user.email,
      user.firstname,
      resetToken,
    );
  }

  /**
   * PUBLIC RESET STAGE 2: Verifies Token and Updates Password
   */
  public static async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const redisKey = `pwd_reset:${hashedToken}`;

    const userId = await redisClient.get(redisKey);

    if (!userId) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Reset link is invalid or has expired. Please request a new one.",
      );
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found.");

    // Update password (Mongoose pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Destroy the token to prevent reuse
    await redisClient.del(redisKey);

    // Dispatch Security Alert
    await NotificationService.sendPasswordUpdateConfirmation(
      user._id as mongoose.Types.ObjectId,
      user.email,
      user.firstname,
    );
  }

  /**
   * Terminates a session by blacklisting the Refresh Token in Redis.
   */
  public static async logoutUser(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        env.JWT_REFRESH_SECRET,
      ) as jwt.JwtPayload;

      if (decoded.exp) {
        const timeToLive = decoded.exp - Math.floor(Date.now() / 1000);
        if (timeToLive > 0) {
          await redisClient.setEx(
            `blacklist:${refreshToken}`,
            timeToLive,
            "revoked",
          );
          logger.info(`Refresh token blacklisted successfully`, {
            tokenSnippet: refreshToken.substring(0, 15),
          });
        }
      }
    } catch (error) {
      logger.warn(
        `Attempted to blacklist invalid or expired refresh token during logout`,
      );
    }
  }

  /**
   * TWO-FACTOR AUTHENTICATION (TOTP) METHODS
   */

  /**
   * Step 1: Generate 2FA setup data (Secret, QR Code, Backup Codes)
   * @param userId - The ID of the admin user enabling 2FA.
   * @returns { secret, qrCodeDataURL, backupCodes }
   */
  public static async generateTwoFactorSetup(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    // If already enabled, prevent re-generation without disabling first
    if (user.isTwoFactorEnabled) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        "2FA is already enabled for this account.",
      );
    }

    // Generate the TOTP secret and backup codes
    const { secret, otpauthUrl, backupCodes } = generateTwoFactorSecret(
      user.email,
    );

    // Encrypt the secret before storing (AES-256-GCM)
    const encryptedSecret = encrypt(secret);

    // Hash the backup codes (bcrypt) before storing
    const saltRounds = 10;
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, saltRounds)),
    );

    // Save the encrypted secret and hashed backup codes to the user document
    user.twoFactorSecret = encryptedSecret;
    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save({ validateBeforeSave: false });

    // Generate QR Code as a Data URL (for the frontend to display)

    if (!otpauthUrl) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to generate OTP authentication url",
      );
    }

    const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);

    // Return the raw backup codes (they are shown only ONCE to the user)
    // We return the encrypted secret? No, we return the *actual* base32 secret for the frontend to display?
    // Wait, the frontend doesn't need the secret. The user scans the QR code.
    // The frontend only needs the QR code image and the backup codes.
    return {
      qrCode: qrCodeDataURL,
      backupCodes, // These are the RAW codes the user must save.
      // The secret is already saved in the DB. We don't send it back to the client.
    };
  }

  /**
   * Step 2: Verify the TOTP and enable 2FA for the user.
   * @param userId - The ID of the admin user.
   * @param token - The 6-digit TOTP from the authenticator app.
   */
  public static async enableTwoFactor(userId: string, token: string) {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    if (user.isTwoFactorEnabled) {
      throw new AppError(HTTP_STATUS.CONFLICT, "2FA is already enabled.");
    }

    if (!user.twoFactorSecret) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "2FA setup not initiated. Please generate a secret first.",
      );
    }

    // Decrypt the stored secret
    let decryptedSecret: string;
    try {
      decryptedSecret = decrypt(user.twoFactorSecret);
    } catch (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Corrupted 2FA secret. Please reset 2FA.",
      );
    }

    // Verify the TOTP
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token,
      window: 1, // Allow 1 step (30 seconds) of clock skew for network latency
    });

    if (!isValid) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Invalid OTP. Please try again.",
      );
    }

    // Enable 2FA
    user.isTwoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    logger.info(`2FA enabled for user ${userId}`);
    return {
      success: true,
      message: "Two-factor authentication enabled successfully.",
    };
  }

  /**
   * Step 3: Verify 2FA during login.
   * @param userId - The ID of the user attempting to log in.
   * @param token - The 6-digit TOTP from the authenticator app.
   * @param backupCode - Optional backup code (if the user lost their phone).
   * @param twoFactorToken - The short-lived JWT from the login step.
   * @returns { accessToken, refreshToken } - The final session tokens.
   */

  public static async verifyTwoFactorLogin(
    userId: string,
    token: string,
    backupCode: string | undefined,
    twoFactorToken: string,
  ) {
    // 1. Verify the short-lived 2FA token
    const decoded = verifyTwoFactorToken(twoFactorToken);
    if (decoded.id !== userId) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Invalid 2FA session.");
    }

    // 2. Fetch the user with the encrypted secret and backup codes
    const user = await User.findById(userId).select(
      "+twoFactorSecret +twoFactorBackupCodes",
    );
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    if (!user.isTwoFactorEnabled) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "2FA is not enabled for this account.",
      );
    }

    // 3. Handle Backup Code flow
    if (backupCode) {
      const safeBackupCode: string = backupCode;
      if (
        !user.twoFactorBackupCodes ||
        user.twoFactorBackupCodes.length === 0
      ) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          "No backup codes remaining. Please use your authenticator app.",
        );
      }

      const codes = user.twoFactorBackupCodes!;
      let foundIndex = -1;
      for (const [index, code] of codes.entries()) {
        const isMatch = await bcrypt.compare(safeBackupCode, code);
        if (isMatch) {
          foundIndex = index;
          break;
        }
      }

      if (foundIndex === -1) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, "Invalid backup code.");
      }

      codes.splice(foundIndex, 1);
      user.twoFactorBackupCodes = codes;
      await user.save({ validateBeforeSave: false });

      logger.info(
        `Backup code used for user ${userId}. ${codes.length} codes remaining.`,
      );
    } else {
      // 4. Handle Standard TOTP flow
      if (!user.twoFactorSecret) {
        throw new AppError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "2FA secret missing.",
        );
      }

      const decryptedSecret = decrypt(user.twoFactorSecret);
      const isValid = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: "base32",
        token,
        window: 1,
      });

      if (!isValid) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          "Invalid 2FA code. Please try again.",
        );
      }
    }

    // 5. Issue final Access & Refresh Tokens
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    logger.info(`2FA login successful for user ${userId}`);

    return { accessToken, refreshToken };
  }

  /**
   * Step 4: Disable 2FA (requires valid TOTP)
   * @param userId - The ID of the user.
   * @param token - The 6-digit TOTP from the authenticator app.
   */
  public static async disableTwoFactor(userId: string, token: string) {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");

    if (!user.isTwoFactorEnabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "2FA is not enabled.");
    }

    if (!user.twoFactorSecret) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "2FA secret missing.",
      );
    }

    const decryptedSecret = decrypt(user.twoFactorSecret);
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!isValid) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        "Invalid OTP. Cannot disable 2FA.",
      );
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { isTwoFactorEnabled: false },
        $unset: {
          twoFactorSecret: 1,
          twoFactorBackupCodes: 1,
        },
      },
    );

    logger.info(`2FA disabled for user ${userId}`);
    return {
      success: true,
      message: "Two-factor authentication disabled successfully.",
    };
  }
}
