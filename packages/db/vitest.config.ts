// Pure schema/type tests — no Postgres connection needed.
// Integration tests use vitest.integration.config.ts; RLS tests use vitest.rls.config.ts.
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-10, S11-11, S11-16]
// Both sibling configs now run as part of `npm test --workspace=@grc/db` via
// `tests/run-db-suites.mjs`: the RLS system test (WP2) and the audit tamper
// tests (WP4) are acceptance criteria of other packages and must not sit
// outside the standard run.
//
// This config carried no `coverage` block at all, which is why the package
// produced no `coverage-summary.json` and `scripts/coverage-aggregate.ts`
// silently dropped it. The exclude list below also removes the generated
// Drizzle table modules: 2 046 of the 2 047 "functions" the audit counted are
// schema builders, which is how 409 green tests produced 0.04 % function
// coverage (S11-10). Excluding them makes the remaining number mean something.

import { defineConfig } from "vitest/config";
import {
  sharedCoverageConfig,
  coverageFor,
} from "../../vitest.coverage.shared";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    passWithNoTests: true,
    // [WP11 · S11-12] The schema-contract test imports all 113 Drizzle modules
    // in one go; under coverage instrumentation that exceeds the 5 s default
    // and fails as a timeout rather than as a finding. A timeout that depends
    // on machine load is the flakiness class S11-12 describes.
    testTimeout: 30_000,
    coverage: coverageFor("packages/db", {
      include: ["src/**/*.ts"],
      exclude: [
        ...(sharedCoverageConfig.exclude ?? []),
        "src/schema/**",
        "src/migrations-archive/**",
        "src/migrate-all.ts",
        "src/migrate-all-report.ts",
        "src/create-admin.ts",
      ],
    }),
  },
});
