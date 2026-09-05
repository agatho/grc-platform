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
      // [E2E-TRIAGE-2026-09-02] `category: "saas"` was never a legal value.
      // `vendorCategoryValues` (packages/shared/src/schemas/tprm.ts:19) is
      // it_services | cloud_provider | consulting | facility | logistics |
      // raw_materials | financial | hr_services | other, and the API answered
      // exactly that: `422 … Expected 'it_services' | … , received 'saas'`.
      // The happy path has therefore never exercised a happy path. Step 4
      // below still pins that an unknown category IS rejected, so nothing is
      // weakened by making this one valid.
      body: JSON.stringify({
        name: n,
        category: "cloud_provider",
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
  //
  // [E2E-TRIAGE-2026-09-02] Was `/vendors/${vendorId}`. `app/(dashboard)/
  // vendors/` holds only the list page; the vendor detail view is
  // `app/(dashboard)/tprm/vendors/[id]/page.tsx`. The old URL resolved to the
  // 404 page, so this step could never have passed even with a valid category.
  await page.goto(`/tprm/vendors/${vendorId}`);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  expect(
    new URL(page.url()).pathname,
    "navigation did not land on the vendor detail route",
  ).toBe(`/tprm/vendors/${vendorId}`);
  const pageText = await page.locator("body").innerText();
  expect(pageText).toContain(name);
});
