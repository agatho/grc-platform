import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-103: SoA Diff + Excel-Export (REQ-ISMS-012, REQ-ISMS-013)

test("E2E-103: SoA diff endpoint returns structured changes", async ({
  page,
}) => {
  await login(page);

  // [E2E-TRIAGE-2026-09-02] Was `?from=baseline&to=current` asserted as
  // `expect([200, 404]).toContain(status)` "404 ok wenn keine Snapshots".
  // Three things were wrong with that. The endpoint has no `from`/`to`
  // parameters — it is time-based (`?since=<ISO-8601>`) with an unimplemented
  // run-based mode behind `fromRunId`/`toRunId`
  // (apps/web/src/app/api/v1/isms/soa/diff/route.ts:7). With neither supplied
  // it answers `400 Missing 'since' parameter`, which the accepted list did
  // not contain, so the spec failed on its own URL. And the list would have
  // passed a 404 — an endpoint that does not exist — as success, which is
  // exactly the S11-07 pattern the audit removed elsewhere.
  //
  // Now: call the real contract and assert the structure the test name
  // promises. `since` is deliberately far enough back to cover the seeded SoA.
  const diff = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/soa/diff?since=2000-01-01T00:00:00Z");
    return { status: r.status, body: await r.json().catch(() => null) };
  });

  expect(diff.status, JSON.stringify(diff.body)).toBe(200);
  const data = diff.body?.data as
    | {
        since?: string;
        totalChanged?: number;
        created?: number;
        modified?: number;
        entries?: { created?: unknown[]; modified?: unknown[] };
      }
    | undefined;
  expect(data, "SoA diff returned no `data`").toBeTruthy();
  expect(typeof data!.totalChanged).toBe("number");
  expect(typeof data!.created).toBe("number");
  expect(typeof data!.modified).toBe("number");
  expect(Array.isArray(data!.entries?.created)).toBe(true);
  expect(Array.isArray(data!.entries?.modified)).toBe(true);
  expect(data!.totalChanged).toBe(data!.created! + data!.modified!);

  // The unimplemented run-based mode must say so explicitly rather than
  // silently falling back to the time-based answer.
  const runMode = await page.evaluate(async () => {
    const r = await fetch(
      "/api/v1/isms/soa/diff?fromRunId=00000000-0000-4000-8000-000000000001" +
        "&toRunId=00000000-0000-4000-8000-000000000002",
    );
    return r.status;
  });
  expect(runMode).toBe(501);
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
