import { request, expectSuccess, expectError } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { bangleMultipartFields } from "@tests/factories/product.factory";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "@config/cloudinary";

const API = "/api/v1/products";
const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const mockedUpload = uploadBufferToCloudinary as unknown as jest.Mock;
const mockedDelete = deleteFromCloudinary as unknown as jest.Mock;

async function postProduct(
  token: string,
  fields: Record<string, string>,
  files: { buffer: Buffer; name: string }[],
) {
  let req = request.post(API).set("Authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (const f of files) req = req.attach("images", f.buffer, f.name);
  return req;
}

describe("Product upload — Cloudinary pipeline", () => {
  it("uploads multiple images and stores every returned URL", async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    const res = await postProduct(accessToken, bangleMultipartFields(), [
      { buffer: fakePng, name: "a.png" },
      { buffer: fakePng, name: "b.png" },
      { buffer: fakePng, name: "c.png" },
    ]);

    expectSuccess(res, 201);
    expect(res.body.data.product.images).toHaveLength(3);
    expect(mockedUpload).toHaveBeenCalledTimes(3);
  });

  it("rolls back Cloudinary uploads when the DB write fails (duplicate SKU)", async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    const fields = bangleMultipartFields();

    // First: succeed to create the SKU
    await postProduct(accessToken, fields, [
      { buffer: fakePng, name: "first.png" },
    ]);

    mockedDelete.mockClear();

    // Second: same SKU — will trigger rollback
    await postProduct(accessToken, fields, [
      { buffer: fakePng, name: "second.png" },
    ]);

    expect(mockedDelete).toHaveBeenCalled();
  });

  it("stores the image under the correct folder based on itemType", async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    mockedUpload.mockClear();

    await postProduct(accessToken, bangleMultipartFields(), [
      { buffer: fakePng, name: "x.png" },
    ]);

    const folderArg = mockedUpload.mock.calls[0][1] as string;
    expect(folderArg).toBe("products/bangle");
  });

  it("does not upload to Cloudinary when Zod validation fails", async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    mockedUpload.mockClear();

    const fields = bangleMultipartFields();
    delete fields.hsnCode;

    await postProduct(accessToken, fields, [
      { buffer: fakePng, name: "x.png" },
    ]);

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("rejects requests without files (multer boundary)", async () => {
    const { accessToken } = await createUserWithToken({ role: "ADMIN" });
    const res = await request
      .post(API)
      .set("Authorization", `Bearer ${accessToken}`)
      .field("itemType", "BANGLE");

    expectError(res, 400);
  });
});