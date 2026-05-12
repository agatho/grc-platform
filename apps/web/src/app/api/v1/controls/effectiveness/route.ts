// #WAVE6-CROSS-04: GET /api/v1/controls/effectiveness was 500 — caught
// by /controls/[id]/route.ts with id="effectiveness" → uuid parse crash.
//
// Aggregation of control test results so a dashboard can render the
// "control wirksamkeit" KPI without scraping every /tests sub-route.

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

  // Per-control aggregation: pass/fail counts on the most recent test
  // results. Joins controlTest → control so we can filter by org and
  // ignore soft-deleted controls.
  const [stats] = await db
    .select({
      controlsTotal: sql<number>`count(distinct ${control.id})::int`,
      testsRun: sql<number>`count(${controlTest.id})::int`,
      effective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'pass')::int`,
      ineffective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'fail')::int`,
      pending: sql<number>`count(*) filter (where ${controlTest.toeResult} is null)::int`,
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

  const tested = (stats?.effective ?? 0) + (stats?.ineffective ?? 0);
  const effectivenessPct =
    tested > 0 ? Math.round(((stats?.effective ?? 0) / tested) * 100) : 0;

  return Response.json({
    data: {
      controlsTotal: stats?.controlsTotal ?? 0,
      testsRun: stats?.testsRun ?? 0,
      effective: stats?.effective ?? 0,
      ineffective: stats?.ineffective ?? 0,
      pending: stats?.pending ?? 0,
      effectivenessPercent: effectivenessPct,
      asOf: new Date().toISOString(),
    },
  });
});
