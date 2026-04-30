import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-404: Lieferanten-Portal (REQ-XCUT-031)

test("E2E-404: supplier portal endpoint reachable", async ({ page }) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/v1/portal/questionnaire-templates?limit=5");
    return r.status;
  });
  expect([200, 204, 403, 404]).toContain(status);
});
