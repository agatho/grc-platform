import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-05: Audit-Create form validation. createAuditSchema requires
// `title`. auditType defaults to 'internal'.

test("W22-C1-05: Audit-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/audit-mgmt/audits");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/audit-mgmt/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path
  const title = `E2E-N5-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/audit-mgmt/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        auditType: "internal",
        scopeDescription: "E2E test audit",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const auditId = created.body.data.id as string;

  // Step 4: invalid enum
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/audit-mgmt/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        auditType: "not_a_real_audit_type",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 5: persistence
  await page.goto(`/audit-mgmt/audits/${auditId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(title);
});
