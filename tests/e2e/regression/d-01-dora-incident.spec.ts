import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-303: DORA Incident-Lifecycle (REQ-DORA-010..014)

test("E2E-303: DORA incidents list and ICT-risks list reachable", async ({
  page,
}) => {
  await login(page);
  const inc = await page.evaluate(async () => {
    const r = await fetch("/api/v1/dora/ict-incidents?limit=5");
    return r.status;
  });
  expect(inc).toBe(200);

  const risks = await page.evaluate(async () => {
    const r = await fetch("/api/v1/dora/ict-risks?limit=5");
    return r.status;
  });
  expect(risks).toBe(200);
});
