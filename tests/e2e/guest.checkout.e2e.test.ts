// ──────────────────────────────────────────────
// E2E — Guest cart merge flow
// ──────────────────────────────────────────────
// Simulates a shopper adding items as a guest (localStorage), then
// logging in to merge and complete checkout.

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";

const MERGE_CART = "/api/v1/carts/merge";
const CHECKOUT = "/api/v1/orders/checkout";

const SHIPPING = {
  fullName: "Guest Buyer",
  phone: "+919876543210",
  streetAddress: "123 Guest Street",
  city: "Kolkata",
  state: "WB",
  postalCode: "700001",
  country: "India",
};

describe("E2E — Guest cart merge", () => {
  it("merges a guest cart into the user's cart on login", async () => {
    const { accessToken } = await createUserWithToken();
    const p1 = await createTestBangle({ currentStock: 10 });
    const p2 = await createTestBangle({ currentStock: 10 });

    const res = await request
      .post(MERGE_CART)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [
          { productId: String(p1._id), quantity: 2 },
          { productId: String(p2._id), quantity: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);

    const ids = res.body.data.items
      .map((i: { product: { _id: string } }) => i.product._id)
      .sort();
    expect(ids).toEqual([String(p1._id), String(p2._id)].sort());
  });

  it("merges guest cart with existing cart (same product increments quantity)", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ currentStock: 10 });

    // Existing cart: 2 units
    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 2 });

    // Guest cart also has 3 units of the same product
    const res = await request
      .post(MERGE_CART)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ productId: String(product._id), quantity: 3 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it("merged cart can be checked out end-to-end", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({
      basePrice: 1500,
      currentStock: 10,
    });

    await request
      .post(MERGE_CART)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ productId: String(product._id), quantity: 2 }],
      });

    const checkout = await request
      .post(CHECKOUT)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ shippingAddress: SHIPPING, paymentMethod: "COD" });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order.items).toHaveLength(1);
    expect(checkout.body.data.order.items[0].quantity).toBe(2);
  });
});
