import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { boardDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/role-dashboards/data/board — Board Dashboard (simplified)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = boardDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  // Top 5 risks in plain language
  const topRisks = await db.execute(sql`
    SELECT id, title, description, risk_level, status
    FROM risk WHERE org_id = ${ctx.orgId}
    ORDER BY
      CASE risk_level
        WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
      END
    LIMIT 5
  `);

  // Maturity radar data
  const maturityData = await db.execute(sql`
    SELECT module_key, current_level, target_level
    FROM maturity_model WHERE org_id = ${ctx.orgId}
  `);

  // Overall compliance posture
  const [complianceSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_controls,
      count(*) FILTER (WHERE effectiveness = 'effective')::int as compliant,
      ROUND(
        100.0 * count(*) FILTER (WHERE effectiveness = 'effective') / NULLIF(count(*), 0),
        1
      ) as compliance_pct
    FROM control WHERE org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: {
      topRisks,
      maturityRadar: maturityData,
      compliancePosture: complianceSummary,
      language: query.language,
      simplified: query.simplified,
      generatedAt: new Date().toISOString(),
    },
  });
}
