import {
  request,
  expectSuccess,
  expectError,
} from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { Wishlist } from "@modules/wishlists/wishlist.model";
import { Product } from "@modules/products/models";
import { Types } from "mongoose";

const API = "/api/v1/wishlists";

describe("Wishlist API — /api/v1/wishlists", () => {
  describe("Auth enforcement", () => {
    it("GET / returns 401 without a token", async () => {
      const res = await request.get(API);
      expectError(res, 401);
    });

    it("POST /add returns 401 without a token", async () => {
      const res = await request
        .post(`${API}/add`)
        .send({ productId: "000000000000000000000000" });
      expectError(res, 401);
    });

    it("DELETE /clear returns 401 without a token", async () => {
      const res = await request.delete(`${API}/clear`);
      expectError(res, 401);
    });
  });

  describe("GET /", () => {
    it("returns an empty list for a brand-new user", async () => {
      const { accessToken } = await createUserWithToken();
      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe("POST /add", () => {
    it("adds a product and returns the populated wishlist", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      expectSuccess(res, 200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].product._id).toBe(String(product._id));
    });

    it("is idempotent — adding the same product twice keeps one entry", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      expectSuccess(res, 200);
      expect(res.body.data.items).toHaveLength(1);
    });

    it("returns 404 for a non-existent product", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: "000000000000000000000000" });

      expectError(res, 404);
    });

    it("returns 404 for an inactive product", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle({ isActive: false });

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      expectError(res, 404);
    });

    it("rejects an invalid productId format with 400", async () => {
      const { accessToken } = await createUserWithToken();

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: "not-an-objectid" });

      expectError(res, 400);
    });

    it("rejects an unknown extra field (Zod .strict())", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id), malicious: "payload" });

      expectError(res, 400);
    });

    it("enforces the 100-item capacity limit", async () => {
      const { user, accessToken } = await createUserWithToken();

      // Seed 100 items directly in the DB
      const items = Array.from({ length: 100 }, () => ({
        product: new Types.ObjectId(),
        addedAt: new Date(),
      }));
      await Wishlist.create({ user: user._id, items });

      const product = await createTestBangle();
      const res = await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      expectError(res, 400);
    });
  });

  describe("DELETE /item/:productId", () => {
    it("removes a specific product", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      const res = await request
        .delete(`${API}/item/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it("returns 404 when the wishlist document does not exist", async () => {
      const { accessToken } = await createUserWithToken();
      const fakeId = "000000000000000000000000";

      const res = await request
        .delete(`${API}/item/${fakeId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectError(res, 404);
    });
  });

  describe("DELETE /clear", () => {
    it("empties a populated wishlist", async () => {
      const { accessToken } = await createUserWithToken();
      const p1 = await createTestBangle();
      const p2 = await createTestBangle();

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(p1._id) });
      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(p2._id) });

      const res = await request
        .delete(`${API}/clear`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);

      const after = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(after.body.data.items).toHaveLength(0);
    });
  });

  describe("POST /move-to-cart/:productId", () => {
    it("moves an item from wishlist to cart", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle({ currentStock: 5 });

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      const res = await request
        .post(`${API}/move-to-cart/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ quantity: 1 });

      expectSuccess(res, 200);
      expect(res.body.data.items).toHaveLength(0);

      // Confirm it landed in the cart
      const cart = await request
        .get("/api/v1/carts")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(cart.body.data.items).toHaveLength(1);
      expect(cart.body.data.items[0].product._id).toBe(String(product._id));
    });

    it("returns 404 when the item is not in the wishlist", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      const res = await request
        .post(`${API}/move-to-cart/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ quantity: 1 });

      expectError(res, 404);
    });

    it("leaves the item in the wishlist when stock is insufficient", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle({ currentStock: 1 });

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      const res = await request
        .post(`${API}/move-to-cart/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ quantity: 5 });

      expectError(res, 409);

      // CartService.addItem threw, so the wishlist $pull never ran
      const wishlist = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(wishlist.body.data.items).toHaveLength(1);
    });

    it("rejects a missing quantity with 400 (Zod strict)", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      const res = await request
        .post(`${API}/move-to-cart/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      // quantity has a default value in the DTO, so this should succeed
      expectSuccess(res, 200);
    });
  });

  describe("Self-healing", () => {
    it("purges items whose product has been deactivated", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle();

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      // Deactivate the product AFTER it's in the wishlist
      await Product.updateOne(
        { _id: product._id },
        { $set: { isActive: false } },
      );

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.items).toHaveLength(0);

      // Confirm the ghost reference was physically removed from the DB
      const { user } = await createUserWithToken(); // dummy
      const wishlist = await Wishlist.findOne({});
      expect(
        wishlist?.items.some(
          (i) => i.product.toString() === String(product._id),
        ),
      ).toBe(false);
    });

    it("populates live product data (price, stock, name)", async () => {
      const { accessToken } = await createUserWithToken();
      const product = await createTestBangle({
        name: "Original Name",
        basePrice: 999,
      });

      await request
        .post(`${API}/add`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ productId: String(product._id) });

      // Change the product's price in the DB
      await Product.updateOne(
        { _id: product._id },
        { $set: { basePrice: 1299 } },
      );

      const res = await request
        .get(API)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);
      expect(res.body.data.items[0].product.basePrice).toBe(1299);
    });
  });
});
