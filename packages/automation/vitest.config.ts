import { defineConfig } from "vitest/config";
import { sharedCoverageConfig } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      ...sharedCoverageConfig,
      include: ["src/**/*.ts"],
    },
  },
});
