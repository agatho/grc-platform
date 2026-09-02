import { test, expect } from "@playwright/test";
import { login, getSession, awaitSessionRoles } from "../fixtures/auth";

// F-02: POST /api/v1/organizations grants admin role to the creator in the
// same transaction, so the new org is immediately visible to them.
//
// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-2] The spec used to POST a
// top-level `holding` with no parent. That is now a platform-administrator
// action (migration 0438 + the handler check): an organization administrator
// may only create a SUBSIDIARY of the org they are acting in. The seeded E2E
// user is an org admin, not a platform admin, so the spec creates a
// subsidiary — which is what it was really testing all along (the admin grant
// and the immediate visibility of the new org), and it now also pins the
// refusal for the case the seeded user is NOT entitled to.

test("F-02: org create assigns admin role and shows in list after re-login", async ({
  page,
}) => {
  const session0 = await login(page);
  const parentOrgId = session0.currentOrgId;
  expect(
    parentOrgId,
    "no active organization in the session — cannot create a subsidiary",
  ).toBeTruthy();

  const name = `E2E-F02-${Date.now().toString().slice(-6)}`;

  const createStatus = await page.evaluate(
    async ({ n, parent }) => {
      const r = await fetch("/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          type: "subsidiary",
          country: "DEU",
          countryCode: "DE",
          parentOrgId: parent,
        }),
      });
      return { status: r.status, body: await r.text() };
    },
    { n: name, parent: parentOrgId },
  );
  expect(createStatus.status, createStatus.body).toBe(201);

  // Hard reload so the JWT picks up the new role.
  await page.goto("/dashboard");
  // [ARCTOS-FULL-2026-08-31 / WP11 · S11-15] Was `waitForTimeout(1500)`: a
  // guess at how long the JWT needs to pick up the new role. Wait for the
  // session to actually carry it.
  await awaitSessionRoles(page, 1);

  const session = await getSession(page);
  expect(session.roles.length).toBeGreaterThanOrEqual(1);

  // The new org should appear in the accessible-orgs API.
  //
  // [E2E-TRIAGE-2026-09-02] `?limit=200` is refused with 422 — `paginate()`
  // caps `limit` at 100 ("use page+limit to traverse larger result sets").
  // `r.json()` then parsed the problem document, `orgs.data` was undefined,
  // and the spec failed on `expect([]).toContain(name)` — a pagination error
  // reported as "the new organisation is not visible", i.e. pointing at the
  // wrong defect entirely. Page through instead of asking for more than the
  // API allows, and assert the response was actually served.
  const names: string[] = [];
  for (let page_ = 1; page_ <= 20; page_++) {
    const res = await page.evaluate(async (p) => {
      const r = await fetch(`/api/v1/organizations?limit=100&page=${p}`);
      return { status: r.status, body: await r.text() };
    }, page_);
    expect(
      res.status,
      `GET /api/v1/organizations?limit=100&page=${page_} answered ` +
        `${res.status}: ${res.body}`,
    ).toBe(200);
    const json = JSON.parse(res.body) as {
      data?: Array<{ name: string }>;
      pagination?: { totalPages?: number };
    };
    names.push(...(json.data ?? []).map((o) => o.name));
    if (page_ >= (json.pagination?.totalPages ?? 1)) break;
  }
  expect(
    names,
    "the organisation the caller just created is not in their own " +
      "accessible-orgs list",
  ).toContain(name);
});

test("F-02b: an org admin cannot create a top-level tenant", async ({
  page,
}) => {
  await login(page);

  const name = `E2E-F02b-${Date.now().toString().slice(-6)}`;
  const res = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, type: "holding", country: "DEU" }),
    });
    return { status: r.status, body: await r.text() };
  }, name);

  // Deterministic, not "success or refusal" (S11-07): the E2E user is meant to
  // be an ORGANIZATION admin, for whom the only correct answer is 403. Before
  // migration 0438 this was a 500 (SQLSTATE 42501 out of RLS), which fails here
  // just as loudly.
  //
  // [E2E-TRIAGE-2026-09-02] The comment used to claim "no seed grants platform
  // admin". `packages/db/src/create-admin.ts:99-105` does, when invoked as
  // `db:create-admin --platform-admin`, and the account this suite runs as was
  // provisioned that way (`platform_admin.reason = 'created via
  // db:create-admin'`). A platform administrator creating a top-level tenant
  // is CORRECT behaviour — 201 here is the environment answering honestly, not
  // the guard failing — so the assertion stays and the message names the
  // provisioning instead of implying a product defect.
  expect(
    res.status,
    res.status === 201
      ? "the account this suite runs as (E2E_EMAIL) is a PLATFORM admin, so " +
          "creating a top-level tenant is allowed and this test cannot mean " +
          "what it says. Provision the E2E account with `db:create-admin` " +
          "WITHOUT `--platform-admin`, or revoke the `platform_admin` row " +
          `for it. Response: ${res.body}`
      : res.body,
  ).toBe(403);
});
