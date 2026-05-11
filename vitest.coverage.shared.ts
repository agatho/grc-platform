// Shared coverage settings for all packages — import in each vitest.config.ts.
// Centralised so threshold + reporter changes happen in one place.

import type { CoverageOptions } from "vitest/node";

export const sharedCoverageConfig: CoverageOptions = {
  provider: "v8",
  reporter: ["text-summary", "json-summary", "json", "lcov", "html"],
  reportsDirectory: "coverage",
  // Inputs the report should consider — overridden per package as needed.
  include: ["src/**/*.{ts,tsx}"],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.d.ts",
    "**/*.config.{ts,js}",
    "**/__tests__/**",
    "**/tests/**",
    "**/migrations/**",
    "**/migrations-archive/**",
    "**/seeds/**",
    "**/seed*.ts",
  ],
  // Coverage thresholds (enabled 2026-05-10).
  //
  // Strategy: ratchet, don't block. Start at the conservative base
  // (40 % lines / 30 % branches) so existing CI doesn't break, then raise
  // by 5 percentage points per sprint until each package crosses 60/50.
  //
  // Per-package overrides live in each package's vitest.config.ts via
  //   coverage: { ...sharedCoverageConfig, thresholds: { lines: 80 } }
  //
  // Current observed baselines (coverage/aggregated-summary.md, 2026-04-30):
  //   packages/auth:   51 % lines / 41 % branches  → at 40/30 baseline OK
  //   packages/shared: 81 % lines / 70 % branches  → exceeds, ratchet next
  //
  // Other packages (apps/web, packages/db, packages/reporting, …) are not
  // yet in the aggregator; once they are, their first measured numbers
  // become the floor.
  thresholds: {
    statements: 40,
    branches: 30,
    functions: 40,
    lines: 40,
    // perFile: true,  // enable later to fail per-file regressions
    autoUpdate: false,
  },
  all: false,
  cleanOnRerun: true,
};
