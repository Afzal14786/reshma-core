import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { createTestBangle } from "@tests/helpers/product.helper";
import { bangleMultipartFields } from "@tests/factories/product.factory";

const API = "/api/v1/products";
const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function postProduct(
  accessToken: string,
  fields: Record<string, string>,
  buffer: Buffer = fakePng,
) {
  let req = request.post(API).set("Authorization", `Bearer ${accessToken}`);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  req = req.attach("images", buffer, "test.png");
  return req;
}

describe("Product CRUD — /api/v1/products", () => {
  // ── CREATE ──
  describe("POST /", () => {
    it("admin creates a BANGLE successfully", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const res = await postProduct(accessToken, bangleMultipartFields());

      expectSuccess(res, 201);
      expect(res.body.data.product.itemType).toBe("BANGLE");
      expect(res.body.data.product.images.length).toBeGreaterThan(0);
    });

    it("rejects duplicate SKU with 409", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const fields = bangleMultipartFields();

      await postProduct(accessToken, fields);
      const res = await postProduct(accessToken, fields);

      expectError(res, 409);
    });

    it("rejects request without an image with 400", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const res = await request
        .post(API)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("itemType", "BANGLE");

      expectError(res, 400);
    });

    it("rejects non-admin users with 403", async () => {
      const { accessToken } = await createUserWithToken({ role: "USER" });
      const res = await postProduct(accessToken, bangleMultipartFields());
      expectError(res, 403);
    });
  });

  // ── READ (public) ──
  describe("GET /", () => {
    it("returns only active products", async () => {
      await createTestBangle({ name: "Active" });
      await createTestBangle({ name: "Inactive", isActive: false });

      const res = await request.get(API);
      expectSuccess(res, 200);
      const names = res.body.data.products.map((p: { name: string }) => p.name);
      expect(names).toContain("Active");
      expect(names).not.toContain("Inactive");
    });

    it("filters by itemType", async () => {
      await createTestBangle();

      const res = await request.get(API).query({ itemType: "BANGLE" });
      expectSuccess(res, 200);
      expect(res.body.data.products.length).toBeGreaterThan(0);
      expect(res.body.data.products[0].itemType).toBe("BANGLE");
    });

    it("supports pagination via limit", async () => {
      for (let i = 0; i < 3; i++) await createTestBangle();

      const res = await request.get(API).query({ limit: 2 });
      expectSuccess(res, 200);
      expect(res.body.data.products.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta.limit).toBe(2);
    });
  });

  describe("GET /:id", () => {
    it("returns a product by ID", async () => {
      const product = await createTestBangle();
      const res = await request.get(`${API}/${product._id}`);
      expectSuccess(res, 200);
      expect(res.body.data.product._id).toBe(String(product._id));
    });

    it("returns 404 for an inactive product", async () => {
      const product = await createTestBangle({ isActive: false });
      const res = await request.get(`${API}/${product._id}`);
      expectError(res, 404);
    });
  });

  // ── UPDATE ──
  describe("PATCH /:id", () => {
    it("admin updates name and price", async () => {
      const product = await createTestBangle();
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });

      const res = await request
        .patch(`${API}/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Updated Name", basePrice: 2500 });

      expectSuccess(res, 200);
      expect(res.body.data.product.name).toBe("Updated Name");
      expect(res.body.data.product.basePrice).toBe(2500);
    });

    it("returns 404 for a non-existent product", async () => {
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });
      const res = await request
        .patch(`${API}/000000000000000000000000`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Nope" });

      expectError(res, 404);
    });
  });

  // ── SOFT DELETE ──
  describe("DELETE /:id", () => {
    it("admin soft-deletes — isActive becomes false", async () => {
      const product = await createTestBangle({ isActive: true });
      const { accessToken } = await createUserWithToken({ role: "ADMIN" });

      const res = await request
        .delete(`${API}/${product._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expectSuccess(res, 200);

      const after = await request.get(`${API}/${product._id}`);
      expectError(after, 404);
    });
  });
});