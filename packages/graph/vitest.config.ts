import { defineConfig } from "vitest/config";
import { sharedCoverageConfig } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      ...sharedCoverageConfig,
      include: ["src/**/*.ts"],
    },
  },
});
