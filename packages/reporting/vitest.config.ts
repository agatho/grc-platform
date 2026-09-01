import { defineConfig } from "vitest/config";
import {
  sharedCoverageConfig,
  coverageFor,
} from "../../vitest.coverage.shared";

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-16]
// `packages/reporting` had no `test:coverage` script, so it never produced a
// coverage-summary.json and `scripts/coverage-aggregate.ts` did not list it.
// Script added; the coverage block now comes from the shared config.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: coverageFor("packages/reporting", {
      include: ["src/**/*.ts"],
      exclude: [
        ...(sharedCoverageConfig.exclude ?? []),
        "src/seed.ts",
        "src/default-templates.ts",
      ],
    }),
  },
});
