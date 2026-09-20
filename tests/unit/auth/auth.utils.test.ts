import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import {
  signAccessToken,
  signRefreshToken,
  signTwoFactorToken,
  verifyTwoFactorToken,
  generateTwoFactorSecret,
} from "@modules/auth/auth.utils";
import env from "@config/env";
import { AppError } from "@shared/utils/app-error";

describe("signAccessToken", () => {
  it("creates a valid JWT with the user ID", () => {
    const userId = new Types.ObjectId();
    const token = signAccessToken(userId);
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.id).toBe(userId.toString());
  });

  it("sets a 15-minute expiry", () => {
    const userId = new Types.ObjectId();
    const decoded = jwt.decode(signAccessToken(userId)) as jwt.JwtPayload;
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(15 * 60);
  });

  it("cannot be verified with the refresh secret", () => {
    const userId = new Types.ObjectId();
    const token = signAccessToken(userId);
    expect(() => jwt.verify(token, env.JWT_REFRESH_SECRET)).toThrow();
  });
});

describe("signRefreshToken", () => {
  it("creates a valid JWT with the user ID", () => {
    const userId = new Types.ObjectId();
    const token = signRefreshToken(userId);
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    expect(decoded.id).toBe(userId.toString());
  });

  it("sets a 7-day expiry", () => {
    const userId = new Types.ObjectId();
    const decoded = jwt.decode(signRefreshToken(userId)) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(7 * 24 * 60 * 60);
  });

  it("cannot be verified with the access secret", () => {
    const userId = new Types.ObjectId();
    const token = signRefreshToken(userId);
    expect(() => jwt.verify(token, env.JWT_ACCESS_SECRET)).toThrow();
  });
});

describe("signTwoFactorToken & verifyTwoFactorToken", () => {
  it("signs and verifies a valid 2FA token", () => {
    const userId = new Types.ObjectId();
    const token = signTwoFactorToken(userId);
    const decoded = verifyTwoFactorToken(token);
    expect(decoded.id).toBe(userId.toString());
    expect(decoded.purpose).toBe("2fa");
  });

  it("sets a 5-minute expiry", () => {
    const userId = new Types.ObjectId();
    const decoded = jwt.decode(signTwoFactorToken(userId)) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(5 * 60);
  });

  it("rejects an access token (wrong purpose)", () => {
    const userId = new Types.ObjectId();
    const accessToken = signAccessToken(userId);
    expect(() => verifyTwoFactorToken(accessToken)).toThrow(AppError);
  });

  it("rejects a malformed token", () => {
    expect(() => verifyTwoFactorToken("not.a.jwt")).toThrow(AppError);
  });

  it("rejects an empty token", () => {
    expect(() => verifyTwoFactorToken("")).toThrow(AppError);
  });
});

describe("generateTwoFactorSecret", () => {
  it("returns secret, otpauth URL, and 8 backup codes", () => {
    const result = generateTwoFactorSecret("user@example.com");
    expect(result.secret).toBeDefined();
    expect(typeof result.secret).toBe("string");
    expect(result.secret.length).toBeGreaterThan(0);
    expect(result.otpauthUrl).toBeDefined();
    expect(result.otpauthUrl).toContain("otpauth://");
    expect(result.backupCodes).toHaveLength(8);
  });

  it("formats backup codes as 10 uppercase hex characters", () => {
    const { backupCodes } = generateTwoFactorSecret("user@example.com");
    backupCodes.forEach((code) => {
      expect(code).toMatch(/^[0-9A-F]{10}$/);
    });
  });

  it("generates unique backup codes", () => {
    const { backupCodes } = generateTwoFactorSecret("user@example.com");
    expect(new Set(backupCodes).size).toBe(8);
  });

  it("includes the URL-encoded email in the otpauth URL", () => {
    const { otpauthUrl } = generateTwoFactorSecret("john.doe@example.com");
    expect(otpauthUrl).toContain("john.doe%40example.com");
  });

  it("generates distinct secrets on each call", () => {
    const a = generateTwoFactorSecret("user@example.com");
    const b = generateTwoFactorSecret("user@example.com");
    expect(a.secret).not.toBe(b.secret);
  });

  it("uses the provided issuer name", () => {
    const { otpauthUrl } = generateTwoFactorSecret(
      "user@example.com",
      "Custom Issuer",
    );
    expect(otpauthUrl).toContain("Custom%20Issuer");
  });
});
