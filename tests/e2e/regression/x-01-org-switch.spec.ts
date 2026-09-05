import { test, expect } from "@playwright/test";
import { login, switchOrg } from "../fixtures/auth";

// E2E-401: Org Switch (REQ-XCUT-007)
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-07, S11-08]
// Was: `expect([200, 403, 404]).toContain(status)` behind
// `test.skip(!session.currentOrgId, "no current org")`. Both halves were
// broken: the skip fired whenever login had silently failed, and the assertion
// passed whether the switch worked or was refused.
//
// Now: login() guarantees a session, and switching to the org the session is
// already in has exactly one correct outcome — 200. Switching to an org the
// user is not a member of has exactly one correct class of outcome — refusal,
// never 200 (that would be the cross-tenant escalation of S01-01) and never
// 5xx (guard crashed instead of refusing).

test("E2E-401: switching to the session's own org succeeds", async ({
  page,
}) => {
  const session = await login(page);
  expect(
    session.currentOrgId,
    "the seeded E2E user must be a member of at least one organisation",
  ).toBeTruthy();

  const status = await switchOrg(page, session.currentOrgId!);
  expect(status, "switching to the current org must succeed").toBe(200);
});

test("E2E-401b: switching to a foreign org is refused", async ({ page }) => {
  await login(page);

  // A syntactically valid uuid that belongs to no org this user can access.
  const foreignOrgId = "00000000-0000-4000-8000-0000000000ff";
  const status = await switchOrg(page, foreignOrgId);

  expect(
    [403, 404],
    `switching to a foreign org returned ${status}. 200 would be a ` +
      `cross-tenant escalation (S01-01); 5xx would mean the guard crashed ` +
      `instead of refusing.`,
  ).toContain(status);
});
