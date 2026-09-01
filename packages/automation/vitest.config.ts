import { defineConfig } from "vitest/config";
import { coverageFor } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: coverageFor("packages/automation", {
      include: ["src/**/*.ts"],
    }),
  },
});
