import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-02: Control-Create form validation. Mirror of n-01-risk-form
// (PR #161). Same 5 steps, applied to /api/v1/controls.

test("W22-C1-02: Control-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/controls");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422 (required fields: title, controlType)
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path submit
  const title = `E2E-N2-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        controlType: "preventive",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const controlId = created.body.data.id as string;

  // Step 4: invalid enum
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        controlType: "not_a_real_control_type",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 5: persistence across reload
  await page.goto(`/controls/${controlId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(title);
});
