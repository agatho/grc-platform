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
  // Fresh context: no cookies, no storage state.
  const context = await browser.newContext();
  const anonPage = await context.newPage();
  try {
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
