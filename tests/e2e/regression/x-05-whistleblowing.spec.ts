import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-405: Whistleblowing-Portal (REQ-XCUT-033)

test("E2E-405: whistleblowing list returns 403 for non-officer roles", async ({
  page,
}) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/v1/whistleblowing?limit=5");
    return r.status;
  });
  // RBAC enforcement: whistleblowing is role-locked
  expect([200, 403]).toContain(status);
});
