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

// [E2E-TRIAGE-2026-09-02] The accepted-status list omitted 401 — which is what
// the handler answers, and which is the CORRECT answer here.
// `validateDdToken` (apps/web/src/lib/portal-auth.ts:68-84) treats the token as
// the request's only credential: shorter than 32 characters, or no
// `dd_session` matching its SHA-256 hash, and it refuses with 401 before
// reading anything else. That is exactly the property these two tests exist to
// pin, so the old list would have failed a correct implementation.
//
// The accepted set is widened; the assertion is not weakened. The three things
// that must hold are now spelled out individually, so none of them can be lost
// in a future status-code edit:
//   * never 200 — a payload behind an unknown token is the whole finding;
//   * never 5xx — that means the handler ran logic on unvalidated input;
//   * the answer must be a plain refusal, not a redirect to a login the
//     portal's users do not have.
const REFUSED = [400, 401, 403, 404, 410];

const DD = (token: string) => `/api/v1/portal/dd/${token}`;

function expectTokenRefusal(status: number, label: string): void {
  expect(
    status,
    `${label} returned 200 — the token check does not gate the payload, and ` +
      `that token is the portal's only credential`,
  ).not.toBe(200);
  expect(
    status,
    `${label} returned ${status}; a 5xx means the handler ran logic on ` +
      `unvalidated input instead of rejecting it`,
  ).toBeLessThan(500);
  expect(
    REFUSED,
    `${label} returned ${status}, which is neither a refusal nor a 5xx — an ` +
      `anonymous portal must answer a bad token with a plain refusal`,
  ).toContain(status);
}

test("E2E-404: an unknown DD token resolves to nothing", async ({ page }) => {
  await login(page); // only to have a page against the app origin
  const status = await anonApiStatus(
    page,
    DD("0000000000000000000000000000000000000000"),
  );
  expectTokenRefusal(status, "an unknown DD token");
});

test("E2E-404b: a malformed DD token is rejected, not crashed on", async ({
  page,
}) => {
  await login(page);
  const status = await anonApiStatus(page, DD("../../../etc/passwd"));
  expectTokenRefusal(status, "a malformed DD token");
});
