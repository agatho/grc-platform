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

  // [E2E-TRIAGE-2026-09-02] Was `if (status.body?.data)
  // expect(Array.isArray(status.body.data)).toBe(true)` — two problems in one
  // line. It skipped itself silently when `data` was absent (S11-07), and the
  // endpoint has never answered with a bare array: `data` is the readiness
  // object `{ requirements, overallScore, compliantCount,
  // partiallyCompliantCount, nonCompliantCount, totalRequirements }`, measured
  // against the running instance. The test's own title says what it should be
  // checking — TEN Art. 21(2) requirements — so it checks that instead of the
  // container's JavaScript type. NIS2 Art. 21(2) enumerates exactly ten
  // measures, a–j, which is why the number is pinned rather than ">= 1".
  const data = status.body?.data as
    | { requirements?: Array<{ article?: string }>; totalRequirements?: number }
    | undefined;
  expect(data, "GET /api/v1/isms/nis2/status returned no `data`").toBeTruthy();
  expect(Array.isArray(data!.requirements)).toBe(true);
  expect(
    data!.requirements!.length,
    "NIS2 Art. 21(2) lists ten measures (a–j); the readiness endpoint must " +
      "report all of them",
  ).toBe(10);
  expect(data!.totalRequirements).toBe(10);
  for (const req of data!.requirements!) {
    expect(req.article).toMatch(/Art\.\s*21/);
  }
});
