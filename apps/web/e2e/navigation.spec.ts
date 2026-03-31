import { test, expect } from "@playwright/test";

test.describe("Sidebar Navigation", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("displays 10 management-system nav groups", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Verify key nav groups are visible
    const sidebar = page.locator("nav, aside").first();
    await expect(sidebar).toBeVisible();

    // Check for management-system group labels
    const expectedGroups = [
      /risk/i,
      /information security|isms/i,
      /controls.*audit|ics/i,
      /business continuity|bcms/i,
      /data protection|dpms|datenschutz/i,
      /third part|tprm|drittpartei/i,
      /process|bpm|archit/i,
      /esg|sustain|nachhaltig/i,
      /whistleblow|hinweisgeber/i,
      /platform|plattform/i,
    ];

    for (const pattern of expectedGroups) {
      await expect(sidebar.getByText(pattern).first()).toBeVisible();
    }
  });

  test("navigates to catalog browser from sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Click on Catalogs & Frameworks link
    const catalogLink = page.getByRole("link", { name: /catalog|katalog/i }).first();
    await catalogLink.click();

    await expect(page).toHaveURL(/catalogs/);
  });

  test("navigates to ISMS Protection Needs", async ({ page }) => {
    await page.goto("/isms/protection-needs");
    await expect(page.getByText(/protection|schutzbedarf/i).first()).toBeVisible();
  });

  test("navigates to budget overview", async ({ page }) => {
    await page.goto("/budget");
    await expect(page.getByText(/budget/i).first()).toBeVisible();
  });

  test("navigates to framework coverage", async ({ page }) => {
    await page.goto("/catalogs/mappings");
    await expect(page.getByText(/framework|coverage|abdeckung/i).first()).toBeVisible();
  });
});
