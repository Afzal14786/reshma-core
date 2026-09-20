// ──────────────────────────────────────────────
// POST /api/v1/auth/register  — Integration tests
// ──────────────────────────────────────────────

import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { clearAuthRedisKeys } from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";
import { redisClient } from "@config/redis";

describe("POST /api/v1/auth/register", () => {
  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  const validBody = {
    firstname: "Test",
    lastname: "User",
    email: "register-test@example.com",
    password: "Password123!",
    acceptPrivacyPolicy: true,
  };

  it("creates a new unverified user and stores OTP in Redis", async () => {
    const res = await request.post("/api/v1/auth/register").send(validBody);

    expectSuccess(res, 201);
    expect(res.body.data.user.email).toBe(validBody.email);
    expect(res.body.data.user.isEmailVerified).toBe(false);
    // Password must never be serialized
    expect(res.body.data.user.password).toBeUndefined();

    // OTP should be in Redis with ~600s TTL
    const otp = await redisClient.get(`otp:${validBody.email}`);
    expect(otp).toMatch(/^\d{6}$/);

    // Confirm DB persistence
    const dbUser = await User.findOne({ email: validBody.email });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.isEmailVerified).toBe(false);
  });

  it("returns 400 when acceptPrivacyPolicy is false", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validBody, acceptPrivacyPolicy: false });

    expectError(res, 400);
    expect(res.body.message).toMatch(/Privacy Policy/i);
  });

  it("returns 400 when the password is too weak", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validBody, password: "weak" });

    expectError(res, 400);
    expect(res.body.message).toMatch(/Validation Failed/i);
  });

  it("returns 400 when the email format is invalid", async () => {
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validBody, email: "not-an-email" });

    expectError(res, 400);
  });

  it("returns 409 when a verified user already exists", async () => {
    // Pre-create a verified user
    await User.create({
      ...validBody,
      authProvider: "LOCAL",
      isEmailVerified: true,
      preferences: { newsletter: true, smsAlerts: true, privacyPolicyAcceptedAt: new Date() },
    });

    const res = await request.post("/api/v1/auth/register").send(validBody);
    expectError(res, 409);
  });

  it("overwrites an unverified user (safe collision recovery)", async () => {
    // First registration
    await request.post("/api/v1/auth/register").send(validBody);

    // Second registration with different firstname
    const res = await request
      .post("/api/v1/auth/register")
      .send({ ...validBody, firstname: "Updated" });

    expectSuccess(res, 201);
    expect(res.body.data.user.firstname).toBe("Updated");

    // Only one user in DB
    const count = await User.countDocuments({ email: validBody.email });
    expect(count).toBe(1);
  });

  it("never returns the password field in the response", async () => {
    const res = await request.post("/api/v1/auth/register").send(validBody);
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toContain("Password123!");
  });
});