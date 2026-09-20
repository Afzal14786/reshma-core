// ──────────────────────────────────────────────
// Environment Validation
// Ensures all required test env vars are present
// ──────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
] as const;

export function validateTestEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required test environment variables: ${missing.join(", ")}\n` +
        `Ensure .env.test is properly configured.`,
    );
  }

  // Safety guard: prevent tests from running against production
  const mongoUri = process.env.MONGO_URI ?? "";
  if (
    mongoUri.includes("prod") ||
    mongoUri.includes("production") ||
    mongoUri.includes("reshma-boutique-dev")
  ) {
    throw new Error(
      "🚨 SAFETY ABORT: MONGO_URI appears to point to a non-test database. " +
        "Tests must NEVER run against development or production.",
    );
  }

  // Safety guard: ensure DB name ends with _test
  const dbName = mongoUri.split("/").pop()?.split("?")[0] ?? "";
  if (!dbName.includes("test")) {
    throw new Error(
      `🚨 SAFETY ABORT: Test database name "${dbName}" does not contain "test". ` +
        `Refusing to run tests against a non-test database.`,
    );
  }

  console.log("✅ Test environment validated successfully.");
}