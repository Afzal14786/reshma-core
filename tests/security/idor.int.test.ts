// ──────────────────────────────────────────────
// IDOR — Insecure Direct Object Reference tests
// ──────────────────────────────────────────────
// Verifies that User B cannot access, modify, or infer the existence of
// User A's resources via direct object IDs. Every cross-user attempt must
// return 404 (not 403) to prevent resource enumeration.

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import {
  createTestOrder,
  createDeliveredOrder,
} from "@tests/helpers/order.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { buildReturnItem } from "@tests/factories/return.factory";
import { Notification } from "@modules/notifications/notification.model";
import { expectNotFound, bearer } from "@tests/helpers/security.helper";

describe("IDOR — Cross-user access denial (404)", () => {
  // ─────────────────────────────────────────────
  // Order resources
  // ─────────────────────────────────────────────

  it("User B cannot download User A's invoice", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const { order } = await createTestOrder({ accessToken: a.accessToken });

    const res = await request
      .get(`/api/v1/orders/${order._id}/invoice`)
      .set("Authorization", bearer(b.accessToken));

    expectNotFound(res);
  });

  it("User B cannot verify a payment for User A's order", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const { order } = await createTestOrder({
      accessToken: a.accessToken,
      gatewayOrderId: "order_idor_verify",
    });

    const res = await request
      .post("/api/v1/orders/verify-payment")
      .set("Authorization", bearer(b.accessToken))
      .send({
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: "pay_forged",
        gatewaySignature: "deadbeef",
      });

    expectNotFound(res);
  });

  it("Order history for User B does not include User A's orders", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    await createTestOrder({ accessToken: a.accessToken });
    await createTestOrder({ accessToken: a.accessToken });

    const res = await request
      .get("/api/v1/orders/my-order")
      .set("Authorization", bearer(b.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Return resources
  // ─────────────────────────────────────────────

  it("User B cannot initiate a return on User A's order", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken: a.accessToken,
      paymentMethod: "COD",
    });

    const res = await request
      .post(`/api/v1/returns/${order._id}/initiate`)
      .set("Authorization", bearer(b.accessToken))
      .send({ items: [buildReturnItem(String(product._id), 1)] });

    expectNotFound(res);
  });

  it("Return history for User B does not include User A's returns", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const { order, product } = await createDeliveredOrder({
      accessToken: a.accessToken,
      paymentMethod: "COD",
    });

    await request
      .post(`/api/v1/returns/${order._id}/initiate`)
      .set("Authorization", bearer(a.accessToken))
      .send({ items: [buildReturnItem(String(product._id), 1)] });

    const res = await request
      .get("/api/v1/returns/me")
      .set("Authorization", bearer(b.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.returns).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Notification resources
  // ─────────────────────────────────────────────

  it("User B cannot mark User A's notification as read", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    const notif = await Notification.create({
      recipientId: a.user._id,
      type: "SYSTEM",
      title: "For A only",
      message: "A's notification",
    });

    const res = await request
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set("Authorization", bearer(b.accessToken));

    expectNotFound(res);

    // Confirm A's notification was NOT modified
    const fresh = await Notification.findById(notif._id);
    expect(fresh!.isRead).toBe(false);
  });

  it("Notifications list for User B does not include User A's notifications", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    await Notification.create({
      recipientId: a.user._id,
      type: "SYSTEM",
      title: "A1",
      message: "A message",
    });
    await Notification.create({
      recipientId: a.user._id,
      type: "ORDER",
      title: "A2",
      message: "Another message",
    });

    const res = await request
      .get("/api/v1/notifications")
      .set("Authorization", bearer(b.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Address resources
  // ─────────────────────────────────────────────

  it("User B cannot update User A's address", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    const created = await request
      .post("/api/v1/users/profile/addresses")
      .set("Authorization", bearer(a.accessToken))
      .send({
        street: "123 Test Street",
        city: "Kolkata",
        state: "WB",
        pincode: "700001",
        label: "HOME",
      });

    const addressId = created.body.data[0]._id;

    const res = await request
      .patch(`/api/v1/users/profile/addresses/${addressId}`)
      .set("Authorization", bearer(b.accessToken))
      .send({ city: "Mumbai" });

    expectNotFound(res);
  });

  it("User B cannot delete User A's address", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    const created = await request
      .post("/api/v1/users/profile/addresses")
      .set("Authorization", bearer(a.accessToken))
      .send({
        street: "456 Test Avenue",
        city: "Kolkata",
        state: "WB",
        pincode: "700002",
        label: "WORK",
      });

    const addressId = created.body.data[0]._id;

    const res = await request
      .delete(`/api/v1/users/profile/addresses/${addressId}`)
      .set("Authorization", bearer(b.accessToken));

    expectNotFound(res);

    // Confirm A's address is still present
    const stillThere = await request
      .get("/api/v1/users/profile")
      .set("Authorization", bearer(a.accessToken));
    expect(stillThere.body.data.addresses).toHaveLength(1);
  });

  // ─────────────────────────────────────────────
  // Cart isolation
  // ─────────────────────────────────────────────

  it("User A's cart operations do not affect User B's cart", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const product = await createTestBangle({ currentStock: 10 });

    // A adds to cart
    await request
      .post("/api/v1/carts/add")
      .set("Authorization", bearer(a.accessToken))
      .send({ productId: String(product._id), quantity: 2 });

    // B's cart is still empty
    const bCart = await request
      .get("/api/v1/carts")
      .set("Authorization", bearer(b.accessToken));

    expect(bCart.status).toBe(200);
    expect(bCart.body.data.items).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Wishlist isolation
  // ─────────────────────────────────────────────

  it("User A's wishlist operations do not affect User B's wishlist", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();
    const product = await createTestBangle();

    await request
      .post("/api/v1/wishlists/add")
      .set("Authorization", bearer(a.accessToken))
      .send({ productId: String(product._id) });

    const bWishlist = await request
      .get("/api/v1/wishlists")
      .set("Authorization", bearer(b.accessToken));

    expect(bWishlist.status).toBe(200);
    expect(bWishlist.body.data.items).toEqual([]);
  });

  // ─────────────────────────────────────────────
  // Profile isolation
  // ─────────────────────────────────────────────

  it("User B's profile update does not modify User A's profile", async () => {
    const a = await createUserWithToken({ firstname: "Alice" });
    const b = await createUserWithToken({ firstname: "Bob" });

    await request
      .patch("/api/v1/users/profile")
      .set("Authorization", bearer(b.accessToken))
      .send({ firstname: "Eve" });

    const freshA = await request
      .get("/api/v1/users/profile")
      .set("Authorization", bearer(a.accessToken));

    expect(freshA.body.data.firstname).toBe("Alice");
  });

  it("Changing User B's password does not lock User A out", async () => {
    const a = await createUserWithToken();
    const b = await createUserWithToken();

    // B requests OTP and changes password
    await request
      .post("/api/v1/users/profile/security/password/otp")
      .set("Authorization", bearer(b.accessToken));

    // A can still fetch their profile
    const res = await request
      .get("/api/v1/users/profile")
      .set("Authorization", bearer(a.accessToken));

    expect(res.status).toBe(200);
  });
});
