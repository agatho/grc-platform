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
  // No global thresholds yet — start tracking, then ratchet up over sprints.
  // To enforce, uncomment and tune:
  // thresholds: {
  //   statements: 60,
  //   branches: 50,
  //   functions: 60,
  //   lines: 60,
  // },
  all: false,
  cleanOnRerun: true,
};
