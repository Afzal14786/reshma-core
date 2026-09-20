import { agent, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createVerifiedUser, clearAuthRedisKeys } from "@tests/helpers/auth.helper";

describe("GET /api/v1/auth/logout", () => {
  const password = "Password123!";

  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  it("clears the refresh cookie and blacklists the token", async () => {
    const { user } = await createVerifiedUser({ password });
    const ag = agent();

    await ag.post("/api/v1/auth/login").send({ email: user.email, password });

    const logoutRes = await ag.get("/api/v1/auth/logout");
    expectSuccess(logoutRes, 200);

    const cookies = logoutRes.headers["set-cookie"] as unknown as string[];
    // signed cookies are serialized as "s%3Aloggedout.<signature>"
    expect(
      cookies.some((c) => c.startsWith("refreshToken=s%3Aloggedout")),
    ).toBe(true);
    expect(cookies.some((c) => c.startsWith("jwt=s%3Aloggedout"))).toBe(true);
  });

  it("subsequent refresh fails after logout", async () => {
    const { user } = await createVerifiedUser({ password });
    const ag = agent();

    await ag.post("/api/v1/auth/login").send({ email: user.email, password });
    await ag.get("/api/v1/auth/logout");

    const refreshRes = await ag.get("/api/v1/auth/refresh");
    expect(refreshRes.status).toBe(401);
  });

  it("returns 401 when no auth is provided (protected route)", async () => {
    // /logout is protected by `protect` middleware — requires a valid JWT
    const res = await agent().get("/api/v1/auth/logout");
    expectError(res, 401);
  });
});