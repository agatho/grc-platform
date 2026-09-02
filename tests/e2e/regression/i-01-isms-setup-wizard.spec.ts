import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-101: ISMS Setup-Wizard end-to-end (REQ-ISMS-027)
// Workflow: User triggers setup-wizard → method config → asset import → SoA-Init.
//
// [E2E-TRIAGE-2026-09-02] The request body was `{ scope, framework, methodKey }`
// and the assertion looked for `data.assessmentId`. Neither has ever matched
// the endpoint. `assessmentSetupWizardSchema`
// (packages/shared/src/schemas/isms.ts:223) requires `name`, `description`,
// `frameworks[]`, `leadAssessorId`, `periodStart` and `periodEnd` — the three
// fields the spec sent are not in the schema at all, so the run measured
// `422 … {"name":["Required"],"description":["Required"],"frameworks":
// ["Required"],"leadAssessorId":["Required"],"periodStart":["Required"], …}`
// and the assertion `expect([200,201]).toContain(422)` failed. The response
// carries the created `assessment_run` row as `data`, so the id is `data.id`.
//
// The spec now speaks the endpoint's contract and asserts MORE than before:
// 201 exactly (not "200 or 201"), the created run in `planning` status with
// the frameworks it was given, and a SoA read that is scoped to that run.

test("E2E-101: ISMS setup wizard initializes assessment + SoA", async ({
  page,
}) => {
  const session = await login(page);
  expect(
    session.userId,
    "the wizard needs a lead assessor — the session has no user id",
  ).toBeTruthy();

  // The schema refuses a period shorter than 14 days, so pick a full quarter.
  const periodStart = "2026-01-01";
  const periodEnd = "2026-03-31";
  const name = `E2E-I01-${Date.now().toString().slice(-7)}`;

  const setupResult = await page.evaluate(
    async ({ n, lead, from, to }) => {
      const r = await fetch("/api/v1/isms/assessments/setup-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          description: "E2E setup wizard run (REQ-ISMS-027).",
          frameworks: ["iso27001"],
          scopeType: "full",
          leadAssessorId: lead,
          periodStart: from,
          periodEnd: to,
        }),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { n: name, lead: session.userId!, from: periodStart, to: periodEnd },
  );

  expect(setupResult.status, JSON.stringify(setupResult.body)).toBe(201);
  expect(setupResult.body?.data?.id).toBeTruthy();
  expect(setupResult.body?.data?.name).toBe(name);
  expect(setupResult.body?.data?.status).toBe("planning");
  expect(setupResult.body?.data?.framework).toBe("iso27001");
  // The Gate-G1 checklist the wizard computes for the UI must come back too —
  // it is the whole point of the "wizard" variant of assessment creation.
  expect(Array.isArray(setupResult.body?.setupChecklist?.requiredSteps)).toBe(
    true,
  );

  const assessmentId = setupResult.body.data.id as string;

  // SoA muss initialisiert sein
  const soaInit = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/soa?assessmentId=${id}&limit=5`);
    return { status: r.status, body: await r.json().catch(() => null) };
  }, assessmentId);

  expect(soaInit.status).toBe(200);
  expect(Array.isArray(soaInit.body?.data ?? soaInit.body)).toBe(true);
});
