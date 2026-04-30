// Pure schema/type tests — no Postgres connection needed.
// Integration tests use vitest.integration.config.ts; RLS tests use vitest.rls.config.ts.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    passWithNoTests: true,
  },
});
