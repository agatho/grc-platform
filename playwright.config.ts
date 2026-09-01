import { defineConfig, devices } from "@playwright/test";

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
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
