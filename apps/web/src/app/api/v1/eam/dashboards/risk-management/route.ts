import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/risk-management — Risk distribution per application from ERM data
export async function GET(req: Request) {
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
      kpis: ((totalResult.rows ?? totalResult) as Array<Record<string, number>>)[0],
      categoryDistribution: categoryDist.rows ?? categoryDist,
      ratingDistribution: ratingDist.rows ?? ratingDist,
    },
  });
}
