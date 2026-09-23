import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import {
  createDeliveredOrder,
  createTestOrder,
} from "@tests/helpers/order.helper";
import {
  initiateReturn,
  arbitrateReturn,
  processRefund,
} from "@tests/helpers/return.helper";
import { Order } from "@modules/orders/order.model";
import { ReturnModel } from "@modules/returns/return.model";
import { Product } from "@modules/products/models";
import {
  ReturnReason,
  ReturnStatus,
} from "@modules/returns/interfaces/return.interface";
import { buildReturnItem } from "@tests/factories/return.factory";
import { razorpay } from "@config/razorpay";

const mockedRefund = razorpay.payments.refund as unknown as jest.Mock;

async function setupApprovedReturn() {
  const { accessToken: userToken } = await createUserWithToken();
  const { order, product } = await createDeliveredOrder({
    accessToken: userToken,
    paymentMethod: "RAZORPAY",
    gatewayOrderId: `order_refund_${Date.now()}`,
    gatewayPaymentId: `pay_refund_${Date.now()}`,
    currentStock: 100,
  });

  const init = await initiateReturn(userToken, String(order._id), {
    items: [buildReturnItem(String(product._id), 1, ReturnReason.NOT_NEEDED)],
  });

  const returnId = init.body.data.returnRequest._id as string;

  const { accessToken: adminToken } = await createUserWithToken({
    role: "ADMIN",
  });
  await arbitrateReturn(adminToken, returnId, ReturnStatus.APPROVED);

  return {
    returnId,
    orderId: String(order._id),
    productId: String(product._id),
    adminToken,
  };
}

describe("POST /api/v1/returns/admin/:returnId/process", () => {
  it("processes refund on an APPROVED return — status REFUNDED, order RETURNED", async () => {
    const { returnId, orderId, adminToken } = await setupApprovedReturn();

    const res = await processRefund(adminToken, returnId);

    expectSuccess(res, 200);
    expect(res.body.data.returnRequest.status).toBe(ReturnStatus.REFUNDED);

    const freshOrder = await Order.findById(orderId);
    expect(freshOrder!.orderStatus).toBe("RETURNED");

    expect(mockedRefund).toHaveBeenCalled();
  });

  it("restocks inventory atomically", async () => {
    const { returnId, productId, adminToken } = await setupApprovedReturn();

    const before = await Product.findById(productId);
    const stockBefore = before!.currentStock;

    await processRefund(adminToken, returnId);

    const after = await Product.findById(productId);
    expect(after!.currentStock).toBe(stockBefore + 1);
  });

  it("rejects processing on a PENDING return", async () => {
    const { accessToken: userToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken: userToken,
      paymentMethod: "RAZORPAY",
      gatewayOrderId: `order_pending_${Date.now()}`,
      gatewayPaymentId: `pay_pending_${Date.now()}`,
    });

    const init = await initiateReturn(userToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    const returnId = init.body.data.returnRequest._id as string;

    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });
    const res = await processRefund(adminToken, returnId);

    expectError(res, 400);
  });

  it("rejects when order.gatewayPaymentId is missing (COD cannot be refunded via gateway)", async () => {
    const { accessToken: userToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken: userToken,
      paymentMethod: "COD",
      // no gatewayPaymentId
    });

    const init = await initiateReturn(userToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    const returnId = init.body.data.returnRequest._id as string;

    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });
    await arbitrateReturn(adminToken, returnId, ReturnStatus.APPROVED);

    const res = await processRefund(adminToken, returnId);
    expectError(res, 500);
  });

  it("returns 403 for a non-admin user", async () => {
    const { returnId } = await setupApprovedReturn();
    const { accessToken: userToken } = await createUserWithToken();

    const res = await processRefund(userToken, returnId);
    expectError(res, 403);
  });
});
