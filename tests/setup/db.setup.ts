// ──────────────────────────────────────────────
// MongoDB Test Setup for INTEGRATION tests
// ──────────────────────────────────────────────

import mongoose from "mongoose";
import { validateTestEnv } from "./env.setup";

beforeAll(async () => {
  validateTestEnv();

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 10_000,
      driverInfo: {
        name: "reshma-core-tests",
        version: "1.0.0",
      },
    });
    console.log("🔗 Connected to integration MongoDB");
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    // ─────────────────────────────────────────────
    // FIX: Do NOT dropDatabase().
    //
    // dropDatabase() deletes all indexes on the collection.
    // The next test file's first transaction then races
    // against Mongoose's lazy index rebuild and fails
    // with "Unable to acquire IX lock within 5ms".
    //
    // beforeEach() already wipes documents via deleteMany,
    // which preserves indexes AND provides clean state.
    // ─────────────────────────────────────────────
    await mongoose.connection.close();
    console.log("🔌 Disconnected from integration MongoDB");
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});