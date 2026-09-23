import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import {
  bangleMultipartFields,
  apparelMultipartFields,
  fabricMultipartFields,
  innerwearMultipartFields,
  accessoryMultipartFields,
} from "@tests/factories/product.factory";

const API = "/api/v1/products";
const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function postProduct(
  token: string,
  fields: Record<string, string>,
) {
  let req = request.post(API).set("Authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req.attach("images", fakePng, "test.png");
}

describe("Product Discriminators — polymorphic creation", () => {
  let adminToken: string;
  beforeEach(async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    adminToken = accessToken;
  });

  // ── BANGLE ──
  it("creates BANGLE with valid bangleSizes and packSize", async () => {
    const res = await postProduct(
      adminToken,
      bangleMultipartFields({ bangleSizes: JSON.stringify(["2.2", "2.8"]) }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.bangleSizes).toEqual(["2.2", "2.8"]);
  });

  it("rejects BANGLE with invalid bangleSize", async () => {
    const res = await postProduct(
      adminToken,
      bangleMultipartFields({ bangleSizes: JSON.stringify(["3.5"]) }),
    );
    expectError(res, 400);
  });

  it("rejects BANGLE without bangleSizes", async () => {
    const fields = bangleMultipartFields();
    delete fields.bangleSizes;
    const res = await postProduct(adminToken, fields);
    expectError(res, 400);
  });

  // ── APPAREL ──
  it("creates APPAREL with valid sizes", async () => {
    const res = await postProduct(
      adminToken,
      apparelMultipartFields({ sizes: JSON.stringify(["S", "M", "XL"]) }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.sizes).toEqual(["S", "M", "XL"]);
  });

  it("rejects APPAREL with invalid size value", async () => {
    const res = await postProduct(
      adminToken,
      apparelMultipartFields({ sizes: JSON.stringify(["XXXL"]) }),
    );
    expectError(res, 400);
  });

  // ── FABRIC ──
  it("creates FABRIC with lengthMeters", async () => {
    const res = await postProduct(
      adminToken,
      fabricMultipartFields({ lengthMeters: "7.5" }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.lengthMeters).toBe(7.5);
  });

  it("rejects FABRIC without lengthMeters", async () => {
    const fields = fabricMultipartFields();
    delete fields.lengthMeters;
    const res = await postProduct(adminToken, fields);
    expectError(res, 400);
  });

  // ── INNERWEAR ──
  it("creates INNERWEAR with valid cupSizes", async () => {
    const res = await postProduct(
      adminToken,
      innerwearMultipartFields({ cupSizes: JSON.stringify(["34B", "36D"]) }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.cupSizes).toEqual(["34B", "36D"]);
  });

  it("forces isReturnable to false even when client sends true (security lock)", async () => {
    const res = await postProduct(
      adminToken,
      innerwearMultipartFields({ isReturnable: "true" }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.isReturnable).toBe(false);
  });

  // ── ACCESSORY ──
  it("creates ACCESSORY with sizeDetails", async () => {
    const res = await postProduct(
      adminToken,
      accessoryMultipartFields({ sizeDetails: "One Size Fits All" }),
    );
    expectSuccess(res, 201);
    expect(res.body.data.product.sizeDetails).toBe("One Size Fits All");
  });

  it("rejects ACCESSORY without sizeDetails", async () => {
    const fields = accessoryMultipartFields();
    delete fields.sizeDetails;
    const res = await postProduct(adminToken, fields);
    expectError(res, 400);
  });

  // ── Mismatch ──
  it("rejects unknown itemType", async () => {
    const res = await postProduct(adminToken, {
      ...bangleMultipartFields(),
      itemType: "NONEXISTENT",
    });
    expectError(res, 400);
  });
});