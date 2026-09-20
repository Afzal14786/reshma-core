import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import {
  createUserWithToken,
  clearAuthRedisKeys,
} from "@tests/helpers/auth.helper";
import {
  DiscountType,
  PaymentRestriction,
} from "@modules/coupons/interfaces/coupon.interface";

describe("Coupon API — /api/v1/coupons", () => {
  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
    const now = Date.now();
    return {
      code: `TEST${Math.floor(Math.random() * 10000)}`,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      maxDiscountAmount: 500,
      minCartValue: 1000,
      startDate: new Date(now).toISOString(),
      expiryDate: new Date(now + 7 * 86400000).toISOString(),
      usageLimit: 100,
      isActive: true,
      isFirstOrderOnly: false,
      paymentMethodRestriction: PaymentRestriction.ANY,
      ...overrides,
    };
  }

  describe("POST / (admin only)", () => {
    it("creates a coupon successfully", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const payload = validPayload();

      const res = await request
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload);

      expectSuccess(res, 201);
      expect(res.body.data.code).toBe(payload.code);
    });

    it("returns 403 for non-admin users", async () => {
      const { accessToken } = await createUserWithToken({ role: "USER" });

      const res = await request
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(validPayload());

      expectError(res, 403);
    });

    it("returns 400 when PERCENTAGE coupon lacks maxDiscountAmount", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });

      const res = await request
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(validPayload({ maxDiscountAmount: undefined }));

      expectError(res, 400);
    });

    it("returns 400 when expiryDate is before startDate", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const now = Date.now();

      const res = await request
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(
          validPayload({
            startDate: new Date(now + 86400000).toISOString(),
            expiryDate: new Date(now).toISOString(),
          }),
        );

      expectError(res, 400);
    });
  });

  describe("GET /available", () => {
    it("returns active coupons for authenticated users", async () => {
      const { accessToken: adminToken } = await createUserWithToken({
        role: "ADMIN",
      });
      await request
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validPayload());

      const { accessToken: userToken } = await createUserWithToken({
        role: "USER",
      });
      const res = await request
        .get("/api/v1/coupons/available")
        .set("Authorization", `Bearer ${userToken}`);

      expectSuccess(res, 200);
      expect(Array.isArray(res.body.data.coupons)).toBe(true);
      expect(res.body.data.coupons.length).toBeGreaterThan(0);
    });

    it("returns 401 without auth", async () => {
      const res = await request.get("/api/v1/coupons/available");
      expectError(res, 401);
    });
  });

  describe("GET / (admin only)", () => {
    it("returns paginated coupons for admin", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });

      const res = await request
        .get("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.meta).toBeDefined();
    });

    it("returns 403 for non-admin", async () => {
      const { accessToken } = await createUserWithToken({ role: "USER" });

      const res = await request
        .get("/api/v1/coupons")
        .set("Authorization", `Bearer ${accessToken}`);

      expectError(res, 403);
    });
  });
});
