// ──────────────────────────────────────────────
// JWT — Authentication bypass tests
// ──────────────────────────────────────────────
// Verifies that the auth layer rejects every malformed, tampered,
// or algorithm-confused token. Also verifies that valid tokens issued
// to deleted or deactivated users cannot be used.

import jwt from "jsonwebtoken";
import { request, agent } from "@tests/helpers/request.helper";
import {
  createUserWithToken,
  createVerifiedUser,
} from "@tests/helpers/auth.helper";
import { User } from "@modules/users/user.model";
import { signAccessToken } from "@modules/auth/auth.utils";
import env from "@config/env";
import {
  expectUnauthorized,
  expectForbidden,
} from "@tests/helpers/security.helper";

// Protected endpoint used as the canary for every JWT test.
const PROFILE = "/api/v1/users/profile";

describe("JWT — Token integrity and lifecycle", () => {
  // ─────────────────────────────────────────────
  // Malformed / missing token
  // ─────────────────────────────────────────────

  it("rejects requests with no Authorization header", async () => {
    const res = await request.get(PROFILE);
    expectUnauthorized(res);
  });

  it("rejects an empty Bearer token", async () => {
    const res = await request.get(PROFILE).set("Authorization", "Bearer ");
    expectUnauthorized(res);
  });

  it("rejects a token with a malformed structure", async () => {
    const res = await request
      .get(PROFILE)
      .set("Authorization", "Bearer not.a.real.jwt");
    expectUnauthorized(res);
  });

  it("rejects a Bearer prefix without a value", async () => {
    const res = await request.get(PROFILE).set("Authorization", "Bearer");
    expectUnauthorized(res);
  });

  // ─────────────────────────────────────────────
  // Signature attacks
  // ─────────────────────────────────────────────

  it("rejects a token signed with the wrong secret", async () => {
    const { user } = await createVerifiedUser();
    const forged = jwt.sign(
      { id: String(user._id), jti: "forged" },
      "wrong-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      { expiresIn: "15m", algorithm: "HS256" },
    );

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${forged}`);
    expectUnauthorized(res);
  });

  it("rejects a token with alg: none", async () => {
    const { user } = await createVerifiedUser();
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ id: String(user._id), jti: "none-alg" }),
    ).toString("base64url");
    const unsigned = `${header}.${payload}.`;

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${unsigned}`);
    expectUnauthorized(res);
  });

  it("rejects algorithm confusion (HS512 signed token on HS256 verifier)", async () => {
    const { user } = await createVerifiedUser();
    // Sign with HS512 using the SAME secret. If the verifier allowed any
    // HMAC algorithm, this token would be accepted. It must not be.
    const token = jwt.sign(
      { id: String(user._id), jti: "alg-confusion" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "15m", algorithm: "HS512" },
    );

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${token}`);
    expectUnauthorized(res);
  });

  it("rejects a token with a tampered payload", async () => {
    const { user } = await createVerifiedUser();
    const { user: other } = await createVerifiedUser();

    const valid = signAccessToken(user._id as never);
    const [h, p, s] = valid.split(".");
    const decoded = JSON.parse(
      Buffer.from(p!, "base64url").toString("utf-8"),
    ) as { id: string; jti: string };
    decoded.id = String(other._id); // swap identity, keep signature
    const tampered = `${h}.${Buffer.from(JSON.stringify(decoded)).toString(
      "base64url",
    )}.${s}`;

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${tampered}`);
    expectUnauthorized(res);
  });

  // ─────────────────────────────────────────────
  // Expiry
  // ─────────────────────────────────────────────

  it("rejects an expired access token", async () => {
    const { user } = await createVerifiedUser();
    const expired = jwt.sign(
      { id: String(user._id), jti: "expired" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "-1h", algorithm: "HS256" },
    );

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${expired}`);
    expectUnauthorized(res);
  });

  // ─────────────────────────────────────────────
  // Valid signature, invalid user state
  // ─────────────────────────────────────────────

  it("rejects a valid token whose user has been deleted", async () => {
    const { user } = await createVerifiedUser();
    const token = signAccessToken(user._id as never);

    await User.deleteOne({ _id: user._id });

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${token}`);
    expectUnauthorized(res);
  });

  it("rejects a valid token whose user has been deactivated (403)", async () => {
    const { user } = await createVerifiedUser();
    const token = signAccessToken(user._id as never);

    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });

    const res = await request
      .get(PROFILE)
      .set("Authorization", `Bearer ${token}`);
    expectForbidden(res);
  });

  // ─────────────────────────────────────────────
  // Cookie-based auth (signed cookie path)
  // ─────────────────────────────────────────────

  it("accepts a valid token when sent via signed cookie (not Bearer)", async () => {
    const { user, plainPassword } = await createUserWithToken();
    const ag = agent();

    // Login populates the signed `jwt` cookie via setAccessCookie
    const loginRes = await ag
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: plainPassword });
    expect(loginRes.status).toBe(200);

    // No Authorization header — cookie must be used
    const res = await ag.get(PROFILE);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });
});
