import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/risk-management/per-app — Risks per application bar chart data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT ae.id AS app_id, ae.name AS app_name,
           r.risk_category, COUNT(*)::int AS risk_count
    FROM risk r
    JOIN entity_reference er ON er.source_id = r.id AND er.source_type = 'risk'
    JOIN architecture_element ae ON er.target_id = ae.id AND ae.type = 'application'
    WHERE ae.org_id = ${ctx.orgId}
    GROUP BY ae.id, ae.name, r.risk_category
    ORDER BY risk_count DESC
  `);

  return Response.json({ data: result });
}
