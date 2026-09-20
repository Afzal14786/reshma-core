// ──────────────────────────────────────────────
// Redis Test Setup for INTEGRATION tests
// ──────────────────────────────────────────────
// IMPORTANT: The app uses node-redis (`redisClient` from @config/redis).
// server.ts normally calls connectRedis() during bootstrap, but tests
// import only app.ts — so we must explicitly connect it here.
// ──────────────────────────────────────────────

import { redisClient, connectRedis } from "@config/redis";

beforeAll(async () => {
  if (!redisClient.isOpen) {
    await connectRedis();
    // Wait until the client is fully ready before yielding to tests
    if (!redisClient.isReady) {
      await new Promise<void>((resolve) => redisClient.once("ready", () => resolve()));
    }
    console.log("🔗 Connected to test Redis (app client)");
  }
});

afterAll(async () => {
  if (redisClient.isOpen) {
    await redisClient.flushDb();
    await redisClient.quit();
    console.log("🔌 Disconnected from test Redis");
  }
});

beforeEach(async () => {
  if (redisClient.isOpen) {
    await redisClient.flushDb();
  }
});

// Kept for backward compat — some helpers import this
export function getTestRedis() {
  return redisClient;
}