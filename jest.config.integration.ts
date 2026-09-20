import type { Config } from "jest";
import baseConfig from "./jest.config";

const config: Config = {
  ...baseConfig,
  displayName: "INTEGRATION",
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/jest.setup.ts",
    "<rootDir>/tests/setup/db.setup.ts",
    "<rootDir>/tests/setup/redis.setup.ts",
  ],
  maxWorkers: 1, // Run sequentially to avoid DB conflicts
  testTimeout: 30000,
};

export default config;
