// ──────────────────────────────────────────────
// AuthService Unit Tests — v2 (leak-free)
// ──────────────────────────────────────────────

// ─── MOCKS (hoisted before imports) ───
jest.mock("@config/redis", () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    flushdb: jest.fn(),
    quit: jest.fn(),
    isOpen: true,
  },
  connectRedis: jest.fn(),
}));

jest.mock("@modules/users/user.model", () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("@modules/notifications/notification.service", () => ({
  NotificationService: {
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    triggerWelcome: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPasswordUpdateConfirmation: jest.fn().mockResolvedValue(undefined),
  },
}));

// Shared mock for verifyIdToken — created inside the factory so hoisting works
jest.mock("google-auth-library", () => {
  const verifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
    __verifyIdToken: verifyIdToken,
  };
});

jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,MOCKQR"),
}));

jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("mocksalt"),
  hash: jest.fn().mockImplementation(async (val: string) => `hashed:${val}`),
  compare: jest.fn().mockImplementation(async (val: string, hash: string) => {
    return hash === `hashed:${val}`;
  }),
}));

// ─── IMPORTS ───
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { AuthService } from "@modules/auth/auth.service";
import { User } from "@modules/users/user.model";
import { redisClient } from "@config/redis";
import { NotificationService } from "@modules/notifications/notification.service";
import { buildUser } from "@tests/factories/user.factory";
import { AppError } from "@shared/utils/app-error";
import { encrypt } from "@shared/utils/crypto.utils";
import env from "@config/env";
import * as GoogleAuth from "google-auth-library";

// ─── TYPED MOCK HANDLES ───
const mockUser = User as unknown as {
  findOne: jest.Mock;
  findById: jest.Mock;
  findOneAndUpdate: jest.Mock;
  create: jest.Mock;
  updateOne: jest.Mock;
};

const mockRedis = redisClient as unknown as {
  get: jest.Mock;
  set: jest.Mock;
  setEx: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
  expire: jest.Mock;
};

const mockNotif = NotificationService as unknown as {
  sendOtpEmail: jest.Mock;
  triggerWelcome: jest.Mock;
  sendPasswordReset: jest.Mock;
  sendPasswordUpdateConfirmation: jest.Mock;
};

const mockVerifyIdToken = (
  GoogleAuth as unknown as { __verifyIdToken: jest.Mock }
).__verifyIdToken;

// ─── HELPERS ───
// Makes any query chainable and awaitable
function chainable<T>(value: T) {
  return {
    select: jest.fn().mockResolvedValue(value),
    lean: jest.fn().mockResolvedValue(value),
    session: jest.fn().mockReturnThis(),
    then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve),
  };
}

beforeEach(() => {
  // Clear call history AND queued "Once" implementations
  jest.clearAllMocks();
  mockVerifyIdToken.mockReset();
});

// ═══════════════════════════════════════════════
// 1. registerLocal
// ═══════════════════════════════════════════════
describe("AuthService.registerLocal", () => {
  const input = {
    firstname: "Test",
    lastname: "User",
    email: "new@example.com",
    password: "Password123!",
    acceptPrivacyPolicy: true,
  };

  it("creates a new user, stores OTP in Redis, and queues an email", async () => {
    const created = buildUser({ email: input.email, isEmailVerified: false });
    mockUser.findOne.mockResolvedValue(null);
    mockUser.create.mockResolvedValue(created);
    mockRedis.setEx.mockResolvedValue("OK");

    const result = await AuthService.registerLocal(input);

    expect(mockUser.create).toHaveBeenCalledTimes(1);
    expect(mockRedis.setEx).toHaveBeenCalledWith(
      `otp:${input.email}`,
      600,
      expect.any(String),
    );
    expect(mockNotif.sendOtpEmail).toHaveBeenCalledWith(
      input.email,
      input.firstname,
      expect.stringMatching(/^\d{6}$/),
      expect.any(String),
    );
    expect(result.user).toBe(created);
  });

  it("throws CONFLICT when a verified user already exists", async () => {
    const verified = buildUser({ email: input.email, isEmailVerified: true });
    mockUser.findOne.mockResolvedValue(verified);

    const promise = AuthService.registerLocal(input);

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ statusCode: 409 });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("performs safe collision recovery for an unverified user", async () => {
    const existing = buildUser({ email: input.email, isEmailVerified: false });
    existing.save = jest.fn().mockResolvedValue(existing);
    mockUser.findOne.mockResolvedValue(existing);
    mockRedis.setEx.mockResolvedValue("OK");

    await AuthService.registerLocal(input);

    expect(existing.save).toHaveBeenCalledTimes(1);
    expect(mockUser.create).not.toHaveBeenCalled();
    expect(existing.firstname).toBe(input.firstname);
  });

  it("stores a 6-digit numeric OTP", async () => {
    const created = buildUser({ email: input.email, isEmailVerified: false });
    mockUser.findOne.mockResolvedValue(null);
    mockUser.create.mockResolvedValue(created);
    mockRedis.setEx.mockResolvedValue("OK");

    await AuthService.registerLocal(input);

    const otp = mockRedis.setEx.mock.calls[0][2] as string;
    expect(otp).toMatch(/^\d{6}$/);
  });
});

