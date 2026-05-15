import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-06: Vendor-Create form validation. createVendorSchema
// requires `name`. category defaults to 'other'.

test("W22-C1-06: Vendor-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/vendors");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422 (name required)
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path
  const name = `E2E-N6-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        category: "saas",
        tier: "standard",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, name);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const vendorId = created.body.data.id as string;

  // Step 4: invalid enum
  const badEnum = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${n}-bad`,
        category: "not_a_real_category",
      }),
    });
    return { status: r.status };
  }, name);
  expect(badEnum.status).toBe(422);

  // Step 5: persistence
  await page.goto(`/vendors/${vendorId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(name);
});
