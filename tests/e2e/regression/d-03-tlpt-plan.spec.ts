import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-305: TLPT Plan CRUD (REQ-DORA-021)

test("E2E-305: TLPT plan list endpoint reachable", async ({ page }) => {
  await login(page);
  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/dora/tlpt-plans?limit=5");
    return r.status;
  });
  expect([200, 204]).toContain(list);
});
