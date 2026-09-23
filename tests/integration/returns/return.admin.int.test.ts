import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createDeliveredOrder } from "@tests/helpers/order.helper";
import { initiateReturn, arbitrateReturn } from "@tests/helpers/return.helper";
import { Order } from "@modules/orders/order.model";
import { ReturnModel } from "@modules/returns/return.model";
import {
  ReturnReason,
  ReturnStatus,
} from "@modules/returns/interfaces/return.interface";
import { buildReturnItem } from "@tests/factories/return.factory";

async function setupPendingReturn() {
  const { accessToken: userToken } = await createUserWithToken();
  const { order, product } = await createDeliveredOrder({
    accessToken: userToken,
    paymentMethod: "COD",
  });
  const init = await initiateReturn(userToken, String(order._id), {
    items: [buildReturnItem(String(product._id), 1, ReturnReason.NOT_NEEDED)],
  });
  return {
    returnId: init.body.data.returnRequest._id as string,
    orderId: String(order._id),
  };
}

describe("PATCH /api/v1/returns/admin/:returnId/arbitrate", () => {
  it("admin approves a pending return", async () => {
    const { returnId } = await setupPendingReturn();
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });

    const res = await arbitrateReturn(
      adminToken,
      returnId,
      ReturnStatus.APPROVED,
    );

    expectSuccess(res, 200);
    expect(res.body.data.returnRequest.status).toBe(ReturnStatus.APPROVED);
  });

  it("admin rejects and the order reverts to DELIVERED", async () => {
    const { returnId, orderId } = await setupPendingReturn();
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });

    const res = await arbitrateReturn(
      adminToken,
      returnId,
      ReturnStatus.REJECTED,
      "Item not in resellable condition",
    );

    expectSuccess(res, 200);
    expect(res.body.data.returnRequest.status).toBe(ReturnStatus.REJECTED);

    const fresh = await Order.findById(orderId);
    expect(fresh!.orderStatus).toBe("DELIVERED");
  });

  it("requires a rejection reason when rejecting", async () => {
    const { returnId } = await setupPendingReturn();
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });

    const res = await arbitrateReturn(
      adminToken,
      returnId,
      ReturnStatus.REJECTED,
      // no reason
    );

    expectError(res, 400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { returnId } = await setupPendingReturn();
    const { accessToken: userToken } = await createUserWithToken();

    const res = await arbitrateReturn(
      userToken,
      returnId,
      ReturnStatus.APPROVED,
    );

    expectError(res, 403);
  });
});

describe("GET /api/v1/returns/admin", () => {
  it("returns all returns for an admin", async () => {
    await setupPendingReturn();
    await setupPendingReturn();
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });

    const res = await request
      .get("/api/v1/returns/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expectSuccess(res, 200);
    expect(res.body.data.returns.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 403 for a non-admin user", async () => {
    const { accessToken } = await createUserWithToken({ role: "USER" });
    const res = await request
      .get("/api/v1/returns/admin")
      .set("Authorization", `Bearer ${accessToken}`);

    expectError(res, 403);
  });
});
