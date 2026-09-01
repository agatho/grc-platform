import { test, expect } from "@playwright/test";
import { login, anonApiStatus } from "../fixtures/auth";

// E2E-404: Lieferanten-Portal (REQ-XCUT-031)
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-07]
// Was: a fetch of `/api/v1/portal/questionnaire-templates` — a path that does
// not exist — asserted as `expect([200, 204, 403, 404]).toContain(status)`.
// Every possible answer was in the list, so the test could not fail.
//
// The vendor due-diligence portal is token-authenticated by design (it is in
// the PUBLIC_ALLOWLIST of the route auth smoke): an external supplier has no
// account. That makes its security property precise and testable — an unknown
// or malformed token must never resolve to data.

const DD = (token: string) => `/api/v1/portal/dd/${token}`;

test("E2E-404: an unknown DD token resolves to nothing", async ({ page }) => {
  await login(page); // only to have a page against the app origin
  const status = await anonApiStatus(
    page,
    DD("0000000000000000000000000000000000000000"),
  );
  expect(
    [400, 404, 410],
    `an unknown DD token returned ${status}. 200 would mean the token check ` +
      `does not gate the payload — the portal's only credential is that token.`,
  ).toContain(status);
});

test("E2E-404b: a malformed DD token is rejected, not crashed on", async ({
  page,
}) => {
  await login(page);
  const status = await anonApiStatus(page, DD("../../../etc/passwd"));
  expect(
    [400, 404, 410],
    `a malformed DD token returned ${status}; a 5xx means the handler ran ` +
      `logic on unvalidated input`,
  ).toContain(status);
});
