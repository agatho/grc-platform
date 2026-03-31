import { test, expect } from "@playwright/test";

test.describe("Budget & Cost Tracking", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("budget list API returns data", async ({ request }) => {
    const res = await request.get("/api/v1/budgets?limit=50");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data).toBeDefined();
  });

  test("budget usage API returns aggregation data", async ({ request }) => {
    const res = await request.get("/api/v1/budget/usage");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data).toBeDefined();
  });

  test("budget page loads with hierarchy view", async ({ page }) => {
    await page.goto("/budget");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/budget/i).first()).toBeVisible();
  });

  test("control form includes cost tracking fields", async ({ page }) => {
    await page.goto("/controls/new");
    await page.waitForLoadState("networkidle");

    // Verify cost tracking section exists
    await expect(page.getByText(/cost track|kostenerfassung/i).first()).toBeVisible();
  });
});
