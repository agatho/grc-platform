import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/storage";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-06, S11-08]
 *
 * Two changes:
 *
 *  * The credentials were hard-coded as `admin@arctos.dev` / `admin123`.
 *    WP3 removed that default account and password from the seed and from
 *    `deploy/setup.sh` (S02-01), so the literal is now guaranteed to be wrong
 *    on any freshly provisioned environment. The run has to be given real
 *    credentials, and it has to say so instead of failing on a selector.
 *
 *  * The storage-state path was a cwd-relative string; it now resolves from
 *    this file's own location, so the root config can run all 67 specs from
 *    the repository root (see playwright.config.ts).
 */

const EMAIL = process.env.E2E_EMAIL ?? "admin@arctos.dev";
const PASSWORD = process.env.E2E_PASSWORD;

setup("authenticate as admin", async ({ page }) => {
  expect(
    PASSWORD,
    "E2E_PASSWORD is not set. WP3 removed the `admin123` default account " +
      "(S02-01), so there is no credential to fall back on — export " +
      "E2E_EMAIL / E2E_PASSWORD for the seeded account before running the " +
      "E2E suite.",
  ).toBeTruthy();

  await page.goto("/login");

  // Wait for the form to be visible (client-side hydration)
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });

  // Fill using CSS selectors (more reliable than getByLabel with i18n)
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (first compile can be slow)
  await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });

  // The URL alone is not proof. Assert the session endpoint really carries a
  // user before writing a storage state that 19 specs depend on: a storage
  // state without a session turns every one of them into a confusing failure
  // far from the cause (S11-08).
  const session = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    return r.ok ? await r.json() : null;
  });
  expect(
    session?.user?.id,
    `login as ${EMAIL} produced no session — refusing to write an empty ` +
      "storage state.",
  ).toBeTruthy();

  // Save auth state
  await page.context().storageState({ path: STORAGE_STATE });
});
