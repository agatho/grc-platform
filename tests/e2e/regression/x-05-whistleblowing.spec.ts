import { test, expect } from "@playwright/test";
import { login, apiStatus, anonApiStatus, expectRbac } from "../fixtures/auth";

// E2E-405: Whistleblowing-Portal (REQ-XCUT-033)
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-07]
// Was: `expect([200, 403]).toContain(status)` against `/api/v1/whistleblowing`
// — a path that does not exist (the module lives under
// /api/v1/whistleblowing/cases). The assertion therefore passed on the 404
// too, and would have passed just as happily if the RBAC guard had been
// deleted outright.
//
// Now: the anonymous call must be refused (unconditional), and the
// authenticated call is asserted against the roles the session actually
// carries — `whistleblowing_officer` / `ombudsperson` are the two roles the
// route names in `withAuth(...)`. HinSchG (§§16, 32) makes this list closed:
// an ordinary admin must NOT see reporter data.

const WB_ROLES = ["whistleblowing_officer", "ombudsperson"] as const;
const WB_CASES = "/api/v1/whistleblowing/cases?limit=5";

test("E2E-405: whistleblowing cases are not readable without a session", async ({
  page,
}) => {
  await login(page);
  const status = await anonApiStatus(page, WB_CASES);
  expect(
    [401, 403],
    `anonymous read of ${WB_CASES} returned ${status} — reporter data must ` +
      `never be reachable without a session (HinSchG §8)`,
  ).toContain(status);
});

test("E2E-405b: whistleblowing cases follow the role list exactly", async ({
  page,
}) => {
  const session = await login(page);
  const status = await apiStatus(page, WB_CASES);
  expectRbac(status, session, WB_ROLES, "GET /api/v1/whistleblowing/cases");
});
