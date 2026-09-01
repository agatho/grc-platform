import { test, expect } from "@playwright/test";
import { login, getSession, awaitSessionRoles } from "../fixtures/auth";

// F-02: POST /api/v1/organizations grants admin role to the creator in the
// same transaction, so the new org is immediately visible to them.

test("F-02: org create assigns admin role and shows in list after re-login", async ({
  page,
}) => {
  await login(page);

  const name = `E2E-F02-${Date.now().toString().slice(-6)}`;

  const createStatus = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        type: "holding",
        country: "DEU",
        countryCode: "DE",
      }),
    });
    return { status: r.status, body: await r.text() };
  }, name);
  expect(createStatus.status).toBe(201);

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
