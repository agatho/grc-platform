import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-202: BCP-Lifecycle (REQ-BCMS-010..015)
//
// [E2E-TRIAGE-3 · 2026-09-02] Same story as b-01: the spec reported "skipped"
// on every run because the tenant it looked in had no plans, and the moment it
// ran it failed on `toMatchObject({ ok: … })`. The endpoint answers
//
//   { data: { bcpId, status, snapshot,
//             b3: { passed, blockers[] },
//             b5: { passed, blockers[] },
//             b6: { passed, blockers[] } } }
//
// — three gates, each with a verdict that has to follow from its blockers.
// That is what is asserted now, plus the absence of the list is a named
// failure instead of a skip (S11-08).

interface Blocker {
  code: string;
  severity: string;
  message?: string;
}
interface Gate {
  passed: boolean;
  blockers: Blocker[];
}

test("E2E-202: BCP gate-check reports B3/B5/B6 verdicts derived from their blockers", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/bcms/plans?limit=1");
    return { status: r.status, body: await r.text() };
  });
  expect(list.status, `GET /api/v1/bcms/plans -> ${list.body}`).toBe(200);
  const id: string | undefined = JSON.parse(list.body)?.data?.[0]?.id;
  expect(
    id,
    "no business continuity plan in the active tenant. The suite asserts " +
      "against the tenant E2E_ORG_ID pins (default: the one `db:seed:demo` " +
      "fills) — seed it. This used to be a silent `test.skip`.",
  ).toBeTruthy();

  const gate = await page.evaluate(async (bcpId) => {
    const r = await fetch(`/api/v1/bcms/plans/${bcpId}/gate-check`);
    return { status: r.status, body: await r.text() };
  }, id!);
  expect(gate.status, gate.body).toBe(200);

  const data = JSON.parse(gate.body).data as {
    bcpId: string;
    status: string;
    snapshot: {
      procedureCount: number;
      resourceCount: number;
      [k: string]: unknown;
    };
    b3: Gate;
    b5: Gate;
    b6: Gate;
  };

  expect(data.bcpId).toBe(id);
  expect(
    data.status,
    "the gate-check must report the plan's status",
  ).toBeTruthy();
  expect(typeof data.snapshot.procedureCount).toBe("number");
  expect(typeof data.snapshot.resourceCount).toBe("number");

  for (const [name, gateResult] of [
    ["b3", data.b3],
    ["b5", data.b5],
    ["b6", data.b6],
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
