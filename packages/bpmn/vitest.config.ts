import { defineConfig } from "vitest/config";
import { coverageFor } from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    coverage: coverageFor("packages/bpmn", {
      include: ["src/**/*.ts"],
    }),
  },
});
