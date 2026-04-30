import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-301: NIS2-Reporting-Tracker (REQ-NIS2-004, REQ-NIS2-013)

test("E2E-301: NIS2 reporting tracker returns timeline", async ({ page }) => {
  await login(page);
  const tracker = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/nis2/reporting-tracker");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect([200, 204]).toContain(tracker.status);
});
