// ──────────────────────────────────────────────
// Global Jest Setup
// Runs once before each test file
// ──────────────────────────────────────────────

import { config } from "dotenv";
import path from "path";

// Load test environment variables FIRST
config({ path: path.resolve(__dirname, "../../.env.test") });

// Set test timeout
jest.setTimeout(30000);

// Suppress console noise during tests (optional)
if (process.env.NODE_ENV === "test") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// ── Custom Matchers (optional) ──
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});