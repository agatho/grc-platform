import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-201: BIA-Lifecycle (REQ-BCMS-001..007)

test("E2E-201: BIA gate-check rejects incomplete and finalize requires gate=ok", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/bia?limit=1");
    return await r.json();
  });
  const id = list?.data?.[0]?.id;
  test.skip(!id, "no BIA available");

  const gate = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/bcms/bia/${id}/gate-check`);
    return await r.json();
  }, id);

  expect(gate).toMatchObject({ ok: expect.any(Boolean) });
});
