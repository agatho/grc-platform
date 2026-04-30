import { test, expect } from "@playwright/test";
import { login, getSession } from "../fixtures/auth";

// E2E-401: Org Switch (REQ-XCUT-007)

test("E2E-401: switch-org returns success or 403/404 cleanly", async ({
  page,
}) => {
  await login(page);
  const session = await getSession(page);
  test.skip(!session.currentOrgId, "no current org");

  const status = await page.evaluate(async (orgId) => {
    const r = await fetch("/api/v1/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    return r.status;
  }, session.currentOrgId);
  expect([200, 403, 404]).toContain(status);
});
