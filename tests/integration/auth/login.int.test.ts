import { request, expectSuccess, expectError, agent } from "@tests/helpers/request.helper";
import { createVerifiedUser, clearAuthRedisKeys } from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  const password = "Password123!";

  it("returns access token and sets refresh cookie on valid credentials", async () => {
    const { user } = await createVerifiedUser({ password });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expectSuccess(res, 200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(user.email);

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
    expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("returns 401 on wrong password", async () => {
    const { user } = await createVerifiedUser({ password });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "WrongPass123!" });

    expectError(res, 401);
  });

  it("returns 401 on unknown email", async () => {
    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: "ghost@example.com", password });

    expectError(res, 401);
  });

  it("returns 403 when email is not verified", async () => {
    const { user } = await createVerifiedUser({
      password,
      isEmailVerified: false,
    });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expectError(res, 403);
  });

  it("returns 403 when account is deactivated", async () => {
    const { user } = await createVerifiedUser({ password, isActive: false });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expectError(res, 403);
  });

  it("returns 429 when the account is currently locked", async () => {
    const { user } = await createVerifiedUser({ password });
    user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expectError(res, 429);
  });

  it("increments failedLoginAttempts on wrong password", async () => {
    const { user } = await createVerifiedUser({ password });

    await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "WrongPass123!" });

    const refreshed = await User.findById(user._id);
    expect(refreshed!.failedLoginAttempts).toBe(1);
  });

  it("returns 400 on malformed body (Zod)", async () => {
    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email", password });

    expectError(res, 400);
  });

  it("returns requiresTwoFactor for ADMIN with 2FA enabled", async () => {
    const { user } = await createVerifiedUser({ password, role: "ADMIN" });
    user.isTwoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expectSuccess(res, 200);
    expect(res.body.data.requiresTwoFactor).toBe(true);
    expect(res.body.data.twoFactorToken).toBeDefined();
  });
});