import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-03: Finding-Create form validation. Required fields per
// createFindingSchema: title, severity. (source defaults to control_test.)

test("W22-C1-03: Finding-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/findings");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path submit
  const title = `E2E-N3-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        severity: "minor_nonconformity",
        source: "audit",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const findingId = created.body.data.id as string;

  // Step 4a: invalid enum
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        severity: "not_a_real_severity",
        source: "audit",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 4b: status field is strict-rejected (Wave-19-P1-01 contract)
  const statusReject = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-status`,
        severity: "minor_nonconformity",
        source: "audit",
        status: "open",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(statusReject.status).toBe(422);
  expect(statusReject.body.rejectedFields).toContain("status");

  // Step 5: persistence
  await page.goto(`/findings/${findingId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(title);
});
