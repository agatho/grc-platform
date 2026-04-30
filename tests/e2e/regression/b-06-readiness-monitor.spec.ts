import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-206: Readiness-Monitor + PDF-Export (REQ-BCMS-042..043)

test("E2E-206: readiness monitor returns and PDF endpoint reachable", async ({
  page,
}) => {
  await login(page);
  const m = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/readiness-monitor");
    return r.status;
  });
  expect(m).toBe(200);

  const pdf = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/readiness-monitor/pdf");
    return {
      status: r.status,
      contentType: r.headers.get("content-type"),
    };
  });
  expect([200, 204]).toContain(pdf.status);
});
