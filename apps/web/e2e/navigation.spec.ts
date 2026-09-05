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

    // [E2E-TRIAGE-2026-09-02] Was: `getByRole("link", { name: /risiko|risk/i })
    // .first()` followed by `expect(page).toHaveURL(/risks/)`. The sidebar
    // carries SIX links whose accessible name matches that pattern
    // (Risikoregister, Risiko-KRIs, Risikogruppen, Risikoakzeptanzen,
    // Risikoappetit, Predictive Risk — nav-config.ts:109-183). "The first one
    // in DOM order" is not a property of the product, and the run picked
    // `/erm/risk-appetite`, which does not match `/risks/`. The spec was
    // asserting a coincidence about nav ordering, not navigation.
    //
    // Target the register itself, by the href the nav entry declares. The test
    // still proves what it is named for — the sidebar link reaches the risk
    // register — and now fails only if that is actually untrue.
    const registerLink = page.locator('a[href="/risks"]').first();
    await expect(
      registerLink,
      "the sidebar has no link to the risk register (/risks)",
    ).toBeVisible();
    await registerLink.click();
    await awaitAppReady(page);

    await expect(page).toHaveURL(/\/risks(\?|$)/);
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
