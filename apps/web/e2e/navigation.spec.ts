import { test, expect } from "@playwright/test";
import { awaitAppReady } from "./fixtures/wait";
import { STORAGE_STATE } from "./fixtures/storage";

test.describe("Sidebar Navigation", () => {
  test.use({ storageState: STORAGE_STATE });

  test("sidebar is visible with navigation links", async ({ page }) => {
    await page.goto("/dashboard");
    await awaitAppReady(page);

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
    await awaitAppReady(page);

    // Find and click a risk-related link
    const riskLink = page.getByRole("link", { name: /risiko|risk/i }).first();
    await riskLink.click();
    await awaitAppReady(page);

    await expect(page).toHaveURL(/risks/);
  });

  test("navigates to catalog browser", async ({ page }) => {
    await page.goto("/dashboard");
    await awaitAppReady(page);

    const catalogLink = page
      .getByRole("link", { name: /katalog|catalog/i })
      .first();
    await catalogLink.click();
    await awaitAppReady(page);

    await expect(page).toHaveURL(/catalogs/);
  });

  test("navigates to ISMS", async ({ page }) => {
    await page.goto("/isms");
    await awaitAppReady(page);

    await expect(page.getByText(/isms/i).first()).toBeVisible();
  });

  test("navigates to budget overview", async ({ page }) => {
    await page.goto("/budget");
    await awaitAppReady(page);

    await expect(page.getByText(/budget/i).first()).toBeVisible();
  });
});
