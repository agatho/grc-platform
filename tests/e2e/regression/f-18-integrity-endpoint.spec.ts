import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// F-18 + ADR-011: Audit-trail SHA-256 hash-chain integrity. The endpoint
// re-computes every row's hash and verifies the chain. Any tamper with
// audit_log would show up as a row or chain mismatch.

test("Audit-log hash-chain integrity", async ({ page }) => {
  await login(page);

  const resp = await page.evaluate(async () => {
    const r = await fetch("/api/v1/audit-log/integrity");
    const t = await r.text();
    let d: any = null;
    try { d = JSON.parse(t); } catch {}
    return { status: r.status, data: d };
  });

  expect(resp.status === 200 || resp.status === 503).toBeTruthy();
  expect(resp.data?.data?.total).toBeGreaterThanOrEqual(0);

  const rowMismatches = resp.data?.data?.rowMismatches?.length ?? 0;
  const chainMismatches = resp.data?.data?.chainMismatches?.length ?? 0;

  // Hard assertion: 0 tolerance. An audit log with even one tamper is
  // a GRC-platform-level incident -- this test MUST fail in that case.
  expect(rowMismatches).toBe(0);
  expect(chainMismatches).toBe(0);
});
