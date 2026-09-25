// ──────────────────────────────────────────────
// Injection — NoSQL operators, prototype pollution, malformed IDs
// ──────────────────────────────────────────────
// Verifies that the sanitizer middleware strips MongoDB operator keys
// ($-prefixed) and prototype-pollution keys (__proto__, constructor,
// prototype) before Zod validation runs — and that malformed inputs
// never reach the database as raw objects.

import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";

const PROFILE = "/api/v1/users/profile";
const PRODUCTS = "/api/v1/products";
const CART_ADD = "/api/v1/carts/add";

describe("Injection — NoSQL operators rejected in body", () => {
  it("rejects $ne operator in productId (cart add)", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: { $ne: null },
        quantity: 1,
      });

    // Sanitizer strips $ne, Zod requires string → 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects $gt operator in quantity (cart add)", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: "507f1f77bcf86cd799439011",
        quantity: { $gt: 0 },
      });

    expect(res.status).toBe(400);
  });

  it("neutralizes $where operator in profile update (sanitizer strips it)", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .patch(PROFILE)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        firstname: "Bob",
        $where: "this.isAdmin === true",
      });

    // The sanitizer strips $where BEFORE Zod runs. The remaining payload
    // { firstname: "Bob" } is valid, so the request succeeds. Verify the
    // sanitizer neutralized the attack by confirming:
    //   - No 500 (no raw operator hit the DB)
    //   - The legitimate field was persisted
    //   - No privilege escalation occurred (role still USER)
    expect(res.status).toBeLessThan(500);
    expect(res.body.data.firstname).toBe("Bob");
    expect(res.body.data.role).toBe("USER");
  });
});

describe("Injection — Prototype pollution", () => {
  it("strips __proto__ key from request body", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .patch(PROFILE)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        firstname: "Bob",
        __proto__: { isAdmin: true },
      } as unknown as Record<string, unknown>);

    // Sanitizer removes __proto__ before Zod runs.
    // Zod .strict() rejects the request if any unknown key survives,
    // otherwise firstname is updated and admin status is untouched.
    // Either way, no 500 and the user's role must remain USER.
    expect(res.status).toBeLessThan(500);

    const me = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(me.body.data.role).toBe("USER");
  });

  it("strips constructor key from request body", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .patch(PROFILE)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        firstname: "Alice",
        constructor: { prototype: { polluted: true } },
      } as unknown as Record<string, unknown>);

    expect(res.status).toBeLessThan(500);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("Injection — Malformed identifiers", () => {
  it("rejects malformed ObjectId in path param (get product)", async () => {
    const res = await request.get(`${PRODUCTS}/not-a-valid-objectid`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects malformed ObjectId in path param (id with injection payload)", async () => {
    const res = await request.get(
      `${PRODUCTS}/${encodeURIComponent("{$ne:null}")}`,
    );
    expect(res.status).toBe(400);
  });

  it("neutralizes $ne operator in query param (sanitizer strips it)", async () => {
    const res = await request
      .get(PRODUCTS)
      .query({ itemType: { $ne: "NONE" } as unknown as string });

    // Sanitizer strips $ne from the query, leaving an empty filter.
    // Zod's schema treats itemType as optional, so the request succeeds
    // and returns the full catalog. Verify:
    //   - No 500 (no raw operator hit the DB)
    //   - Response has the expected shape (products + meta)
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.meta).toBeDefined();
  });

  it("handles $where in query string without a 500 (sanitized)", async () => {
    const res = await request
      .get(PRODUCTS)
      .query({ $where: "malicious" } as unknown as Record<string, string>);

    // Sanitizer strips $where entirely; Zod sees an empty query → success.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Injection — Zod .strict() unknown field rejection", () => {
  it("rejects unknown fields on cart add", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .post(CART_ADD)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId: "507f1f77bcf86cd799439011",
        quantity: 1,
        maliciousField: "should-not-be-allowed",
      });

    expect(res.status).toBe(400);
  });

  it("rejects unknown fields on profile update", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .patch(PROFILE)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        firstname: "Bob",
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
  });
});
