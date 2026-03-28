import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/cost-management/trend — Cost trend over time
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Since cost is annualized (not monthly transactions), we compute a static distribution
  // Monthly trend could use assessment history or budget data from Sprint 13
  const result = await db.execute(sql`
    SELECT ap.license_type AS category,
           COALESCE(SUM(ap.annual_cost), 0)::numeric AS total_annual_cost,
           COUNT(*)::int AS app_count
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired'
    GROUP BY ap.license_type
    ORDER BY total_annual_cost DESC
  `);

  return Response.json({ data: { categories: result.rows ?? result } });
}
