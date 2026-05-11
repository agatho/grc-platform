import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/seed.ts", "src/default-templates.ts"],
      reporter: ["text", "json-summary", "lcov"],
    },
  },
});