// ═══════════════════════════════════════════════
// 2. verifyEmailOtp
// ═══════════════════════════════════════════════
describe("AuthService.verifyEmailOtp", () => {
  const email = "user@example.com";
  const validOtp = "123456";

  it("activates the user when the OTP matches", async () => {
    const activated = buildUser({ email, isEmailVerified: true });
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(validOtp);
    mockUser.findOneAndUpdate.mockResolvedValue(activated);
    mockRedis.del.mockResolvedValue(1);

    const result = await AuthService.verifyEmailOtp(email, validOtp);

    expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
      { email: { $eq: email } },
      { isEmailVerified: true },
      { new: true },
    );
    expect(mockRedis.del).toHaveBeenCalledWith(`otp:${email}`);
    expect(mockNotif.triggerWelcome).toHaveBeenCalled();
    expect(result).toBe(activated);
  });

  it("throws 400 when the OTP does not match", async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue("999999");

    await expect(
      AuthService.verifyEmailOtp(email, "111111"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when the OTP has expired", async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);

    await expect(
      AuthService.verifyEmailOtp(email, validOtp),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 429 after >5 attempts", async () => {
    mockRedis.incr.mockResolvedValue(6);

    await expect(
      AuthService.verifyEmailOtp(email, validOtp),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it("sets 15-minute expiry on the first failed attempt", async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue("999999");

    await expect(AuthService.verifyEmailOtp(email, "111111")).rejects.toThrow();

    expect(mockRedis.expire).toHaveBeenCalledWith(`otp_attempts:${email}`, 900);
  });

  it("throws 404 when user document is missing after verification", async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(validOtp);
    mockUser.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      AuthService.verifyEmailOtp(email, validOtp),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════
// 3. loginLocal
// ═══════════════════════════════════════════════
describe("AuthService.loginLocal", () => {
  const creds = { email: "user@example.com", password: "CorrectPass123!" };

  it("returns the user on valid credentials", async () => {
    const user = buildUser({ email: creds.email, isEmailVerified: true });
    user.comparePassword = jest.fn().mockResolvedValue(true);
    user.save = jest.fn().mockResolvedValue(user);
    mockUser.findOne.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    const result = await AuthService.loginLocal(creds);
    expect(result).toBe(user);
    expect(user.save).toHaveBeenCalled();
  });

  it("throws 401 when the user does not exist", async () => {
    mockUser.findOne.mockReturnValue(chainable(null));

    await expect(AuthService.loginLocal(creds)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("throws 401 on wrong password and increments attempts", async () => {
    const user = buildUser({ email: creds.email });
    user.comparePassword = jest.fn().mockResolvedValue(false);
    mockUser.findOne.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    await expect(AuthService.loginLocal(creds)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockUser.updateOne).toHaveBeenCalled();
    const updateCall = mockUser.updateOne.mock.calls[0][1];
    expect(updateCall.$set.failedLoginAttempts).toBe(1);
  });

  it("locks account after 5 failed attempts", async () => {
    const user = buildUser({ email: creds.email, failedLoginAttempts: 4 });
    user.comparePassword = jest.fn().mockResolvedValue(false);
    mockUser.findOne.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    await expect(AuthService.loginLocal(creds)).rejects.toThrow();

    const updateCall = mockUser.updateOne.mock.calls[0][1];
    expect(updateCall.$set.failedLoginAttempts).toBe(5);
    expect(updateCall.$set.lockUntil).toBeInstanceOf(Date);
  });

  it("throws 429 when the account is locked", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const user = buildUser({ email: creds.email, lockUntil: future });
    mockUser.findOne.mockReturnValue(chainable(user));

    await expect(AuthService.loginLocal(creds)).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("throws 403 when email is not verified", async () => {
    const user = buildUser({ email: creds.email, isEmailVerified: false });
    user.comparePassword = jest.fn().mockResolvedValue(true);
    mockUser.findOne.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    await expect(AuthService.loginLocal(creds)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 403 when the account is deactivated", async () => {
    const user = buildUser({ email: creds.email, isActive: false });
    user.comparePassword = jest.fn().mockResolvedValue(true);
    mockUser.findOne.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    await expect(AuthService.loginLocal(creds)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ═══════════════════════════════════════════════
// 4. refreshSession
// ═══════════════════════════════════════════════
describe("AuthService.refreshSession", () => {
  const buildRefreshToken = (userId: Types.ObjectId) =>
    jwt.sign({ id: userId.toString() }, env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

  it("rotates refresh tokens on success", async () => {
    const userId = new Types.ObjectId();
    const user = buildUser({ _id: userId, isActive: true });
    const token = buildRefreshToken(userId);

    mockRedis.get.mockResolvedValue(null);
    mockUser.findOne.mockResolvedValue(user);
    mockRedis.setEx.mockResolvedValue("OK");

    const result = await AuthService.refreshSession(token);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(mockRedis.setEx).toHaveBeenCalledWith(
      `blacklist:${token}`,
      expect.any(Number),
      "revoked",
    );
  });

  it("throws 401 when the refresh token is blacklisted", async () => {
    mockRedis.get.mockResolvedValue("revoked");

    await expect(
      AuthService.refreshSession("some-blacklisted-token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 for an invalid signature", async () => {
    mockRedis.get.mockResolvedValue(null);

    await expect(
      AuthService.refreshSession("invalid.jwt.token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when the user no longer exists", async () => {
    const token = buildRefreshToken(new Types.ObjectId());
    mockRedis.get.mockResolvedValue(null);
    mockUser.findOne.mockResolvedValue(null);

    await expect(AuthService.refreshSession(token)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("throws 403 when the account is deactivated", async () => {
    const userId = new Types.ObjectId();
    const token = buildRefreshToken(userId);
    mockRedis.get.mockResolvedValue(null);
    mockUser.findOne.mockResolvedValue(
      buildUser({ _id: userId, isActive: false }),
    );

    await expect(AuthService.refreshSession(token)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ═══════════════════════════════════════════════
// 5. loginWithGoogle
// ═══════════════════════════════════════════════
describe("AuthService.loginWithGoogle", () => {
  it("creates a new user on first Google login", async () => {
    const newUser = buildUser({
      authProvider: "GOOGLE",
      isEmailVerified: true,
    });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "google@example.com",
        given_name: "John",
        family_name: "Doe",
      }),
    });
    mockUser.findOne.mockResolvedValue(null);
    mockUser.create.mockResolvedValue(newUser);

    const result = await AuthService.loginWithGoogle("valid-google-id-token");

    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "google@example.com",
        authProvider: "GOOGLE",
        isEmailVerified: true,
      }),
    );
    expect(result).toBe(newUser);
  });

  it("returns the existing user on subsequent logins", async () => {
    const existing = buildUser({
      authProvider: "GOOGLE",
      isEmailVerified: true,
    });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "google@example.com", given_name: "John" }),
    });
    mockUser.findOne.mockResolvedValue(existing);

    const result = await AuthService.loginWithGoogle("valid-token");
    expect(result).toBe(existing);
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("throws 403 when the Google-linked account is deactivated", async () => {
    const existing = buildUser({ authProvider: "GOOGLE", isActive: false });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "google@example.com", given_name: "John" }),
    });
    mockUser.findOne.mockResolvedValue(existing);

    await expect(
      AuthService.loginWithGoogle("valid-token"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("auto-verifies an existing unverified account", async () => {
    const existing = buildUser({
      authProvider: "LOCAL",
      isEmailVerified: false,
    });
    existing.save = jest.fn().mockResolvedValue(existing);
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "google@example.com", given_name: "John" }),
    });
    mockUser.findOne.mockResolvedValue(existing);

    await AuthService.loginWithGoogle("valid-token");
    expect(existing.isEmailVerified).toBe(true);
  });

  it("throws 401 when Google's token is invalid", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

    await expect(
      AuthService.loginWithGoogle("bad-token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ═══════════════════════════════════════════════
// 6. forgotPassword
// ═══════════════════════════════════════════════
describe("AuthService.forgotPassword", () => {
  it("stores a hashed token and dispatches an email", async () => {
    const user = buildUser({
      email: "user@example.com",
      authProvider: "LOCAL",
    });
    mockUser.findOne.mockResolvedValue(user);
    mockRedis.setEx.mockResolvedValue("OK");

    await AuthService.forgotPassword("user@example.com");

    expect(mockRedis.setEx).toHaveBeenCalledWith(
      expect.stringMatching(/^pwd_reset:[a-f0-9]{64}$/),
      900,
      user._id.toString(),
    );
    expect(mockNotif.sendPasswordReset).toHaveBeenCalled();
  });

  it("silently returns for non-existent users", async () => {
    mockUser.findOne.mockResolvedValue(null);

    await expect(
      AuthService.forgotPassword("ghost@example.com"),
    ).resolves.toBeUndefined();
    expect(mockNotif.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("throws 400 for GOOGLE-only accounts", async () => {
    const user = buildUser({ authProvider: "GOOGLE" });
    mockUser.findOne.mockResolvedValue(user);

    await expect(
      AuthService.forgotPassword("google@example.com"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ═══════════════════════════════════════════════
// 7. resetPassword
// ═══════════════════════════════════════════════
describe("AuthService.resetPassword", () => {
  it("updates password and destroys the reset token", async () => {
    const user = buildUser();
    user.save = jest.fn().mockResolvedValue(user);
    mockRedis.get.mockResolvedValue(user._id.toString());
    mockUser.findById.mockResolvedValue(user);
    mockRedis.del.mockResolvedValue(1);

    await AuthService.resetPassword("a".repeat(64), "NewPassword123!");

    expect(user.password).toBe("NewPassword123!");
    expect(user.save).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalled();
    expect(mockNotif.sendPasswordUpdateConfirmation).toHaveBeenCalled();
  });

  it("throws 400 for an invalid token", async () => {
    mockRedis.get.mockResolvedValue(null);

    await expect(
      AuthService.resetPassword("a".repeat(64), "NewPassword123!"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the user no longer exists", async () => {
    mockRedis.get.mockResolvedValue("some-user-id");
    mockUser.findById.mockResolvedValue(null);

    await expect(
      AuthService.resetPassword("a".repeat(64), "NewPassword123!"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════
// 8. logoutUser
// ═══════════════════════════════════════════════
describe("AuthService.logoutUser", () => {
  it("blacklists a valid refresh token", async () => {
    const token = jwt.sign(
      { id: new Types.ObjectId().toString() },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );
    mockRedis.setEx.mockResolvedValue("OK");

    await AuthService.logoutUser(token);

    expect(mockRedis.setEx).toHaveBeenCalledWith(
      `blacklist:${token}`,
      expect.any(Number),
      "revoked",
    );
  });

  it("silently ignores invalid tokens", async () => {
    await expect(AuthService.logoutUser("garbage")).resolves.toBeUndefined();
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 9. 2FA — generateTwoFactorSetup
// ═══════════════════════════════════════════════
describe("AuthService.generateTwoFactorSetup", () => {
  it("generates a QR code and 8 backup codes", async () => {
    const user = buildUser({ isTwoFactorEnabled: false });
    user.save = jest.fn().mockResolvedValue(user);
    mockUser.findById.mockReturnValue(chainable(user));

    const result = await AuthService.generateTwoFactorSetup(
      user._id.toString(),
    );

    expect(result.qrCode).toBe("data:image/png;base64,MOCKQR");
    expect(result.backupCodes).toHaveLength(8);
    expect(user.twoFactorSecret).toBeDefined();
    expect(user.twoFactorBackupCodes).toHaveLength(8);
  });

  it("throws 409 when 2FA is already enabled", async () => {
    const user = buildUser({ isTwoFactorEnabled: true });
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.generateTwoFactorSetup(user._id.toString()),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when the user does not exist", async () => {
    mockUser.findById.mockReturnValue(chainable(null));

    await expect(
      AuthService.generateTwoFactorSetup("000000000000000000000000"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═══════════════════════════════════════════════
// 10. 2FA — enableTwoFactor
// ═══════════════════════════════════════════════
describe("AuthService.enableTwoFactor", () => {
  it("enables 2FA on a valid TOTP", async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const user = buildUser({ isTwoFactorEnabled: false });
    user.twoFactorSecret = encrypt(secret);
    user.save = jest.fn().mockResolvedValue(user);
    mockUser.findById.mockReturnValue(chainable(user));

    const token = speakeasy.totp({ secret, encoding: "base32" });
    const result = await AuthService.enableTwoFactor(
      user._id.toString(),
      token,
    );

    expect(result.success).toBe(true);
    expect(user.isTwoFactorEnabled).toBe(true);
  });

  it("throws 400 on an invalid TOTP", async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const user = buildUser({ isTwoFactorEnabled: false });
    user.twoFactorSecret = encrypt(secret);
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.enableTwoFactor(user._id.toString(), "000000"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 409 when 2FA is already enabled", async () => {
    const user = buildUser({ isTwoFactorEnabled: true });
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.enableTwoFactor(user._id.toString(), "123456"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 400 when setup was never initiated", async () => {
    const user = buildUser({ isTwoFactorEnabled: false });
    user.twoFactorSecret = undefined;
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.enableTwoFactor(user._id.toString(), "123456"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ═══════════════════════════════════════════════
// 11. 2FA — verifyTwoFactorLogin
// ═══════════════════════════════════════════════
describe("AuthService.verifyTwoFactorLogin", () => {
  const sign2FAToken = (userId: Types.ObjectId) =>
    jwt.sign({ id: userId.toString(), purpose: "2fa" }, env.JWT_ACCESS_SECRET, {
      expiresIn: "5m",
    });

  it("issues new tokens on valid TOTP", async () => {
    const userId = new Types.ObjectId();
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const user = buildUser({ _id: userId, isTwoFactorEnabled: true });
    user.twoFactorSecret = encrypt(secret);
    user.save = jest.fn().mockResolvedValue(user);
    mockUser.findById.mockReturnValue(chainable(user));

    const token = speakeasy.totp({ secret, encoding: "base32" });
    const twoFactorToken = sign2FAToken(userId);

    const result = await AuthService.verifyTwoFactorLogin(
      userId.toString(),
      token,
      undefined,
      twoFactorToken,
    );

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("consumes a valid backup code", async () => {
    const userId = new Types.ObjectId();
    const rawCode = "ABCD123456";
    const user = buildUser({ _id: userId, isTwoFactorEnabled: true });
    user.twoFactorSecret = encrypt(
      speakeasy.generateSecret({ length: 20 }).base32,
    );
    user.twoFactorBackupCodes = [`hashed:${rawCode}`, `hashed:OTHER00000`];
    user.save = jest.fn().mockResolvedValue(user);
    mockUser.findById.mockReturnValue(chainable(user));

    await AuthService.verifyTwoFactorLogin(
      userId.toString(),
      "000000",
      rawCode,
      sign2FAToken(userId),
    );

    expect(user.twoFactorBackupCodes).toEqual(["hashed:OTHER00000"]);
  });

  it("throws 401 for an invalid backup code", async () => {
    const userId = new Types.ObjectId();
    const user = buildUser({ _id: userId, isTwoFactorEnabled: true });
    user.twoFactorBackupCodes = ["hashed:REALCODE00"];
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.verifyTwoFactorLogin(
        userId.toString(),
        "000000",
        "WRONGCODE1",
        sign2FAToken(userId),
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when the token's user ID does not match", async () => {
    const userId = new Types.ObjectId();
    const otherId = new Types.ObjectId();
    // No findById mock needed — the check happens before user fetch

    await expect(
      AuthService.verifyTwoFactorLogin(
        userId.toString(),
        "123456",
        undefined,
        sign2FAToken(otherId),
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when 2FA is not enabled for the account", async () => {
    const userId = new Types.ObjectId();
    const user = buildUser({ _id: userId, isTwoFactorEnabled: false });
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.verifyTwoFactorLogin(
        userId.toString(),
        "123456",
        undefined,
        sign2FAToken(userId),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ═══════════════════════════════════════════════
// 12. 2FA — disableTwoFactor
// ═══════════════════════════════════════════════
describe("AuthService.disableTwoFactor", () => {
  it("disables 2FA on valid TOTP", async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const user = buildUser({ isTwoFactorEnabled: true });
    user.twoFactorSecret = encrypt(secret);
    mockUser.findById.mockReturnValue(chainable(user));
    mockUser.updateOne.mockResolvedValue({});

    const token = speakeasy.totp({ secret, encoding: "base32" });
    const result = await AuthService.disableTwoFactor(
      user._id.toString(),
      token,
    );

    expect(result.success).toBe(true);
    expect(mockUser.updateOne).toHaveBeenCalledWith(
      { _id: user._id },
      {
        $set: { isTwoFactorEnabled: false },
        $unset: { twoFactorSecret: 1, twoFactorBackupCodes: 1 },
      },
    );
  });

  it("throws 401 on invalid TOTP", async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const user = buildUser({ isTwoFactorEnabled: true });
    user.twoFactorSecret = encrypt(secret);
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.disableTwoFactor(user._id.toString(), "000000"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 400 when 2FA is not enabled", async () => {
    const user = buildUser({ isTwoFactorEnabled: false });
    mockUser.findById.mockReturnValue(chainable(user));

    await expect(
      AuthService.disableTwoFactor(user._id.toString(), "123456"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
