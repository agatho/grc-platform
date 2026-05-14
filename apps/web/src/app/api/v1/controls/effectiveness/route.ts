// #WAVE6-CROSS-04: GET /api/v1/controls/effectiveness was 500 — caught
// by /controls/[id]/route.ts with id="effectiveness" → uuid parse crash.
//
// Aggregation of control test results so a dashboard can render the
// "control wirksamkeit" KPI without scraping every /tests sub-route.
//
// #WAVE7-FIX: the prior version compared `toe_result = 'pass' | 'fail'`,
// but the test_result enum (control.ts:76) is
// {effective, ineffective, partially_effective, not_tested}. Postgres
// rejected the literal with 22P02 and the 500 surfaced the SQL detail
// in the response. Aligning the filter values with the enum so the
// query is actually executable. Partially effective rolls up to the
// "effective" denominator at half-weight, matching ISACA's CMMI lens.

import { db, control, controlTest, finding } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Per-control aggregation: effective/ineffective/partial counts on
  // the test results. LEFT JOIN so controls without any test row still
  // surface in `controlsTotal`. `controlTest.deletedAt IS NULL` is also
  // satisfied by NULL columns from unmatched rows in a LEFT JOIN.
  const [stats] = await db
    .select({
      controlsTotal: sql<number>`count(distinct ${control.id})::int`,
      testsRun: sql<number>`count(${controlTest.id})::int`,
      effective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'effective')::int`,
      ineffective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'ineffective')::int`,
      partiallyEffective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'partially_effective')::int`,
      notTested: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'not_tested')::int`,
      pending: sql<number>`count(*) filter (where ${controlTest.id} is not null and ${controlTest.toeResult} is null)::int`,
    })
    .from(control)
    .leftJoin(controlTest, eq(controlTest.controlId, control.id))
    .where(
      and(
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
        isNull(controlTest.deletedAt),
      ),
    );

  // Tested = anything with a graded outcome (effective + partial + ineffective).
  // Effectiveness score weights partial as 0.5 — matches the ISACA CMMI
  // "managed" rung where the control works but not consistently.
  const eff = stats?.effective ?? 0;
  const partial = stats?.partiallyEffective ?? 0;
  const ineff = stats?.ineffective ?? 0;
  const tested = eff + partial + ineff;
  const effectivenessPct =
    tested > 0 ? Math.round(((eff + partial * 0.5) / tested) * 100) : 0;

  // #WAVE18-P1-1: Wave-17 dataflow tests showed that a major-nonconformity
  // or significant-nonconformity finding raised on a control didn't
  // affect the effectiveness rollup. Pure controlTest-counting misses
  // the regulator's real signal: a critical finding IS empirical
  // evidence the control failed, even if no formal test row exists.
  //
  // Two new aggregates surface that signal without rewriting the
  // controlTest contract:
  //   * `controlsWithOpenCriticalFindings` — distinct controls that
  //     have ≥1 still-open finding at major or significant severity.
  //   * `effectivenessPercentIncludingFindings` — recomputes the
  //     percentage with each impacted control treated as ineffective
  //     (regardless of test row). The "test-only" percentage stays
  //     under `effectivenessPercent` so existing dashboards don't
  //     shift unexpectedly.
  const [findingSignal] = await db
    .select({
      controlsWithOpenCriticalFindings: sql<number>`count(distinct ${finding.controlId})::int`,
      openCriticalFindings: sql<number>`count(*)::int`,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.controlId} is not null`,
        sql`${finding.severity} in ('major_nonconformity','significant_nonconformity')`,
        sql`${finding.status} not in ('closed','verified','accepted')`,
      ),
    );

  const impactedControls = findingSignal?.controlsWithOpenCriticalFindings ?? 0;
  const openCritical = findingSignal?.openCriticalFindings ?? 0;

  // Re-weight the percentage as if each control with an open critical
  // finding were a fresh ineffective test. tested-with-findings count
  // is the union of the test-graded set and the impacted set, so a
  // control that has both a passing test AND an open critical finding
  // counts as ineffective (the finding wins — regulators treat
  // standing nonconformities as authoritative).
  const testedWithFindings = tested + impactedControls;
  const ineffWithFindings = ineff + impactedControls;
  const effectivenessPercentIncludingFindings =
    testedWithFindings > 0
      ? Math.round(((eff + partial * 0.5) / testedWithFindings) * 100)
      : 0;

  return Response.json({
    data: {
      controlsTotal: stats?.controlsTotal ?? 0,
      testsRun: stats?.testsRun ?? 0,
      effective: eff,
      partiallyEffective: partial,
      ineffective: ineff,
      notTested: stats?.notTested ?? 0,
      pending: stats?.pending ?? 0,
      effectivenessPercent: effectivenessPct,
      // Cascade signal — null-safe defaults so old dashboards reading
      // only the test-side fields keep working untouched.
      controlsWithOpenCriticalFindings: impactedControls,
      openCriticalFindings: openCritical,
      ineffectiveIncludingFindings: ineffWithFindings,
      effectivenessPercentIncludingFindings,
      asOf: new Date().toISOString(),
    },
  });
});
