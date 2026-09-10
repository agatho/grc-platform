import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/dashboards/portfolio-optimization/health — Portfolio health indicators
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ap.functional_fit = 'insufficient')::int AS insufficient_fit,
      COUNT(*) FILTER (WHERE ap.planned_eol IS NOT NULL AND ap.planned_eol <= CURRENT_DATE + INTERVAL '12 months')::int AS approaching_eol,
      COUNT(*) FILTER (WHERE ap.last_assessed_at IS NULL OR ap.last_assessed_at < NOW() - INTERVAL '12 months')::int AS unassessed,
      COUNT(*) FILTER (WHERE ap.six_r_strategy IS NULL)::int AS no_six_r,
      AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(ap.last_assessed_at, ap.go_live_date::timestamp))) / 86400)::int AS avg_assessment_age_days
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired'
  `);

  const row = (result as unknown as Array<Record<string, number>>)[0];
  const total = row?.total ?? 1;

  return Response.json({
    data: {
      insufficientFunctionalFitPct: Math.round(
        ((row?.insufficient_fit ?? 0) / total) * 100,
      ),
      approachingEolPct: Math.round(
        ((row?.approaching_eol ?? 0) / total) * 100,
      ),
      unassessedPct: Math.round(((row?.unassessed ?? 0) / total) * 100),
      noSixRDecisionPct: Math.round(((row?.no_six_r ?? 0) / total) * 100),
      avgAssessmentAgeDays: row?.avg_assessment_age_days ?? 0,
    },
  });
});
