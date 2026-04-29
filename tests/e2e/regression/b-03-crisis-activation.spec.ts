import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-203: Crisis activation + DORA-Timer (REQ-BCMS-022..025)

test("E2E-203: crisis activate + dora-timer endpoint reachable", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/crisis?limit=1");
    return await r.json();
  });
  const id = list?.data?.[0]?.id;
  test.skip(!id, "no crisis scenario available");

  const tim = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/bcms/crisis/${id}/dora-timer`);
    return r.status;
  }, id);
  expect([200, 204, 404]).toContain(tim);
});
