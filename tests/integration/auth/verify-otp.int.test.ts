// ──────────────────────────────────────────────
// POST /api/v1/auth/verify-otp  — Integration tests
// ──────────────────────────────────────────────

import {
  request,
  expectSuccess,
  expectError,
  agent,
} from "@tests/helpers/request.helper";
import {
  createVerifiedUser,
  seedOtpInRedis,
  clearAuthRedisKeys,
} from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";
import { redisClient } from "@config/redis";

describe("POST /api/v1/auth/verify-otp", () => {
  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  const email = "verify-otp@example.com";
  const otp = "123456";

  async function seedUnverifiedUser() {
    await User.create({
      firstname: "Test",
      lastname: "User",
      email,
      password: "Password123!",
      authProvider: "LOCAL",
      isEmailVerified: false,
      preferences: {
        newsletter: true,
        smsAlerts: true,
        privacyPolicyAcceptedAt: new Date(),
      },
    });
  }

  it("activates the account, sets cookies, and returns tokens", async () => {
    await seedUnverifiedUser();
    await seedOtpInRedis(email, otp);

    const ag = agent();
    const res = await ag.post("/api/v1/auth/verify-otp").send({ email, otp });

    expectSuccess(res, 200);
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    // HttpOnly refresh cookie must be set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr.some((c) => c.startsWith("refreshToken="))).toBe(true);
    expect(cookieArr.some((c) => c.includes("HttpOnly"))).toBe(true);

    // OTP must be consumed
    const remaining = await redisClient.get(`otp:${email}`);
    expect(remaining).toBeNull();

    // DB user must be verified
    const dbUser = await User.findOne({ email });
    expect(dbUser!.isEmailVerified).toBe(true);
  });

  it("returns 400 on wrong OTP", async () => {
    await seedUnverifiedUser();
    await seedOtpInRedis(email, "999999");

    const res = await request
      .post("/api/v1/auth/verify-otp")
      .send({ email, otp: "111111" });

    expectError(res, 400);
  });

  it("returns 400 when the OTP has expired (no Redis entry)", async () => {
    await seedUnverifiedUser();

    const res = await request
      .post("/api/v1/auth/verify-otp")
      .send({ email, otp });

    expectError(res, 400);
  });

  it("returns 429 after 5 failed attempts (brute-force protection)", async () => {
    await seedUnverifiedUser();
    await seedOtpInRedis(email, "999999");

    // Burn 5 attempts
    for (let i = 0; i < 5; i++) {
      await request
        .post("/api/v1/auth/verify-otp")
        .send({ email, otp: "111111" });
    }

    // 6th attempt → 429
    const res = await request
      .post("/api/v1/auth/verify-otp")
      .send({ email, otp: "111111" });

    expectError(res, 429);
  });

  it("returns 400 when the OTP format is wrong (Zod)", async () => {
    const res = await request
      .post("/api/v1/auth/verify-otp")
      .send({ email, otp: "abc" });

    expectError(res, 400);
    expect(res.body.message).toMatch(/Validation Failed/i);
  });
});
