import { defineConfig } from "vitest/config";
import { coverageFor } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: coverageFor("packages/graph", {
      include: ["src/**/*.ts"],
    }),
  },
});
