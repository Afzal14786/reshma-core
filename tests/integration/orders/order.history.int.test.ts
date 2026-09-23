import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestOrder } from "@tests/helpers/order.helper";

const USER_API = "/api/v1/orders/my-order";
const ADMIN_API = "/api/v1/orders/admin";

describe("Order history — /api/v1/orders", () => {
  describe("GET /my-order (user-scoped)", () => {
    it("returns only the caller's orders", async () => {
      const { accessToken } = await createUserWithToken();
      await createTestOrder({ accessToken });
      await createTestOrder({ accessToken });

      // Another user's orders must not leak
      const { accessToken: otherToken } = await createUserWithToken();
      await createTestOrder({ accessToken: otherToken });

      const res = await request
        .get(USER_API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.orders).toHaveLength(2);
    });

    it("returns an empty array for a brand new user", async () => {
      const { accessToken } = await createUserWithToken();
      const res = await request
        .get(USER_API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.orders).toEqual([]);
    });

    it("returns 401 without auth", async () => {
      const res = await request.get(USER_API);
      expectError(res, 401);
    });
  });

  describe("GET /admin (admin-scoped)", () => {
    it("returns ALL orders for an admin", async () => {
      const { accessToken: user1 } = await createUserWithToken();
      const { accessToken: user2 } = await createUserWithToken();
      await createTestOrder({ accessToken: user1 });
      await createTestOrder({ accessToken: user2 });

      const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
      const res = await request
        .get(ADMIN_API)
        .set("Authorization", `Bearer ${adminToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it("returns 403 for a non-admin user", async () => {
      const { accessToken } = await createUserWithToken({ role: "USER" });
      const res = await request
        .get(ADMIN_API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectError(res, 403);
    });
  });
});