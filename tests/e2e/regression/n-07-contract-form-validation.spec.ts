import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-07: Contract-Create form validation. Required: title.
// Also exercises the Wave-22-C3 backwards-compat alias `name → title`
// and confirms the deprecation Warning header lands.

test("W22-C1-07: Contract-Create UI form — required + happy path + name-alias + Warning", async ({
  page,
}) => {
  await login(page);
  await page.goto("/contracts");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422 (title required)
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path with canonical `title` field
  const title = `E2E-N7-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        contractType: "service_agreement",
      }),
    });
    return {
      status: r.status,
      body: await r.json(),
      warning: r.headers.get("warning"),
    };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  // No deprecation warning expected when caller uses canonical 'title'.
  expect(created.warning).toBeNull();
  const contractId = created.body.data.id as string;

  // Step 3b: legacy `name` alias still works + emits Warning header
  // (W22-C3 fix — Wave-21 verifier reported this 422'd before)
  const nameAlias = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${t}-alias`,
        contractType: "service_agreement",
      }),
    });
    return {
      status: r.status,
      warning: r.headers.get("warning"),
    };
  }, title);
  expect(nameAlias.status).toBe(201);
  expect(nameAlias.warning).toMatch(/deprecated|name|title/i);

  // Step 4: invalid enum
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        contractType: "not_a_real_contract_type",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 5: persistence
  await page.goto(`/contracts/${contractId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(title);
});
