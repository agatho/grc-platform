import { test, expect } from "@playwright/test";

test.describe("Sidebar Navigation", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("sidebar is visible with navigation links", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Sidebar/nav should be present
    const nav = page.locator("nav, aside").first();
    await expect(nav).toBeVisible();

    // Should have multiple links
    const links = nav.locator("a");
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
  });

  test("navigates to risk register from sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Find and click a risk-related link
    const riskLink = page.getByRole("link", { name: /risiko|risk/i }).first();
    await riskLink.click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/risks/);
  });

  test("navigates to catalog browser", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const catalogLink = page
      .getByRole("link", { name: /katalog|catalog/i })
      .first();
    await catalogLink.click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/catalogs/);
  });

  test("navigates to ISMS", async ({ page }) => {
    await page.goto("/isms");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    await expect(page.getByText(/isms/i).first()).toBeVisible();
  });

  test("navigates to budget overview", async ({ page }) => {
    await page.goto("/budget");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    await expect(page.getByText(/budget/i).first()).toBeVisible();
  });
});
