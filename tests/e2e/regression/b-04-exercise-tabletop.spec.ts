import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-204: Exercise-Tabletop mit Findings + Lessons (REQ-BCMS-030..036)

test("E2E-204: exercise lessons endpoint exists", async ({ page }) => {
  await login(page);
  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/exercises?limit=1");
    return await r.json();
  });
  const id = list?.data?.[0]?.id;
  test.skip(!id, "no exercise available");

  const lessons = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/bcms/exercises/${id}/lessons`);
    return r.status;
  }, id);
  expect([200, 204]).toContain(lessons);
});
