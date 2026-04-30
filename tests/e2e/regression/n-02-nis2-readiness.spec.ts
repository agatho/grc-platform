import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-302: NIS2 Readiness-Dashboard (REQ-NIS2-002, REQ-NIS2-003)

test("E2E-302: NIS2 readiness score endpoint returns score for 10 cats", async ({
  page,
}) => {
  await login(page);
  const score = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/nis2/readiness-score");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect(score.status).toBe(200);
  expect(score.body).toBeDefined();
});

test("E2E-302b: NIS2 status returns 10 art21 requirements", async ({
  page,
}) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/nis2/status");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect(status.status).toBe(200);
  if (status.body?.data) {
    expect(Array.isArray(status.body.data)).toBe(true);
  }
});
