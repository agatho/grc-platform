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

import { db, control, controlTest } from "@grc/db";
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
      asOf: new Date().toISOString(),
    },
  });
});
