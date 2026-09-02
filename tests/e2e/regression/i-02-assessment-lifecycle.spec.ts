import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-102: Vollständiger Assessment-Lifecycle (REQ-ISMS-020..025)
// eval → soa → risk → review → finalize, mit Gate-Checks an jedem Übergang.
//
// [E2E-TRIAGE-3 · 2026-09-02] Third of the three specs that had never run.
//
// `test.skip(!id, …)` matched on every run, and the first time the spec
// actually executed it failed on `toMatchObject({ ok: … })`. The gate endpoint
// answers
//
//   { data: { assessmentRunId, stats: { totalEvaluations,
//             completedEvaluations }, coverage, blockers[], passed } }
//
// The forbidden-transition half was wrong in a second, independent way: it
// POSTed `{ to: "finalize" }`, and the route's schema takes `targetStatus`
// out of a five-value enum that has no "finalize". The 422 it observed came
// from `transitionSchema.safeParse` — the state machine was never reached, so
// "blocks invalid phase transitions" was never tested. `[400, 409, 422]` as
// the expectation made the two indistinguishable. Both cases are now asserted
// separately, plus the invariant that a REFUSED transition leaves the run
// where it was.

test("E2E-102: assessment lifecycle blocks invalid phase transitions", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/assessments?limit=1");
    return { status: r.status, body: await r.text() };
  });
  expect(list.status, `GET /api/v1/isms/assessments -> ${list.body}`).toBe(200);
  const run = JSON.parse(list.body)?.data?.[0] as
    { id: string; status: string } | undefined;
  expect(
    run?.id,
    "no assessment run in the active tenant. The suite asserts against the " +
      "tenant E2E_ORG_ID pins (default: the one `db:seed:demo` fills) — seed " +
      "it. This used to be a silent `test.skip`.",
  ).toBeTruthy();
  const id = run!.id;
  const statusBefore = run!.status;

  // Gate G4 coverage check.
  const gate = await page.evaluate(async (runId) => {
    const r = await fetch(`/api/v1/isms/assessments/${runId}/eval-gate-check`);
    return { status: r.status, body: await r.text() };
  }, id);
  expect(gate.status, gate.body).toBe(200);
  const data = JSON.parse(gate.body).data as {
    assessmentRunId: string;
    stats: { totalEvaluations: number; completedEvaluations: number };
    coverage: unknown;
    blockers: Array<{ code: string; severity: string }>;
    passed: boolean;
  };

  expect(data.assessmentRunId).toBe(id);
  expect(typeof data.stats.totalEvaluations).toBe("number");
  expect(typeof data.stats.completedEvaluations).toBe("number");
  // Completed evaluations are a subset of all evaluations.
  expect(data.stats.completedEvaluations).toBeLessThanOrEqual(
    data.stats.totalEvaluations,
  );
  expect(data.coverage, "the gate reports no coverage figure").toBeDefined();
  expect(Array.isArray(data.blockers)).toBe(true);
  // The verdict follows from the blockers — the check the old
  // `expect.any(Boolean)` could not make.
  const errors = data.blockers.filter((b) => b.severity === "error");
  expect(
    data.passed,
    `passed is ${data.passed} while the gate reports ${errors.length} error ` +
      `blocker(s): ${JSON.stringify(errors)}`,
  ).toBe(errors.length === 0);

  // A malformed body is refused — and it is refused as a SCHEMA error, which
  // is the second thing this spec used to get wrong. It sent
  // `{ to: "finalize" }`; the route's schema takes `targetStatus` and does not
  // know the value "finalize" at all, so the 422 it observed came from
  // `transitionSchema.safeParse`, never from the state machine. The old
  // `expect([400, 409, 422]).toContain(...)` could not tell those apart, so
  // the "forbidden transition is blocked" assertion never touched a guard.
  const malformed = await page.evaluate(async (runId) => {
    const r = await fetch(`/api/v1/isms/assessments/${runId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "finalize" }),
    });
    return { status: r.status, body: await r.text() };
  }, id);
  expect(malformed.status, malformed.body).toBe(422);
  expect(
    JSON.parse(malformed.body).error,
    "a body the schema does not accept must be reported as a validation " +
      "failure, not as a blocked transition",
  ).toBe("Validation failed");

  // The actual guard: a run may never transition into the state it is already
  // in. That is invalid from EVERY state in ALLOWED_TRANSITIONS, so the
  // assertion does not depend on which phase the seeded run happens to be in.
  const invalid = await page.evaluate(
    async ({ runId, target }) => {
      const r = await fetch(`/api/v1/isms/assessments/${runId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: target }),
      });
      return { status: r.status, body: await r.text() };
    },
    { runId: id, target: statusBefore },
  );
  expect(
    invalid.status,
    `${statusBefore} -> ${statusBefore} must be refused by the state machine ` +
      `with 422, got ${invalid.status}: ${invalid.body}`,
  ).toBe(422);
  const invalidBody = JSON.parse(invalid.body) as {
    blocked?: boolean;
    currentStatus?: string;
    blockers?: Array<{ code: string; severity: string }>;
  };
  expect(
    invalidBody.blocked,
    `the refusal must come from the state machine (blocked: true), not from ` +
      `schema validation: ${invalid.body}`,
  ).toBe(true);
  expect(invalidBody.currentStatus).toBe(statusBefore);
  expect(
    (invalidBody.blockers ?? []).map((b) => b.code),
    "the refusal names no blocker",
  ).toContain("invalid_transition");

  // …and the refusal must not have moved the run. A guard that answers 422
  // after writing is worse than no guard.
  const after = await page.evaluate(async (runId) => {
    const r = await fetch(`/api/v1/isms/assessments/${runId}`);
    return { status: r.status, body: await r.text() };
  }, id);
  expect(after.status, after.body).toBe(200);
  expect(
    JSON.parse(after.body)?.data?.status,
    "the refused transition changed the assessment status anyway",
  ).toBe(statusBefore);
});
