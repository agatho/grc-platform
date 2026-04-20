import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/cost-management/treemap-infra — IT component cost treemap data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT ae.id, ae.name,
           COALESCE(ae.metadata->>'provider_name', 'Unknown') AS provider_name,
           COALESCE((ae.metadata->>'annual_cost')::numeric, 0) AS annual_cost
    FROM architecture_element ae
    WHERE ae.org_id = ${ctx.orgId} AND ae.layer = 'technology'
      AND ae.status != 'retired'
      AND (ae.metadata->>'annual_cost')::numeric > 0
    ORDER BY (ae.metadata->>'annual_cost')::numeric DESC
  `);

  const rows = result as unknown as Array<{
    id: string;
    name: string;
    provider_name: string;
    annual_cost: string;
  }>;
  const providerMap: Record<
    string,
    {
      name: string;
      value: number;
      children: { name: string; value: number; id: string }[];
    }
  > = {};

  for (const row of rows) {
    const provider = row.provider_name;
    if (!providerMap[provider])
      providerMap[provider] = { name: provider, value: 0, children: [] };
    const cost = Number(row.annual_cost);
    providerMap[provider].value += cost;
    providerMap[provider].children.push({
      name: row.name,
      value: cost,
      id: row.id,
    });
  }

  return Response.json({
    data: { name: "IT Components", children: Object.values(providerMap) },
  });
}
