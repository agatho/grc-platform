import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/dashboards/risk-management — Risk distribution per application from ERM data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const categoryDist = await db.execute(sql`
    SELECT r.risk_category AS value, COUNT(*)::int AS count
    FROM risk r
    JOIN entity_reference er ON er.source_id = r.id AND er.source_type = 'risk'
    JOIN architecture_element ae ON er.target_id = ae.id AND ae.type = 'application'
    WHERE ae.org_id = ${ctx.orgId}
    GROUP BY r.risk_category ORDER BY count DESC
  `);

  const ratingDist = await db.execute(sql`
    SELECT r.inherent_risk_level AS value, COUNT(*)::int AS count
    FROM risk r
    JOIN entity_reference er ON er.source_id = r.id AND er.source_type = 'risk'
    JOIN architecture_element ae ON er.target_id = ae.id AND ae.type = 'application'
    WHERE ae.org_id = ${ctx.orgId}
    GROUP BY r.inherent_risk_level ORDER BY count DESC
  `);

  const totalResult = await db.execute(sql`
    SELECT COUNT(DISTINCT r.id)::int AS total_risks,
           COUNT(DISTINCT r.id) FILTER (WHERE r.inherent_risk_level = 'critical')::int AS critical_risks,
           COUNT(DISTINCT ae.id)::int AS apps_with_risks
    FROM risk r
    JOIN entity_reference er ON er.source_id = r.id AND er.source_type = 'risk'
    JOIN architecture_element ae ON er.target_id = ae.id AND ae.type = 'application'
    WHERE ae.org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: {
      kpis: (totalResult as unknown as Array<Record<string, number>>)[0],
      categoryDistribution: categoryDist,
      ratingDistribution: ratingDist,
    },
  });
});
