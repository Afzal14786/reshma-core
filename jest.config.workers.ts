import type { Config } from "jest";
import baseConfig from "./jest.config";

const config: Config = {
  ...baseConfig,
  displayName: "WORKERS",
  testMatch: ["<rootDir>/tests/workers/**/*.test.ts"],
  setupFilesAfterEnv: [
    "<rootDir>/tests/setup/jest.setup.ts",
    "<rootDir>/tests/setup/redis.setup.ts",
  ],
  maxWorkers: 1,
};

export default config;