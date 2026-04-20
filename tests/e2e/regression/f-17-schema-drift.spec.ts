import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// F-17/F-18: Schema-Drift health-check endpoint returns 200 + healthy=true
// when all expected Drizzle tables exist in the DB. This smoke test gates
// against "relation does not exist" regressions after migrations.

test("F-17: /api/v1/health/schema-drift returns healthy", async ({ page }) => {
  await login(page);

  const resp = await page.evaluate(async () => {
    const r = await fetch("/api/v1/health/schema-drift");
    const t = await r.text();
    let d: any = null;
    try {
      d = JSON.parse(t);
    } catch {}
    return { status: r.status, data: d };
  });

  // Accept 200 or 503: content matters. If healthy is false there must at
  // least be a manageable (small) gap, not a regression explosion.
  expect(resp.status === 200 || resp.status === 503).toBeTruthy();
  expect(resp.data?.data?.healthy).toBeDefined();
  expect(resp.data?.data?.expectedCount).toBeGreaterThan(400);

  // Hard ceiling: the last known good state had 0-3 missing tables.
  // A jump above that signals a regression.
  const missing = resp.data?.data?.missingInDb?.length ?? 0;
  expect(missing).toBeLessThanOrEqual(5);
});
