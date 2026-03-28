import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cfoDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/role-dashboards/data/cfo — CFO Dashboard data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = cfoDashboardQuerySchema.parse(Object.fromEntries(url.searchParams));

  // Financial risk exposure from FAIR simulations
  const [financialExposure] = await db.execute(sql`
    SELECT
      count(*)::int as simulations,
      COALESCE(sum(ale_p50::numeric), 0) as total_expected_loss_p50,
      COALESCE(sum(ale_p95::numeric), 0) as total_var_p95,
      COALESCE(avg(ale_mean::numeric), 0) as avg_expected_loss
    FROM fair_simulation_result
    WHERE org_id = ${ctx.orgId} AND status = 'completed'
  `);

  // Open findings count (audit effort proxy)
  const [findingsSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_findings,
      count(*) FILTER (WHERE status = 'open')::int as open_findings,
      count(*) FILTER (WHERE severity = 'critical')::int as critical_findings
    FROM finding WHERE org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: {
      financialExposure,
      auditEffort: findingsSummary,
      currency: query.currency,
      generatedAt: new Date().toISOString(),
    },
  });
}
