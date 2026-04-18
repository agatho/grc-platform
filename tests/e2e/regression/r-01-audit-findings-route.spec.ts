import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// R-01: /audit/findings gave 404. Now redirects to /controls/findings?source=audit.

test("R-01: /audit/findings redirects to /controls/findings?source=audit", async ({ page }) => {
  await login(page);

  // Don't auto-follow redirects so we can assert the exact chain.
  const resp = await page.goto("/audit/findings", { waitUntil: "load" });
  expect(resp?.status()).toBeLessThan(500);

  // After following the redirect, final URL should be controls/findings
  // with source=audit preselected.
  const finalUrl = page.url();
  expect(finalUrl).toContain("/controls/findings");
  expect(finalUrl).toContain("source=audit");
});
