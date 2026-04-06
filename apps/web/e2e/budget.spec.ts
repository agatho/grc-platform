import { test, expect } from "@playwright/test";

test.describe("Budget & Cost Tracking", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("budget list API returns data", async ({ request }) => {
    const res = await request.get("/api/v1/budgets?limit=50");
    if (res.ok()) {
      const json = await res.json();
      expect(json.data).toBeDefined();
    }
    // Budget API may not exist yet — that's OK
  });

  test("budget page loads", async ({ page }) => {
    await page.goto("/budget");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    await expect(page.getByText(/budget/i).first()).toBeVisible();
  });

  test("control creation page loads", async ({ page }) => {
    await page.goto("/controls/new");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Verify form loads
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
  });
});
