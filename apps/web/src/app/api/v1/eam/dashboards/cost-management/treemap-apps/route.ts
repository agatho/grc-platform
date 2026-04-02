import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/cost-management/treemap-apps — Application cost treemap data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT ae.id, ae.name, ap.license_type AS category,
           COALESCE(ap.annual_cost, 0)::numeric AS annual_cost
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired'
      AND ap.annual_cost IS NOT NULL AND ap.annual_cost > 0
    ORDER BY ap.annual_cost DESC
  `);

  const rows = result as unknown as Array<{ id: string; name: string; category: string; annual_cost: string }>;
  const categoryMap: Record<string, { name: string; value: number; children: { name: string; value: number; id: string }[] }> = {};

  for (const row of rows) {
    const cat = row.category || "uncategorized";
    if (!categoryMap[cat]) categoryMap[cat] = { name: cat, value: 0, children: [] };
    const cost = Number(row.annual_cost);
    categoryMap[cat].value += cost;
    categoryMap[cat].children.push({ name: row.name, value: cost, id: row.id });
  }

  return Response.json({ data: { name: "Applications", children: Object.values(categoryMap) } });
}
