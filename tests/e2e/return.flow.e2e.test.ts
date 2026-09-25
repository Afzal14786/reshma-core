// ──────────────────────────────────────────────
// E2E — Full return / RMA lifecycle
// ──────────────────────────────────────────────
// Exercises: delivered order → initiate return → admin approve →
// process refund → inventory restock. Plus rejection and edge cases.

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createDeliveredOrder } from "@tests/helpers/order.helper";
import {
  initiateReturn,
  arbitrateReturn,
  processRefund,
} from "@tests/helpers/return.helper";
import { Product } from "@modules/products/models";
import { Order } from "@modules/orders/order.model";
import { ReturnStatus } from "@modules/returns/interfaces/return.interface";
import { buildReturnItem } from "@tests/factories/return.factory";
import { razorpay } from "@config/razorpay";

const mockedRefund = razorpay.payments.refund as unknown as jest.Mock;

describe("E2E — Return lifecycle", () => {
  it("golden path: delivered → initiate → approve → refund → restock", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "RAZORPAY",
      gatewayOrderId: `order_e2e_return_${Date.now()}`,
      gatewayPaymentId: `pay_e2e_return_${Date.now()}`,
    });

    const stockBefore = (await Product.findById(product._id))!.currentStock;

    // Initiate
    const initiated = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    expect(initiated.status).toBe(201);
    const returnId = initiated.body.data.returnRequest._id as string;
    expect(initiated.body.data.returnRequest.status).toBe(
      ReturnStatus.PENDING_APPROVAL,
    );

    // Admin approves
    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });
    const approved = await arbitrateReturn(
      adminToken,
      returnId,
      ReturnStatus.APPROVED,
    );
    expect(approved.status).toBe(200);
    expect(approved.body.data.returnRequest.status).toBe(ReturnStatus.APPROVED);

    // Admin processes refund
    mockedRefund.mockClear();
    const refunded = await processRefund(adminToken, returnId);
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.returnRequest.status).toBe(ReturnStatus.REFUNDED);
    expect(mockedRefund).toHaveBeenCalledTimes(1);

    // Verify DB state
    const freshOrder = await Order.findById(order._id);
    expect(freshOrder!.orderStatus).toBe("RETURNED");

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct!.currentStock).toBe(stockBefore + 1);
  });

  it("rejection: admin rejects → order reverts to DELIVERED, no restock", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });
    const stockBefore = (await Product.findById(product._id))!.currentStock;

    const initiated = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    const returnId = initiated.body.data.returnRequest._id as string;

    const { accessToken: adminToken } = await createUserWithToken({
      role: "ADMIN",
    });
    const rejected = await arbitrateReturn(
      adminToken,
      returnId,
      ReturnStatus.REJECTED,
      "Item not in resellable condition",
    );
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.returnRequest.status).toBe(ReturnStatus.REJECTED);

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder!.orderStatus).toBe("DELIVERED");

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct!.currentStock).toBe(stockBefore);
  });

  it("fragile item requires proof of damage image", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    // Mark product as fragile AFTER delivery
    await Product.updateOne(
      { _id: product._id },
      { $set: { isFragile: true } },
    );

    // Attempt without images
    const withoutImages = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    expect(withoutImages.status).toBe(400);

    // With images → succeeds
    const withImages = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
      images: ["https://example.com/damage.jpg"],
    });
    expect(withImages.status).toBe(201);
    expect(withImages.body.data.returnRequest.proofOfDamageImages).toHaveLength(
      1,
    );
  });

  it("cannot initiate return on a non-DELIVERED order", async () => {
    const { accessToken } = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });

    // Revert to SHIPPED
    await Order.updateOne(
      { _id: order._id },
      { $set: { orderStatus: "SHIPPED" } },
    );

    const res = await initiateReturn(accessToken, String(order._id), {
      items: [buildReturnItem(String(product._id), 1)],
    });
    expect(res.status).toBe(400);
  });
});
