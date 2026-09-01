import type { Page } from "@playwright/test";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-15]
 *
 * Replaces the 40 fixed `page.waitForTimeout(1000…8000)` sleeps the audit
 * counted across the E2E suites.
 *
 * A fixed sleep is wrong in both directions at once: on a warm machine it
 * wastes the difference, and on a cold Next.js dev server — where the first
 * compile of a route takes far longer than five seconds — it expires before
 * the page exists and the test fails for a reason that has nothing to do with
 * the product. Playwright's own assertions already retry until
 * `expect.timeout`; the sleep bought nothing they do not do better.
 *
 * `awaitAppReady` waits for STATE instead of for time: the document is parsed,
 * then the network has been quiet for 500 ms.
 *
 * The network wait is best-effort on purpose: it is a *wait*, not a check.
 * Whatever the caller asserts afterwards is the real assertion and retries on
 * its own, so a helper that threw here would only turn a slow page into a
 * confusing failure. Nothing is swallowed that a later assertion would not
 * catch — contrast `login()` in tests/e2e/fixtures/auth.ts, where the
 * swallowed error WAS the finding (S11-08).
 *
 * Deliberately NOT implemented as "wait until the spinner is gone": in this UI
 * `role="progressbar"` and `.animate-pulse` also belong to permanent widgets
 * (progress bars, KPI tiles), so waiting for one to detach blocks for the full
 * timeout on a perfectly healthy page — measured, it cost ~60 s per call.
 */
export async function awaitAppReady(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForLoadState("networkidle", { timeout })
    .catch(() => undefined);
}

/**
 * Waits until the session endpoint reports the roles the caller expects.
 *
 * Used after creating an organisation or switching roles, where the old code
 * slept 1 500 ms and hoped the JWT had been refreshed.
 */
export async function awaitSessionRoles(
  page: Page,
  minRoles: number,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    async (min) => {
      const r = await fetch("/api/auth/session");
      if (!r.ok) return false;
      const json = await r.json();
      return (json?.user?.roles?.length ?? 0) >= min;
    },
    minRoles,
    { timeout },
  );
}
