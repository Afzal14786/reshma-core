import type { Config } from "jest";
import baseConfig from "./jest.config";

const config: Config = {
  ...baseConfig,
  displayName: "WORKERS",
  testMatch: ["<rootDir>/tests/workers/**/*.test.ts"],

  // ─────────────────────────────────────────────
  // CRITICAL: Worker tests need REAL BullMQ queues.
  //
  // The base jest.config.ts maps email.queue, invoice.queue, and
  // export.queue to jest.fn() mocks — correct for integration tests,
  // where we don't want real jobs firing during HTTP requests.
  //
  // For worker tests, the whole point is that a job flows through real
  // Redis into a real Worker instance. If the queue is mocked, then
  // `queue.add()` becomes a no-op and the worker never receives the job.
  //
  // This override re-declares moduleNameMapper WITHOUT the queue mocks
  // so the real Queue implementations load.
  // ─────────────────────────────────────────────
  moduleNameMapper: {
    // ── SPECIFIC MOCKS FIRST (Jest uses first-match-wins) ──
    "^@config/cloudinary$": "<rootDir>/tests/mocks/cloudinary.mock.ts",
    "^@config/typesense$": "<rootDir>/tests/mocks/typesense.mock.ts",
    "^@config/razorpay$": "<rootDir>/tests/mocks/razorpay.mock.ts",
    "^file-type$": "<rootDir>/tests/mocks/file-type.mock.ts",

    // NOTE: intentionally omitting these three entries so worker tests
    // hit the REAL queue implementations:
    //   - @shared/queues/email.queue
    //   - @shared/queues/invoice.queue
    //   - @shared/queues/export.queue

    // ── GENERIC PATH ALIASES SECOND ──
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },

  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/jest.setup.ts",
    "<rootDir>/tests/setup/db.setup.ts",
    "<rootDir>/tests/setup/redis.setup.ts",
    "<rootDir>/tests/setup/discriminators.setup.ts",
  ],
  maxWorkers: 1,
  testTimeout: 30000,
};

export default config;