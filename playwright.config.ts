import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./apps/web/e2e/fixtures/storage";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-06, S11-15]
 *
 * ONE entry point for the whole E2E suite.
 *
 * Before this file the 67 specs lived under two configs that no single command
 * ran together — `apps/web/playwright.config.ts` (21 specs) and
 * `tests/e2e/playwright.config.ts` (46 regression specs) — and CI invoked
 * neither of them: `.github/workflows/ci.yml` ran
 * `npx playwright test e2e/ci-smoke.spec.ts`, i.e. exactly ONE spec of 67
 * (S11-06). The two per-directory configs still exist for focused local runs;
 * this one is what CI and `npm run test:e2e` use.
 *
 * Two deliberate settings:
 *
 *  * `fullyParallel: false` + `workers: 1`. `apps/web/playwright.config.ts`
 *    had `fullyParallel: true` while every spec mutates the SAME demo database
 *    (S11-15): one spec creates an organisation, another counts organisations,
 *    a third switches org context on a shared session. The regression config
 *    already had it right and said so in a comment. Until the suites carry
 *    per-worker fixtures, serial is the only honest setting — a green parallel
 *    run here means "the races happened not to fire this time".
 *
 *  * `forbidOnly: !!process.env.CI` stays, and `packages/shared/tests/
 *    repo-test-hygiene.test.ts` now fails on a committed `.only` in the unit
 *    run as well, so it is caught before the E2E job even starts (S11-17).
 *
 * The suite needs a running app and a seeded database:
 *
 *   E2E_BASE_URL   default http://localhost:3000
 *   E2E_EMAIL      seeded account (default admin@arctos.dev)
 *   E2E_PASSWORD   REQUIRED — WP3/S02-01 removed the `admin123` default, and
 *                  `tests/e2e/fixtures/auth.ts` throws rather than guessing.
 */

const BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.TARGET_URL ?? "http://localhost:3000";

/**
 * [E2E-TRIAGE-3 · 2026-09-02] Defaults that used to live in a shell history.
 *
 * The last two rounds could only be reproduced by remembering to export
 * `E2E_ORG_ID=ccc4cc1c…` first; unset, the suite ran against whichever tenant
 * the account's oldest membership happened to be and a third of it failed
 * looking for demo data. That id is not an environment secret — it is written
 * literally by `packages/db/sql/seed_demo_00_platform.sql`, so it is the same
 * on every database `db:seed:demo` has touched. It belongs here.
 *
 * Still an explicit opt-out: exporting E2E_ORG_ID overrides this, and
 * exporting it EMPTY disables the tenant pin entirely.
 */
const DEMO_TENANT_ORG_ID = "ccc4cc1c-4b09-499c-8420-ebd8da655cd7";
if (process.env.E2E_ORG_ID === undefined) {
  process.env.E2E_ORG_ID = DEMO_TENANT_ORG_ID;
}

/**
 * `RATE_LIMIT_AUTH` is deliberately NOT defaulted here — it is read by the
 * SERVER (apps/web/src/lib/rate-limit.ts), not by this process, so a value set
 * in the test runner would be a comforting no-op. The reason the suite needed
 * it is gone instead: the regression project below carries the setup's storage
 * state and `tests/e2e/fixtures/auth.ts` reuses that session, so the run no
 * longer performs 46 logins from one address against a 10/min cap.
 */

export default defineConfig({
  // Serial across the whole suite: both projects share one demo database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [
    {
      name: "setup",
      testDir: "./apps/web/e2e",
      testMatch: /auth\.setup\.ts/,
    },
    {
      // 21 specs — UI flows, a11y smoke, module walkthroughs.
      name: "web",
      testDir: "./apps/web/e2e",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      // 46 specs — API/regression matrix (B, D, F, I, N, P, R, X series).
      name: "regression",
      testDir: "./tests/e2e/regression",
      use: {
        ...devices["Desktop Chrome"],
        // [E2E-TRIAGE-3] Share the session the setup project established.
        // `login()` reuses it instead of signing in again; a spec that wants
        // a different principal (f-02b) drops it and signs in explicitly.
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
});
