import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createDeliveredOrder } from "@tests/helpers/order.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { User } from "@modules/users/user.model";
import { Order } from "@modules/orders/order.model";
import { Cart } from "@modules/cart/cart.model";
import { ReturnModel } from "@modules/returns/return.model";
import {
  ReturnReason,
  ReturnStatus,
} from "@modules/returns/interfaces/return.interface";
import { buildReturnItem } from "@tests/factories/return.factory";
import { initiateReturn } from "@tests/helpers/return.helper";

const API = "/api/v1/users/profile";

describe("DELETE /api/v1/users/profile — DPDP Right to be Forgotten", () => {
  it("removes the user document", async () => {
    const { user, accessToken } = await createUserWithToken();

    const res = await request
      .delete(API)
      .set("Authorization", `Bearer ${accessToken}`);

    expectSuccess(res, 200);

    const fresh = await User.findById(user._id);
    expect(fresh).toBeNull();
  });

  it("anonymizes the user's historical orders (PII scrambled, math preserved)", async () => {
    const { accessToken } = await createUserWithToken();
    const { order } = await createDeliveredOrder({
      accessToken,
      paymentMethod: "COD",
    });
    const originalTotal = order.pricing.totalAmount;

    await request.delete(API).set("Authorization", `Bearer ${accessToken}`);

    const fresh = await Order.findById(order._id);
    expect(fresh).not.toBeNull();
    expect(fresh!.shippingAddress.fullName).toBe("Deleted User");
    expect(fresh!.shippingAddress.phone).toBe("0000000000");
    expect(fresh!.shippingAddress.city).toBe("Anonymized");
    // Financial records preserved
    expect(fresh!.pricing.totalAmount).toBe(originalTotal);
  });

  it("deletes the user's cart", async () => {
    const { user, accessToken } = await createUserWithToken();
    const product = await createTestBangle();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    await request.delete(API).set("Authorization", `Bearer ${accessToken}`);

    const freshCart = await Cart.findOne({ user: user._id });
    expect(freshCart).toBeNull();
  });

  it("subsequent authenticated requests fail (user no longer exists)", async () => {
    const { accessToken } = await createUserWithToken();

    await request.delete(API).set("Authorization", `Bearer ${accessToken}`);

    const res = await request
      .get("/api/v1/users/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expectError(res, 401);
  });

  it("returns 401 without auth", async () => {
    const res = await request.delete(API);
    expectError(res, 401);
  });
});
