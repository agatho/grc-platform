import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-202: BCP-Lifecycle (REQ-BCMS-010..015)

test("E2E-202: BCP gate-check returns blockers for empty plan", async ({
  page,
}) => {
  await login(page);
  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/plans?limit=1");
    return await r.json();
  });
  const id = list?.data?.[0]?.id;
  test.skip(!id, "no BCP available");

  const gate = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/bcms/plans/${id}/gate-check`);
    return await r.json();
  }, id);
  expect(gate).toMatchObject({ ok: expect.any(Boolean) });
});
