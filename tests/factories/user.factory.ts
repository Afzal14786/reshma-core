// ──────────────────────────────────────────────
// User factory for unit tests
// Produces plain objects matching the IUser shape.
// All methods are jest.fn() so tests can assert call counts.
// ──────────────────────────────────────────────

import { Types } from "mongoose";

export interface UserOverrides {
  _id?: Types.ObjectId;
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  role?: "ADMIN" | "USER";
  authProvider?: "LOCAL" | "GOOGLE";
  isEmailVerified?: boolean;
  isActive?: boolean;
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
}

export function buildUser(overrides: UserOverrides = {}) {
  const user: Record<string, unknown> = {
    _id: overrides._id ?? new Types.ObjectId(),
    firstname: overrides.firstname ?? "Test",
    lastname: overrides.lastname ?? "User",
    email: overrides.email ?? "test@example.com",
    password: overrides.password ?? "hashed_correct_password",
    role: overrides.role ?? "USER",
    authProvider: overrides.authProvider ?? "LOCAL",
    isEmailVerified: overrides.isEmailVerified ?? true,
    isActive: overrides.isActive ?? true,
    isTwoFactorEnabled: overrides.isTwoFactorEnabled ?? false,
    twoFactorSecret: overrides.twoFactorSecret,
    twoFactorBackupCodes: overrides.twoFactorBackupCodes ?? [],
    failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    lockUntil: overrides.lockUntil ?? null,
    lastLogin: new Date(),
    loyaltyPoints: 0,
    addresses: [],
    wishlist: [],
    preferences: {
      newsletter: true,
      smsAlerts: true,
      privacyPolicyAcceptedAt: new Date(),
    },
  };

  user.comparePassword = jest.fn(
    async (candidate: string) =>
      candidate === "CorrectPass123!" || candidate === "correct_password",
  );
  user.save = jest.fn(async function (this: unknown) {
    return this;
  });
  user.toJSON = jest.fn(function (this: Record<string, unknown>) {
    const { password, __v, ...rest } = this;
    return rest;
  });

  return user;
}

export function buildVerifiedUser(overrides: UserOverrides = {}) {
  return buildUser({ ...overrides, isEmailVerified: true, isActive: true });
}

export function buildUnverifiedUser(overrides: UserOverrides = {}) {
  return buildUser({ ...overrides, isEmailVerified: false, isActive: true });
}
