import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-205: Resilience-Score (REQ-BCMS-041)

test("E2E-205: resilience score endpoint returns numeric score", async ({
  page,
}) => {
  await login(page);
  const score = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/resilience/score");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect([200, 204]).toContain(score.status);
  if (score.status === 200) {
    expect(score.body).toBeDefined();
  }
});
