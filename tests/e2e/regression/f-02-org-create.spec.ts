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
  const orgs = await page.evaluate(async () => {
    const r = await fetch("/api/v1/organizations?limit=200");
    return await r.json();
  });
  const names: string[] = (orgs.data ?? []).map(
    (o: { name: string }) => o.name,
  );
  expect(names).toContain(name);
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

  // Deterministic, not "success or refusal" (S11-07): no seed grants platform
  // admin — `platform_admin` rows are an operator action at the DB prompt
  // (WP3/S02-03, deploy/setup.sh) — so the E2E user is an organization admin
  // and the only correct answer is 403. Before migration 0438 this was a 500
  // (SQLSTATE 42501 out of RLS), which fails here just as loudly.
  expect(res.status, res.body).toBe(403);
});
