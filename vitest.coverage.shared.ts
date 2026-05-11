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
  // Coverage thresholds are tracked separately per-package via overrides in
  // each package's own vitest.config.ts (e.g. `coverage: { ...sharedCoverageConfig,
  // thresholds: { lines: 80 } }`). The shared config deliberately does NOT
  // enable a global threshold — measured baselines differ widely across
  // packages and a global floor would block CI on the well-covered ones
  // before the under-covered ones have caught up.
  //
  // Current observed baselines (coverage/aggregated-summary.md, 2026-04-30):
  //   packages/auth:   51 % lines / 41 % branches
  //   packages/shared: 81 % lines / 70 % branches
  //   packages/events: 17 % lines / 5 % branches
  // Ratchet up via per-package overrides once each package has a stable floor.
  all: false,
  cleanOnRerun: true,
};
