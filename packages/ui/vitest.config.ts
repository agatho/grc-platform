import { defineConfig } from "vitest/config";
import {
  sharedCoverageConfig,
  coverageFor,
} from "../../vitest.coverage.shared";

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-05, S11-16]
// This config existed, but `packages/ui/package.json` had no `scripts` block
// at all — so `turbo test` never ran the package and the aggregator never saw
// a summary for it. Both are fixed; the coverage block now comes from the
// shared config so reporters and thresholds match every other package.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: coverageFor("packages/ui", {
      include: ["src/**/*.ts"],
      exclude: [...(sharedCoverageConfig.exclude ?? []), "src/components/**"],
    }),
  },
});
