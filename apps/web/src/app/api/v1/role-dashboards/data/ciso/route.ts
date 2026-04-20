import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cisoDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/role-dashboards/data/ciso — CISO Dashboard data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = cisoDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  // Aggregate risk posture, threat intel, top-10 risks
  const [riskSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_risks,
      count(*) FILTER (WHERE status = 'open')::int as open_risks,
      count(*) FILTER (WHERE risk_level = 'critical')::int as critical_risks,
      count(*) FILTER (WHERE risk_level = 'high')::int as high_risks
    FROM risk WHERE org_id = ${ctx.orgId}
  `);

  const topRisks = await db.execute(sql`
    SELECT id, title, risk_level, status, inherent_likelihood, inherent_impact
    FROM risk WHERE org_id = ${ctx.orgId}
    ORDER BY
      CASE risk_level
        WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
      END
    LIMIT ${query.topN}
  `);

  const [controlSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_controls,
      count(*) FILTER (WHERE effectiveness = 'effective')::int as effective_controls,
      count(*) FILTER (WHERE effectiveness = 'partially_effective')::int as partial_controls,
      count(*) FILTER (WHERE effectiveness = 'ineffective')::int as ineffective_controls
    FROM control WHERE org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: {
      riskPosture: riskSummary,
      topRisks,
      controlEffectiveness: controlSummary,
      generatedAt: new Date().toISOString(),
    },
  });
}
