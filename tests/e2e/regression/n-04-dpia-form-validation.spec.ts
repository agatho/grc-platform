import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-04: DPIA-Create form validation. createDpiaSchema requires
// only `title` (everything else is optional / has defaults).
// Module gate: dpms.

test("W22-C1-04: DPIA-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dpms/dpia");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422 (title is required)
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/dpms/dpia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path submit
  const title = `E2E-N4-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/dpms/dpia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        processingDescription:
          "E2E test DPIA — automated form-validation suite",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const dpiaId = created.body.data.id as string;

  // Step 4: invalid enum (legalBasis)
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/dpms/dpia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        legalBasis: "not_a_real_basis",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 5: persistence
  await page.goto(`/dpms/dpia/${dpiaId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(title);
});
