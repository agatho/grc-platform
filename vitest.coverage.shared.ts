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