import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-403: Auditor-Portal (REQ-XCUT-030)
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-07]
// Was: `page.goto("/portal")` + `expect([200, 302, 403, 404]).toContain(...)`.
// `/portal` is not a route in this app (the auditor workspace is
// /audit/external-portal, the portal administration is /portals), so the test
// asserted a 404 and called it a pass — and it would have passed on a 200
// leaking the page to anyone, too.
//
// Now: the page must render for an authenticated user, and it must not render
// for an anonymous one.

const AUDITOR_PORTAL = "/audit/external-portal";

test("E2E-403: the auditor portal renders for an authenticated user", async ({
  page,
}) => {
  await login(page);
  const res = await page.goto(AUDITOR_PORTAL);
  expect(
    res?.status(),
    `${AUDITOR_PORTAL} must render for a signed-in user`,
  ).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${AUDITOR_PORTAL}$`));
});

test("E2E-403b: the auditor portal is not reachable without a session", async ({
  browser,
}) => {
  // [E2E-TRIAGE-3 · 2026-09-02] `storageState: undefined` is load-bearing.
  //
  // The comment here said "Fresh context: no cookies, no storage state" and
  // `browser.newContext()` was assumed to give one. It does not: the context
  // options from the project's `use` block apply, and since the regression
  // project now carries the setup's storage state (playwright.config.ts), this
  // "anonymous" visitor arrived holding an admin session — the portal rendered,
  // correctly, and the test reported a leak that does not exist. Measured
  // against the running instance while the test was red:
  //   GET /audit/external-portal without cookies -> 307 /login?callbackUrl=…
  // Say what the test means instead of relying on a default.
  const context = await browser.newContext({ storageState: undefined });
  const anonPage = await context.newPage();
  try {
    // The premise, asserted rather than assumed.
    expect(
      await context.cookies(),
      "the 'anonymous' context carries cookies — this test cannot mean what " +
        "it says",
    ).toHaveLength(0);
    await anonPage.goto(AUDITOR_PORTAL);
    // The middleware redirects unauthenticated traffic to the login screen.
    // What must NOT happen is the page rendering its content.
    await expect(
      anonPage,
      `${AUDITOR_PORTAL} rendered for an anonymous visitor`,
    ).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});
