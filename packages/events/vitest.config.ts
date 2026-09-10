import { defineConfig } from "vitest/config";
import { coverageFor } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: coverageFor("packages/events", {
      include: ["src/**/*.ts"],
    }),
  },
});
