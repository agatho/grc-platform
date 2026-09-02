import { defineConfig, devices } from "@playwright/test";

/**
 * Focused config for the 21 web-UI specs only. The full 67-spec suite runs
 * from the repository-root `playwright.config.ts` (`npm run test:e2e`).
 *
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-15] `fullyParallel: true` is gone.
 * Every spec here mutates the same seeded demo database — one creates an
 * organisation, another counts organisations, a third switches the org context
 * on a shared storage state. The sibling config under `tests/e2e/` had it
 * right and said so ("Mutations in shared Demo-DB would race otherwise"); this
 * one raced. `workers: 1` also outside CI, for the same reason.
 */
// [E2E-TRIAGE-3 · 2026-09-02] Same default as the repository-root config: the
// demo tenant id is written literally by seed_demo_00_platform.sql, so it does
// not belong in an operator's shell history. Export E2E_ORG_ID to override, or
// export it empty to run without a tenant pin.
if (process.env.E2E_ORG_ID === undefined) {
  process.env.E2E_ORG_ID = "ccc4cc1c-4b09-499c-8420-ebd8da655cd7";
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
      },
});
