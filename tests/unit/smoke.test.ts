// ──────────────────────────────────────────────
// PHASE 0 SMOKE TEST — Infrastructure only
// No DB. No external services. Just proves the harness works.
// ──────────────────────────────────────────────

import Redis from "ioredis";

describe("🔬 Phase 0 — Infrastructure Smoke Test", () => {
  describe("Environment Variables", () => {
    it("should load NODE_ENV as 'test'", () => {
      expect(process.env.NODE_ENV).toBe("test");
    });

    it("should have all critical env vars present", () => {
      expect(process.env.JWT_ACCESS_SECRET).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
      expect(process.env.COOKIE_SECRET).toBeDefined();
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
    });
  });

  describe("Redis Connection", () => {
    let redis: Redis;

    beforeAll(async () => {
      redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
      await redis.connect();
    });

    afterAll(async () => {
      if (redis) {
        try {
          await redis.flushdb();
          await redis.quit();
        } catch {
          redis.disconnect();
        }
      }
    });

    it("should connect to test Redis", () => {
      expect(redis.status).toBe("ready");
    });

    it("should perform set → get → del cycle", async () => {
      await redis.set("smoke:key", "phase-0-ok");
      expect(await redis.get("smoke:key")).toBe("phase-0-ok");
      await redis.del("smoke:key");
      expect(await redis.get("smoke:key")).toBeNull();
    });
  });

  describe("TypeScript Path Aliases", () => {
    it("should resolve @config/* alias", async () => {
      const envModule = await import("@config/env");
      expect(envModule.default).toBeDefined();
    });

    it("should resolve @shared/* alias", async () => {
      const appError = await import("@shared/utils/app-error");
      expect(appError.AppError).toBeDefined();
    });
  });

  describe("Express Application", () => {
    it("should load the Express app without crashing", async () => {
      const appModule = await import("../../src/app");
      expect(typeof appModule.default).toBe("function");
    });
  });

  describe("Custom Matchers", () => {
    it("should support toBeWithinRange matcher", () => {
      expect(100).toBeWithinRange(50, 150);
    });
  });
});
