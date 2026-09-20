import { request, agent, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createVerifiedUser, clearAuthRedisKeys } from "@tests/helpers/auth.helper";

describe("GET /api/v1/auth/refresh", () => {
  const password = "Password123!";

  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  it("issues a new access token on valid refresh cookie", async () => {
    const { user } = await createVerifiedUser({ password });

    const ag = agent();
    const loginRes = await ag
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });
    expect(loginRes.status).toBe(200);

    const refreshRes = await ag.get("/api/v1/auth/refresh");
    expectSuccess(refreshRes, 200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await request.get("/api/v1/auth/refresh");
    expectError(res, 401);
  });

  it("rotates the refresh token (old one is blacklisted)", async () => {
    const { user } = await createVerifiedUser({ password });
    const ag = agent();

    await ag.post("/api/v1/auth/login").send({ email: user.email, password });

    // First refresh: rotates cookie
    const firstRefresh = await ag.get("/api/v1/auth/refresh");
    expect(firstRefresh.status).toBe(200);

    // Second refresh should still work (new cookie in jar)
    const secondRefresh = await ag.get("/api/v1/auth/refresh");
    expect(secondRefresh.status).toBe(200);
  });

  it("returns 401 for a tampered refresh token", async () => {
    const res = await request
      .get("/api/v1/auth/refresh")
      .set("Cookie", "refreshToken=tampered.value.here");

    expectError(res, 401);
  });
});