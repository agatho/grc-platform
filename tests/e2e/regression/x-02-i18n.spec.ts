import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-402: i18n DE/EN (REQ-XCUT-012)

test("E2E-402: dashboard renders without missing translation markers", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 15_000 });

  const html = await page.content();
  // Common next-intl missing-key patterns
  expect(html).not.toContain("MISSING_MESSAGE");
  expect(html).not.toMatch(/\{\{[a-zA-Z_]+\}\}/);
});
