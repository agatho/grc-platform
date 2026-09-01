// Shared coverage settings for all packages — import in each vitest.config.ts.
// Centralised so threshold + reporter changes happen in one place.

// Drop the `CoverageOptions` type import — vitest 3.x exposed it from
// `vitest/node`, vitest 4.x dropped that subpath, and the main entry's
// shape moved too. Each per-package `vitest.config.ts` already gets full
// type-checking when it spreads this object into its own `coverage: {}`
// — so dropping the annotation here loses nothing in practice and keeps
// the file compatible across both vitest majors during the bump.
export const sharedCoverageConfig = {
  // Cast `provider` to its literal type so spreading this object into a
  // vitest `coverage: { ... }` (which expects `'v8' | 'istanbul' | ...`,
  // not `string`) typechecks on both vitest 3 and 4.
  provider: "v8" as const,
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
  cleanOnRerun: true,
};

// ---------------------------------------------------------------------------
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-14, S11-01]
//
// The previous version of this file ended with a comment explaining that it
// "deliberately does NOT enable a global threshold", while `docs/STATUS.md:431`
// claimed "40 % lines / 30 % branches as Floor ✅". That is the placebo pattern
// the remediation plan names in §1.2: a control the documentation asserts and
// the code does not perform. There was no floor anywhere — not here, not in a
// per-package override.
//
// There is now exactly ONE source of truth for the floors, below, used twice:
//
//   * by each package's `vitest.config.ts` through `coverageFor(<workspace>)`
//     — so `vitest run --coverage` goes red the moment a package drops under
//     its floor;
//   * by `scripts/coverage-aggregate.ts` — so CI fails on the aggregate even
//     when a package's own run was skipped or its summary is missing.
//
// The numbers are the measured baseline AFTER the remediation, rounded down to
// leave a small margin — not aspirational targets. A floor that is red on the
// day it is introduced gets disabled within a week; a floor that holds is a
// ratchet. Raise these as coverage improves, never lower one to make a red
// build green. `apps/web` at 12 % is meant to look as bad as it is: it is the
// honest number for 1 789 source files, and writing it down is what stops the
// 78.4 % claim of S11-01 from coming back.
//
// Measured 2026-09-01, 13:30–14:20, post-remediation (`vitest run --coverage`
// per package, lines / branches):
//   packages/ui         100.0 /100.0        packages/reporting   55.5 / 40.5
//   packages/email       95.3 / 89.1        packages/events      52.9 / 50.0
//   packages/shared      82.2 / 69.7        packages/auth        50.2 / 36.8
//   packages/ai          60.5 / 54.8        apps/worker          47.7 / 25.5
//   packages/automation  59.1 / 47.5        packages/db          32.7 / 31.0
//   packages/graph       27.2 / 21.6        apps/web             15.2 / 10.5
//
// Two of these moved during WP11 and the reason matters:
//   * packages/db 4.6 % → 32.7 % (functions 0.0 % → 35.1 %) because
//     `tests/unit/rls-audit-pure.test.ts` now calls `runRlsAudit()` instead of
//     re-implementing its classifier inside the test (S11-10).
//   * apps/worker 31.1 % → 47.7 % (branches 12.5 % → 25.5 %) because the 20
//     remaining one-`toBeDefined()` cron tests were replaced by real ones
//     (S11-09). No production line was touched for either.
//
// packages/auth moved the other way — 60.9 % at 09:32, 50.2 % at 13:32 — not
// because tests were removed but because a package running in parallel added
// uncovered code to `packages/auth/src`. Its floor is therefore set from the
// LATER measurement. That is what a floor is for; it also means these numbers
// are a snapshot taken while sibling packages were still writing code, and the
// first CI run should re-check them rather than trust this comment.
// ---------------------------------------------------------------------------

export interface CoverageFloor {
  lines: number;
  branches: number;
}

export const COVERAGE_FLOORS: Record<string, CoverageFloor> = {
  "packages/email": { lines: 90, branches: 84 },
  "packages/shared": { lines: 78, branches: 65 },
  "packages/ui": { lines: 90, branches: 85 },
  "packages/auth": { lines: 46, branches: 33 },
  "packages/automation": { lines: 55, branches: 43 },
  "packages/reporting": { lines: 50, branches: 36 },
  "packages/events": { lines: 48, branches: 45 },
  "packages/ai": { lines: 55, branches: 50 },
  "apps/worker": { lines: 43, branches: 22 },
  "packages/graph": { lines: 24, branches: 18 },
  "apps/web": { lines: 12, branches: 8 },
  // @grc/db: this figure covers only the pure TypeScript surface
  // (request-context, rls-audit, programme-soa-sync) — the 113 generated
  // Drizzle schema modules are excluded, and the package's real behaviour
  // lives in SQL and is proven by the Postgres-backed suites
  // (tests/integration, tests/rls), which run as separate vitest projects
  // whose v8 coverage is NOT merged into this number.
  "packages/db": { lines: 28, branches: 26 },
};

/**
 * Coverage block for a package's `vitest.config.ts`.
 *
 * Usage: `coverage: coverageFor("packages/shared", { include: ["src/**"] })`
 */
export function coverageFor(
  workspacePath: string,
  overrides: Record<string, unknown> = {},
) {
  const floor = COVERAGE_FLOORS[workspacePath];
  if (!floor) {
    throw new Error(
      `[vitest.coverage.shared] no coverage floor defined for "${workspacePath}". ` +
        "Add it to COVERAGE_FLOORS — a package without a floor is a package " +
        "whose coverage nobody notices dropping (S11-14).",
    );
  }
  return {
    ...sharedCoverageConfig,
    ...overrides,
    thresholds: {
      lines: floor.lines,
      branches: floor.branches,
      // Statements track lines closely; function counts vary wildly between
      // packages (a schema-heavy one has thousands of trivial ones), so only
      // the two meaningful axes are enforced.
      ...((overrides.thresholds as Record<string, number> | undefined) ?? {}),
    },
  };
}
