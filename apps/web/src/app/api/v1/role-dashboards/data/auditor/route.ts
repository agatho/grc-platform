import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { auditorDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/role-dashboards/data/auditor — Auditor Dashboard data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = auditorDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  // Findings overview
  const findingsOverview = await db.execute(sql`
    SELECT
      severity,
      status,
      count(*)::int as count
    FROM finding WHERE org_id = ${ctx.orgId}
    GROUP BY severity, status
    ORDER BY severity, status
  `);

  // Evidence quality metrics
  const [evidenceQuality] = await db.execute(sql`
    SELECT
      count(*)::int as total_evidence,
      count(*) FILTER (WHERE file_path IS NOT NULL)::int as with_attachment,
      count(*) FILTER (WHERE created_at > now() - interval '90 days')::int as recent_evidence
    FROM evidence WHERE org_id = ${ctx.orgId}
  `);

  // Open audit findings by age
  const findingsByAge = await db.execute(sql`
    SELECT
      CASE
        WHEN created_at > now() - interval '30 days' THEN 'under_30d'
        WHEN created_at > now() - interval '90 days' THEN '30_90d'
        ELSE 'over_90d'
      END as age_bucket,
      count(*)::int as count
    FROM finding
    WHERE org_id = ${ctx.orgId} AND status = 'open'
    GROUP BY 1
  `);

  return Response.json({
    data: {
      findingsOverview,
      evidenceQuality,
      findingsByAge,
      generatedAt: new Date().toISOString(),
    },
  });
}
