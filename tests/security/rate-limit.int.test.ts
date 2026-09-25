// ──────────────────────────────────────────────
// Rate Limiting — per-endpoint quota behavior
// ──────────────────────────────────────────────
// Verifies the auth, checkout, and standard limiters trigger at their
// configured thresholds. Also verifies two security fixes:
//   1. Health endpoints bypass the standard limiter (skip predicate)
//   2. Support routes no longer double-count the standard limiter

import type { Response } from "supertest";
import { request } from "@tests/helpers/request.helper";
import { createUserWithToken } from "@tests/helpers/auth.helper";
import { expectSuccess, expectError } from "@tests/helpers/request.helper";

/**
 * Reads the RateLimit-Limit header (draft-6 format) as a number.
 */
function getRateLimitLimit(res: Response): number {
  const header = res.headers["ratelimit-limit"];
  return parseInt(String(header), 10);
}

function getRateLimitRemaining(res: Response): number {
  const header = res.headers["ratelimit-remaining"];
  return parseInt(String(header), 10);
}

describe("Rate Limiting — auth limiter", () => {
  it("does not trigger on the first 10 login attempts", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request
        .post("/api/v1/auth/login")
        .send({ email: "attacker@test.com", password: "wrong" });

      // Each of the first 10 attempts fails auth but must NOT be 429
      expect(res.status).not.toBe(429);
    }
  });

  it("triggers 429 on the 11th login attempt within the window", async () => {
    // Burn through the 10-attempt quota
    for (let i = 0; i < 10; i++) {
      await request
        .post("/api/v1/auth/login")
        .send({ email: "attacker@test.com", password: "wrong" });
    }

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: "attacker@test.com", password: "wrong" });

    expect(res.status).toBe(429);
  });

  it("exposes RateLimit-Limit = 10 on auth endpoints", async () => {
    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: "x@test.com", password: "wrong" });

    expect(getRateLimitLimit(res)).toBe(10);
  });

  it("returns a JSON body on 429 (not HTML)", async () => {
    for (let i = 0; i < 10; i++) {
      await request
        .post("/api/v1/auth/login")
        .send({ email: "x@test.com", password: "wrong" });
    }

    const res = await request
      .post("/api/v1/auth/login")
      .send({ email: "x@test.com", password: "wrong" });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(429);
    expect(typeof res.body.message).toBe("string");
  });
});

describe("Rate Limiting — checkout limiter", () => {
  it("exposes RateLimit-Limit = 5 on checkout endpoint", async () => {
    const { accessToken } = await createUserWithToken();

    const res = await request
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ paymentMethod: "COD" });

    // Order of operations: checkoutLimiter → validate → controller.
    // The limiter counts the request regardless of validation outcome.
    expect(getRateLimitLimit(res)).toBe(5);
  });

  it("triggers 429 on the 6th checkout attempt within the window", async () => {
    const { accessToken } = await createUserWithToken();

    // Burn through the 5-attempt quota (payload content doesn't matter —
    // the limiter runs before validation)
    for (let i = 0; i < 5; i++) {
      await request
        .post("/api/v1/orders/checkout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ paymentMethod: "COD" });
    }

    const res = await request
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ paymentMethod: "COD" });

    expect(res.status).toBe(429);
  });
});

describe("Rate Limiting — standard limiter and the health bypass", () => {
  it("regular endpoints expose RateLimit-Limit = 100", async () => {
    const res = await request.get("/api/v1/products?limit=1");
    expect(getRateLimitLimit(res)).toBe(100);
  });

  it("health endpoint exposes RateLimit-Limit = 3000 (healthLimiter only)", async () => {
    const res = await request.get("/api/v1/health");
    // Standard limiter is skipped for /api/v1/health, so the only
    // limiter contributing headers is healthLimiter (max 3000).
    expect(getRateLimitLimit(res)).toBe(3000);
  });
});

describe("Rate Limiting — support route dedup verification", () => {
  it("support routes consume only one standard limiter slot per request", async () => {
    const { accessToken } = await createUserWithToken();

    // Two requests to a support route (authenticated user passes USER gate)
    await request
      .get("/api/v1/support/tickets/me")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request
      .get("/api/v1/support/tickets/me")
      .set("Authorization", `Bearer ${accessToken}`);

    // 2 requests → 100 - 2 = 98 remaining.
    // BEFORE the dedup fix: 96 remaining (double-count).
    expect(getRateLimitRemaining(res)).toBe(98);
  });

  it("RateLimit-Reset header is present on limiter responses", async () => {
    const res = await request.get("/api/v1/products?limit=1");
    expect(res.headers["ratelimit-reset"]).toBeDefined();
    expect(Number(res.headers["ratelimit-reset"])).toBeGreaterThan(0);
  });
});
