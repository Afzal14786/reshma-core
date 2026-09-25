// ──────────────────────────────────────────────
// Security test helpers — status assertions + token formatting
// ──────────────────────────────────────────────

import type { Response } from "supertest";

/**
 * Asserts a 403 Forbidden response (RBAC denial).
 * Used when an authenticated user lacks the required role.
 */
export function expectForbidden(res: Response): void {
  expect(res.status).toBe(403);
  expect(res.body.success).toBe(false);
  expect(res.body.statusCode).toBe(403);
}

/**
 * Asserts a 401 Unauthorized response (missing/invalid JWT).
 * Used when no authentication is provided at all.
 */
export function expectUnauthorized(res: Response): void {
  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
  expect(res.body.statusCode).toBe(401);
}

/**
 * Asserts a 404 Not Found response (IDOR denial).
 * Used when a user requests a resource they don't own — 404 hides the
 * resource's existence, preventing enumeration.
 */
export function expectNotFound(res: Response): void {
  expect(res.status).toBe(404);
  expect(res.body.success).toBe(false);
  expect(res.body.statusCode).toBe(404);
}

/**
 * Formats a bearer token for the Authorization header.
 */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
