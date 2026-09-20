// ──────────────────────────────────────────────
// Supertest wrapper with auth helpers
// ──────────────────────────────────────────────

import supertest from "supertest";
import type { Response } from "supertest";
import app from "../../src/app";

export const request = supertest(app);

/**
 * Returns an "agent" that persists cookies between requests.
 */
export function agent() {
  return supertest.agent(app);
}

/**
 * Asserts a successful response with the standard ApiResponse shape.
 * Prints the response body on failure for debuggability.
 */
export function expectSuccess(res: Response, expectedStatus = 200): void {
  if (res.status !== expectedStatus) {
    process.stderr.write(
      `\n[expectSuccess FAIL] expected ${expectedStatus}, got ${res.status}\n` +
        `BODY: ${JSON.stringify(res.body, null, 2)}\n\n`,
    );
  }
  expect(res.status).toBe(expectedStatus);
  expect(res.body.success).toBe(true);
  expect(res.body.statusCode).toBe(expectedStatus);
  expect(res.body.message).toBeDefined();
  expect(res.body.timestamp).toBeDefined();
}

/**
 * Asserts an error response matching the error.middleware format.
 * Prints the response body on failure for debuggability.
 */
export function expectError(res: Response, expectedStatus: number): void {
  if (res.status !== expectedStatus) {
    process.stderr.write(
      `\n[expectError FAIL] expected ${expectedStatus}, got ${res.status}\n` +
        `BODY: ${JSON.stringify(res.body, null, 2)}\n\n`,
    );
  }
  expect(res.status).toBe(expectedStatus);
  expect(res.body.success).toBe(false);
  expect(res.body.statusCode).toBe(expectedStatus);
  expect(res.body.message).toBeDefined();
}