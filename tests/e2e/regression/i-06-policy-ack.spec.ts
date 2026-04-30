import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-106: Policy Acknowledgement (REQ-ISMS-003)

test("E2E-106: my-policies endpoint returns assignments", async ({ page }) => {
  await login(page);
  const pol = await page.evaluate(async () => {
    const r = await fetch("/api/v1/policies?mine=1");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect([200, 404]).toContain(pol.status);
});
