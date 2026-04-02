import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/cost-management — Aggregated cost data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const appCosts = await db.execute(sql`
    SELECT ap.license_type AS category,
           COUNT(*)::int AS app_count,
           COALESCE(SUM(ap.annual_cost), 0)::numeric AS total_cost
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired'
    GROUP BY ap.license_type
    ORDER BY total_cost DESC
  `);

  const infraCosts = await db.execute(sql`
    SELECT COALESCE(ae.metadata->>'provider_name', 'Unknown') AS provider_name,
           COUNT(*)::int AS component_count,
           COALESCE(SUM((ae.metadata->>'annual_cost')::numeric), 0) AS total_cost
    FROM architecture_element ae
    WHERE ae.org_id = ${ctx.orgId} AND ae.layer = 'technology' AND ae.status != 'retired'
    GROUP BY ae.metadata->>'provider_name'
    ORDER BY total_cost DESC
  `);

  const rows = appCosts;
  const infraRows = infraCosts;

  return Response.json({
    data: {
      totalApplications: (rows as unknown as Array<{ app_count: number }>).reduce((s: number, r: { app_count: number }) => s + r.app_count, 0),
      totalApplicationCost: (rows as unknown as Array<{ total_cost: string }>).reduce((s: number, r: { total_cost: string }) => s + Number(r.total_cost), 0),
      totalComponents: (infraRows as unknown as Array<{ component_count: number }>).reduce((s: number, r: { component_count: number }) => s + r.component_count, 0),
      totalComponentCost: (infraRows as unknown as Array<{ total_cost: string }>).reduce((s: number, r: { total_cost: string }) => s + Number(r.total_cost), 0),
      costByCategory: rows,
      costByProvider: infraRows,
    },
  });
}
