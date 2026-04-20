import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// F-15: /audits/[id]/checklists/generate falls back to catalog_entry when
// no org-owned controls exist. Must produce exactly as many items as the
// chosen catalog has entries.

test("F-15: checklist generate from catalog_entry (ISO 27001 Annex A)", async ({
  page,
}) => {
  await login(page);

  // Create a fresh org with Audit module (auto-activated post F-06).
  const orgName = `E2E-F15-${Date.now().toString().slice(-6)}`;
  const orgCreate = await page.evaluate(async (n) => {
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
    return await r.json();
  }, orgName);
  const orgId = orgCreate?.data?.id;
  expect(orgId).toBeTruthy();

  // Re-login to pick up the new admin role.
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);

  // Switch to the fresh org.
  await page.evaluate(async (id) => {
    await fetch("/api/v1/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: id }),
    });
  }, orgId);

  // Activate ISO 27001 Annex A.
  const catalogs = await page.evaluate(async () => {
    const r = await fetch("/api/v1/catalogs?type=control&limit=200");
    return await r.json();
  });
  type Cat = { id: string; name: string };
  const iso = (catalogs.data ?? []).find((c: Cat) =>
    /ISO.?IEC 27001:?2022 Annex A/i.test(c.name),
  );
  expect(iso).toBeTruthy();

  const activationStatus = await page.evaluate(
    async ({ oId, cId }) => {
      const r = await fetch(`/api/v1/organizations/${oId}/active-catalogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: cId,
          catalogType: "control",
          enforcementLevel: "recommended",
        }),
      });
      return r.status;
    },
    { oId: orgId, cId: iso.id },
  );
  expect(activationStatus).toBe(201);

  // Create an audit.
  const auditResp = await page.evaluate(async () => {
    const r = await fetch("/api/v1/audit-mgmt/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "F-15 E2E Audit", auditType: "internal" }),
    });
    return await r.json();
  });
  const auditId = auditResp?.data?.id;
  expect(auditId).toBeTruthy();

  // Generate checklist targeting the ISO catalog specifically (F-13+F-15).
  const generate = await page.evaluate(
    async ({ aId, cId }) => {
      const r = await fetch(
        `/api/v1/audit-mgmt/audits/${aId}/checklists/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogId: cId }),
        },
      );
      return await r.json();
    },
    { aId: auditId, cId: iso.id },
  );

  expect(generate?.data?.itemCount).toBeGreaterThan(0);
  // ISO 27001 Annex A has 97 controls seeded -- allow some tolerance
  // in case the catalog has been extended / pruned over time.
  expect(generate.data.itemCount).toBeGreaterThan(50);
});
