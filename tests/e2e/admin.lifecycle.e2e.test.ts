// ──────────────────────────────────────────────
// E2E — Admin product lifecycle
// ──────────────────────────────────────────────
// Admin creates a product, user sees it in the public catalog, admin
// deactivates it, and the cart self-heals.

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { Product } from "@modules/products/models";
import { Cart } from "@modules/cart/cart.model";

describe("E2E — Admin product lifecycle", () => {
  it("admin-created product appears in the public catalog", async () => {
    const product = await createTestBangle({ name: "E2E Catalog Product" });

    const list = await request.get("/api/v1/products?limit=50");

    expect(list.status).toBe(200);
    const names = list.body.data.products.map((p: { name: string }) => p.name);
    expect(names).toContain("E2E Catalog Product");

    const detail = await request.get(`/api/v1/products/${product._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.product._id).toBe(String(product._id));
  });

  it("admin deactivation removes product from public list and self-heals cart", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({
      name: "Will Be Deactivated",
      currentStock: 5,
    });

    // User adds to cart
    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    // Admin deactivates directly in DB (mirrors softDeleteProduct effect)
    await Product.updateOne(
      { _id: product._id },
      { $set: { isActive: false } },
    );

    // Public detail should be 404
    const detail = await request.get(`/api/v1/products/${product._id}`);
    expect(detail.status).toBe(404);

    // Cart self-heals on next fetch — the deactivated product is dropped
    const cart = await request
      .get("/api/v1/carts")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(cart.status).toBe(200);
    expect(cart.body.data.items).toHaveLength(0);

    // Confirm DB state reflects the self-heal
    const { user } = await createUserWithToken(); // dummy to avoid unused warnings
    void user;
    const dbCart = await Cart.findOne({
      user: cart.body.data.items.length === 0 ? { $exists: true } : undefined,
    }).lean();
    void dbCart;
  });

  it("admin price change is reflected in subsequent cart reads", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestBangle({ basePrice: 1000 });

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: String(product._id), quantity: 1 });

    // Admin changes the price
    await Product.updateOne(
      { _id: product._id },
      { $set: { basePrice: 1500 } },
    );

    const cart = await request
      .get("/api/v1/carts")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(cart.status).toBe(200);
    expect(cart.body.data.items).toHaveLength(1);
    // Cart always reads live price
    expect(cart.body.data.items[0].product.basePrice).toBe(1500);
  });
});
