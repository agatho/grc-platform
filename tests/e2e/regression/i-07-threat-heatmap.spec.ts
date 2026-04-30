import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-107: Threat-Heatmap + MITRE-Heatmap (REQ-THR-002, REQ-THR-003)

test("E2E-107: threat heatmap endpoints respond", async ({ page }) => {
  await login(page);

  const heatmap = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/threats/heatmap");
    return r.status;
  });
  expect([200, 204]).toContain(heatmap);

  const mitre = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/incidents/mitre-heatmap");
    return r.status;
  });
  expect([200, 204]).toContain(mitre);
});
