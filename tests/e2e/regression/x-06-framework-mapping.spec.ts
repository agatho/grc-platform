import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-406: Framework-Mapping-Wizard (REQ-XCUT-020..022)

test("E2E-406: framework mappings list reachable", async ({ page }) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/v1/framework-mappings?limit=10");
    return r.status;
  });
  expect([200, 204]).toContain(status);
});
