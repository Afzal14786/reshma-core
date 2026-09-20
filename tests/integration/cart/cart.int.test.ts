import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken, clearAuthRedisKeys } from "@tests/helpers/auth.helper";
import { createTestProduct } from "@tests/helpers/product.helper";

describe("Cart API — /api/v1/carts", () => {
  beforeEach(async () => {
    await clearAuthRedisKeys();
  });

  async function setupUserAndProduct() {
    const { user, accessToken } = await createUserWithToken();
    const product = await createTestProduct();
    return { user, accessToken, product };
  }

  it("POST /add adds an item to an empty cart", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    const res = await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    expectSuccess(res, 200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it("POST /add increments quantity when same product is added twice", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    expectSuccess(res, 200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  it("POST /add returns 409 when stock is insufficient", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestProduct({ currentStock: 2 });

    const res = await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 5 });

    expectError(res, 409);
  });

  it("POST /add returns 400 on invalid productId format", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: "not-an-objectid", quantity: 1 });

    expectError(res, 400);
  });

  it("POST /add returns 401 without auth", async () => {
    const product = await createTestProduct();

    const res = await request
      .post("/api/v1/carts/add")
      .send({ productId: product._id.toString(), quantity: 1 });

    expectError(res, 401);
  });

  it("GET / returns the current cart", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request
      .get("/api/v1/carts")
      .set("Authorization", `Bearer ${accessToken}`);

    expectSuccess(res, 200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totals.grandTotal).toBeGreaterThan(0);
  });

  it("PATCH /update changes the item quantity", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request
      .patch("/api/v1/carts/update")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 4 });

    expectSuccess(res, 200);
    expect(res.body.data.items[0].quantity).toBe(4);
  });

  it("DELETE /item/:productId removes the item", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request
      .delete(`/api/v1/carts/item/${product._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expectSuccess(res, 200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("DELETE /clear empties the entire cart", async () => {
    const { accessToken, product } = await setupUserAndProduct();

    await request
      .post("/api/v1/carts/add")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    const res = await request
      .delete("/api/v1/carts/clear")
      .set("Authorization", `Bearer ${accessToken}`);

    expectSuccess(res, 200);

    const getRes = await request
      .get("/api/v1/carts")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(getRes.body.data.items).toHaveLength(0);
  });

  it("POST /merge combines a guest cart into the user's cart", async () => {
    const { accessToken } = await createUserWithToken();
    const product = await createTestProduct();

    const res = await request
      .post("/api/v1/carts/merge")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ productId: product._id.toString(), quantity: 2 }],
      });

    expectSuccess(res, 200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });
});