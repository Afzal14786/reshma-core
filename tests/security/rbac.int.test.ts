// ──────────────────────────────────────────────
// RBAC — Role-Based Access Control tests
// ──────────────────────────────────────────────
// Verifies that authenticated non-admin users cannot access admin-only
// endpoints (403 Forbidden), and that unauthenticated requests are
// rejected earlier by the auth layer (401 Unauthorized).

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { createTestOrder } from "@tests/helpers/order.helper";
import {
  expectForbidden,
  expectUnauthorized,
  bearer,
} from "@tests/helpers/security.helper";

describe("RBAC — Non-admin rejected from admin endpoints (403)", () => {
  let userToken: string;

  beforeEach(async () => {
    const created = await createUserWithToken({ role: "USER" });
    userToken = created.accessToken;
  });

  // ─────────────────────────────────────────────
  // Products (admin CRUD)
  // ─────────────────────────────────────────────

  it("Non-admin cannot create a product", async () => {
    const res = await request
      .post("/api/v1/products")
      .set("Authorization", bearer(userToken))
      .send({});
    expectForbidden(res);
  });

  it("Non-admin cannot update a product", async () => {
    const product = await createTestBangle();
    const res = await request
      .patch(`/api/v1/products/${product._id}`)
      .set("Authorization", bearer(userToken))
      .send({ name: "Hacked" });
    expectForbidden(res);
  });

  it("Non-admin cannot soft-delete a product", async () => {
    const product = await createTestBangle();
    const res = await request
      .delete(`/api/v1/products/${product._id}`)
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Orders (admin)
  // ─────────────────────────────────────────────

  it("Non-admin cannot list all orders (admin feed)", async () => {
    const res = await request
      .get("/api/v1/orders/admin")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  it("Non-admin cannot fetch any order via admin endpoint", async () => {
    const { order } = await createTestOrder();
    const res = await request
      .get(`/api/v1/orders/admin/${order._id}`)
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  it("Non-admin cannot update order status", async () => {
    const { order } = await createTestOrder();
    const res = await request
      .patch(`/api/v1/orders/admin/${order._id}/status`)
      .set("Authorization", bearer(userToken))
      .send({ orderStatus: "PROCESSING" });
    expectForbidden(res);
  });

  it("Non-admin cannot dispatch an order", async () => {
    const { order } = await createTestOrder();
    const res = await request
      .post(`/api/v1/orders/admin/${order._id}/dispatch`)
      .set("Authorization", bearer(userToken))
      .send({ length: 10, breadth: 10, height: 10, weight: 0.5 });
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Coupons (admin)
  // ─────────────────────────────────────────────

  it("Non-admin cannot create a coupon", async () => {
    const res = await request
      .post("/api/v1/coupons")
      .set("Authorization", bearer(userToken))
      .send({});
    expectForbidden(res);
  });

  it("Non-admin cannot list all coupons", async () => {
    const res = await request
      .get("/api/v1/coupons")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Returns (admin)
  // ─────────────────────────────────────────────

  it("Non-admin cannot list all returns", async () => {
    const res = await request
      .get("/api/v1/returns/admin")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  it("Non-admin cannot arbitrate a return", async () => {
    const res = await request
      .patch("/api/v1/returns/admin/000000000000000000000000/arbitrate")
      .set("Authorization", bearer(userToken))
      .send({ status: "APPROVED" });
    expectForbidden(res);
  });

  it("Non-admin cannot process a refund", async () => {
    const res = await request
      .post("/api/v1/returns/admin/000000000000000000000000/process")
      .set("Authorization", bearer(userToken))
      .send({});
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────

  it("Non-admin cannot access dashboard metrics", async () => {
    const res = await request
      .get("/api/v1/dashboards/metrics")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Admin Search
  // ─────────────────────────────────────────────

  it("Non-admin cannot use admin global search", async () => {
    const res = await request
      .get("/api/v1/admin/search")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Audit Logs
  // ─────────────────────────────────────────────

  it("Non-admin cannot view audit logs", async () => {
    const res = await request
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  it("Non-admin cannot export audit logs", async () => {
    const res = await request
      .get("/api/v1/admin/audit-logs/export")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Support (admin)
  // ─────────────────────────────────────────────

  it("Non-admin cannot list all support tickets", async () => {
    const res = await request
      .get("/api/v1/support/admin/tickets")
      .set("Authorization", bearer(userToken));
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Unauthenticated (401, not 403)
  // ─────────────────────────────────────────────

  it("Unauthenticated request to admin endpoint is rejected with 401", async () => {
    const res = await request.get("/api/v1/orders/admin");
    expectUnauthorized(res);
  });

  it("Unauthenticated request to admin search is rejected with 401", async () => {
    const res = await request.get("/api/v1/admin/search");
    expectUnauthorized(res);
  });

  it("Unauthenticated request to audit logs is rejected with 401", async () => {
    const res = await request.get("/api/v1/admin/audit-logs");
    expectUnauthorized(res);
  });
});
