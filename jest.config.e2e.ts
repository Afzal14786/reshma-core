import type { Config } from "jest";
import baseConfig from "./jest.config";

const config: Config = {
  ...baseConfig,
  displayName: "E2E",
  testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/jest.setup.ts",
    "<rootDir>/tests/setup/db.setup.ts",
    "<rootDir>/tests/setup/redis.setup.ts",
    "<rootDir>/tests/setup/discriminators.setup.ts",
  ],
  testTimeout: 60000,
  maxWorkers: 1,
};

export default config;
