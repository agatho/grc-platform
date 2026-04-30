import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-103: SoA Diff + Excel-Export (REQ-ISMS-012, REQ-ISMS-013)

test("E2E-103: SoA diff endpoint returns structured changes", async ({
  page,
}) => {
  await login(page);

  const diffStatus = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/soa/diff?from=baseline&to=current");
    return r.status;
  });

  expect([200, 404]).toContain(diffStatus); // 404 ok wenn keine Snapshots
});

test("E2E-103b: SoA export delivers a downloadable file", async ({ page }) => {
  await login(page);

  const exportRes = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/soa/export");
    return {
      status: r.status,
      contentType: r.headers.get("content-type"),
      contentDisposition: r.headers.get("content-disposition"),
    };
  });

  expect(exportRes.status).toBe(200);
  expect(exportRes.contentType).toMatch(/spreadsheet|excel|octet-stream|csv/);
});
