import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestOrder } from "@tests/helpers/order.helper";
import { Order } from "@modules/orders/order.model";

function statusUrl(id: string): string {
  return `/api/v1/orders/admin/${id}/status`;
}

describe("PATCH /api/v1/orders/admin/:id/status", () => {
  it("admin transitions PENDING → PROCESSING", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const { order } = await createTestOrder();

    const res = await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderStatus: "PROCESSING" });

    expectSuccess(res, 200);
    expect(res.body.data.order.orderStatus).toBe("PROCESSING");
  });

  it("admin sets trackingNumber + courierName on SHIPPED", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const { order } = await createTestOrder({ orderStatus: "PROCESSING" });

    const res = await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        orderStatus: "SHIPPED",
        trackingNumber: "AWB123456",
        courierName: "Delhivery",
      });

    expectSuccess(res, 200);
    expect(res.body.data.order.trackingNumber).toBe("AWB123456");
    expect(res.body.data.order.courierName).toBe("Delhivery");
  });

  it("returns 403 for a non-admin user", async () => {
    const { accessToken: userToken } = await createUserWithToken({ role: "USER" });
    const { order } = await createTestOrder();

    const res = await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${userToken}`)
      .send({ orderStatus: "PROCESSING" });

    expectError(res, 403);
  });

  it("returns 400 for an invalid status value", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const { order } = await createTestOrder();

    const res = await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderStatus: "NONSENSE" });

    expectError(res, 400);
  });

  it("returns 404 for a non-existent order", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const res = await request
      .patch(statusUrl("000000000000000000000000"))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderStatus: "PROCESSING" });

    expectError(res, 404);
  });

  it("returns 401 without auth", async () => {
    const { order } = await createTestOrder();
    const res = await request
      .patch(statusUrl(String(order._id)))
      .send({ orderStatus: "PROCESSING" });

    expectError(res, 401);
  });

  it("stores the update in the database", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const { order } = await createTestOrder();

    await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderStatus: "DELIVERED" });

    const fresh = await Order.findById(order._id);
    expect(fresh!.orderStatus).toBe("DELIVERED");
  });

  it("accepts RETURN_REQUESTED as a valid status", async () => {
    const { accessToken: adminToken } = await createUserWithToken({ role: "ADMIN" });
    const { order } = await createTestOrder({ orderStatus: "DELIVERED" });

    const res = await request
      .patch(statusUrl(String(order._id)))
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orderStatus: "RETURN_REQUESTED" });

    expectSuccess(res, 200);
    expect(res.body.data.order.orderStatus).toBe("RETURN_REQUESTED");
  });
});