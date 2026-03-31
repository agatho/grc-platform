import { test as setup, expect } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@arctos.dev");
  await page.getByLabel(/password/i).fill("admin123");
  await page.getByRole("button", { name: /sign in|anmelden|login/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: STORAGE_STATE });
});
