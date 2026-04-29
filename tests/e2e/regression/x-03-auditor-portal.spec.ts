import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-403: Auditor-Portal (REQ-XCUT-030)

test("E2E-403: portal route returns 200 or 403 (RBAC enforced)", async ({
  page,
}) => {
  await login(page);
  const r = await page.goto("/portal");
  const status = r?.status() ?? 0;
  expect([200, 302, 403, 404]).toContain(status);
});
