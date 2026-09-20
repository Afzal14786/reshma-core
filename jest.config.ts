// ──────────────────────────────────────────────
// Reshma-Core Base Jest Configuration
// ──────────────────────────────────────────────

import type { Config } from "jest";

const baseConfig: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",

    // ── ESM-only packages: swap for CJS-safe mocks ──
    "^file-type$": "<rootDir>/tests/mocks/file-type.mock.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.interface.ts",
    "!src/**/*.model.ts",
    "!src/server.ts",
    "!src/db/seed.ts",
    "!src/**/*.routes.ts",
    "!src/shared/types/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "html", "json-summary"],
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 80,
      functions: 85,
      statements: 85,
    },
  },
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: false,
};

export default baseConfig;