import { test as setup, expect } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Wait for the form to be visible (client-side hydration)
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  // Fill using CSS selectors (more reliable than getByLabel with i18n)
  await page.locator('input[type="email"]').fill("admin@arctos.dev");
  await page.locator('input[type="password"]').fill("admin123");
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: STORAGE_STATE });
});
