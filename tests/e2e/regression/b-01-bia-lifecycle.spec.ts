import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-201: BIA-Lifecycle (REQ-BCMS-001..007)
//
// [E2E-TRIAGE-3 · 2026-09-02] This test had never run.
//
// `test.skip(!id, "no BIA available")` matched on every run before this round:
// the suite was pointed at a tenant `db:seed:demo` does not fill, so the list
// came back empty and the spec reported "skipped". Once the tenant pin landed
// it ran for the first time — and failed on `toMatchObject({ ok: … })`, a
// shape this endpoint has never returned. It answers
//
//   { data: { biaAssessmentId, snapshot, coverageStats,
//             b1: { passed, blockers[] }, b2: { passed, blockers[] } } }
//
// so the old line asserted the presence of a key that was never there. What it
// meant to check — the two BCMS gates report a verdict, and that verdict
// follows from the blockers — is checked properly below. An empty list is now
// a named failure rather than a silent skip (S11-08): "no data" is exactly
// what hid this for three rounds.

interface Blocker {
  code: string;
  severity: string;
  message?: string;
}
interface Gate {
  passed: boolean;
  blockers: Blocker[];
}

test("E2E-201: BIA gate-check reports B1/B2 verdicts derived from their blockers", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/bia?limit=1");
    return { status: r.status, body: await r.text() };
  });
  expect(list.status, `GET /api/v1/bcms/bia -> ${list.body}`).toBe(200);
  const id: string | undefined = JSON.parse(list.body)?.data?.[0]?.id;
  expect(
    id,
    "no BIA in the active tenant. The suite asserts against the tenant " +
      "E2E_ORG_ID pins (default: the one `db:seed:demo` fills) — seed it. " +
      "This used to be a silent `test.skip`.",
  ).toBeTruthy();

  const gate = await page.evaluate(async (biaId) => {
    const r = await fetch(`/api/v1/bcms/bia/${biaId}/gate-check`);
    return { status: r.status, body: await r.text() };
  }, id!);
  expect(gate.status, gate.body).toBe(200);

  const data = JSON.parse(gate.body).data as {
    biaAssessmentId: string;
    snapshot: Record<string, unknown>;
    coverageStats: {
      totalProcessImpacts: number;
      scoredImpacts: number;
      essentialCount: number;
      minimumEssentialCount: number;
    };
    b1: Gate;
    b2: Gate;
  };

  expect(data.biaAssessmentId).toBe(id);
  expect(data.snapshot).toBeDefined();
  expect(typeof data.coverageStats.totalProcessImpacts).toBe("number");
  expect(typeof data.coverageStats.scoredImpacts).toBe("number");
  // Scored impacts are a subset of all impacts — a coverage figure larger
  // than its own base is a defect, not a rounding artefact.
  expect(data.coverageStats.scoredImpacts).toBeLessThanOrEqual(
    data.coverageStats.totalProcessImpacts,
  );

  // The verdict must FOLLOW from the blockers. `passed: true` next to an error
  // blocker (or the reverse) is the failure worth catching here, and it is
  // exactly what `expect.any(Boolean)` could never have caught.
  for (const [name, gateResult] of [
    ["b1", data.b1],
    ["b2", data.b2],
  ] as const) {
    expect(Array.isArray(gateResult.blockers), `${name}.blockers`).toBe(true);
    const errors = gateResult.blockers.filter((b) => b.severity === "error");
    expect(
      gateResult.passed,
      `${name}.passed is ${gateResult.passed} while it reports ` +
        `${errors.length} error blocker(s): ${JSON.stringify(errors)}`,
    ).toBe(errors.length === 0);
    for (const blocker of gateResult.blockers) {
      expect(blocker.code, `${name} blocker without a code`).toBeTruthy();
      expect(["error", "warning"]).toContain(blocker.severity);
    }
  }
});
