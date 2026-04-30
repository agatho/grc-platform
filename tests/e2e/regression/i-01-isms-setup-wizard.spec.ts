import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-101: ISMS Setup-Wizard end-to-end (REQ-ISMS-027)
// Workflow: User triggers setup-wizard → method config → asset import → SoA-Init.

test("E2E-101: ISMS setup wizard initializes assessment + SoA", async ({
  page,
}) => {
  await login(page);

  const setupResult = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/assessments/setup-wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "all_critical_assets",
        framework: "iso27001-2022",
        methodKey: "default",
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });

  expect([200, 201]).toContain(setupResult.status);
  expect(setupResult.body).toMatchObject({
    data: expect.objectContaining({
      assessmentId: expect.any(String),
    }),
  });

  const assessmentId = setupResult.body.data.assessmentId;

  // SoA muss initialisiert sein
  const soaInit = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/soa?assessmentId=${id}&limit=5`);
    return { status: r.status, body: await r.json().catch(() => null) };
  }, assessmentId);

  expect(soaInit.status).toBe(200);
  expect(Array.isArray(soaInit.body?.data ?? soaInit.body)).toBe(true);
});
