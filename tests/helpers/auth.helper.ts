// ──────────────────────────────────────────────
// Auth helpers for integration tests
// ──────────────────────────────────────────────

import { Types } from "mongoose";
import { User } from "@modules/users/user.model";
import { redisClient } from "@config/redis";
import { signAccessToken, signRefreshToken } from "@modules/auth/auth.utils";

export interface CreateUserOptions {
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
  role?: "USER" | "ADMIN";
}

/**
 * Creates a verified user directly in the DB.
 * Bypasses OTP for tests that just need an authenticated session.
 */
export async function createVerifiedUser(opts: CreateUserOptions = {}) {
  const email = opts.email ?? `user-${Date.now()}-${Math.random()}@test.com`;
  const password = opts.password ?? "Password123!";

  const user = await User.create({
    firstname: opts.firstname ?? "Test",
    lastname: opts.lastname ?? "User",
    email,
    password,
    authProvider: "LOCAL",
    isEmailVerified: opts.isEmailVerified ?? true,
    isActive: opts.isActive ?? true,
    role: opts.role ?? "USER",
    preferences: {
      newsletter: true,
      smsAlerts: true,
      privacyPolicyAcceptedAt: new Date(),
    },
  });

  return { user, plainPassword: password };
}

/**
 * Creates a user and returns their access token.
 */
export async function createUserWithToken(opts: CreateUserOptions = {}) {
  const { user, plainPassword } = await createVerifiedUser(opts);
  const accessToken = signAccessToken(user._id as Types.ObjectId);
  const refreshToken = signRefreshToken(user._id as Types.ObjectId);
  return { user, accessToken, refreshToken, plainPassword };
}

/**
 * Puts a user ID → OTP mapping in Redis for verify-otp tests.
 */
export async function seedOtpInRedis(email: string, otp: string): Promise<void> {
  await redisClient.setEx(`otp:${email}`, 600, otp);
}

/**
 * Cleans up auth-related Redis keys between tests.
 */
export async function clearAuthRedisKeys(): Promise<void> {
  const keys = await redisClient.keys("otp:*");
  const blacklist = await redisClient.keys("blacklist:*");
  const pwdReset = await redisClient.keys("pwd_reset:*");
  const attempts = await redisClient.keys("otp_attempts:*");

  const all = [...keys, ...blacklist, ...pwdReset, ...attempts];
  if (all.length > 0) {
    await redisClient.del(all);
  }
}