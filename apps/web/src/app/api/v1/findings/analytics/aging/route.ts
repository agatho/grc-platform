import { db, finding } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/findings/analytics/aging — Aging distribution of open findings
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Get open findings with their age in days
  const rows = await db
    .select({
      severity: finding.severity,
      bucket: sql<string>`CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - ${finding.createdAt})) / 86400 < 30 THEN 'lt30'
        WHEN EXTRACT(EPOCH FROM (NOW() - ${finding.createdAt})) / 86400 < 60 THEN '30to60'
        WHEN EXTRACT(EPOCH FROM (NOW() - ${finding.createdAt})) / 86400 < 90 THEN '60to90'
        ELSE 'gt90'
      END`.as("bucket"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.status} NOT IN ('closed', 'verified')`,
      ),
    )
    .groupBy(finding.severity, sql`bucket`);

  // Pivot into structured response
  const buckets = ["lt30", "30to60", "60to90", "gt90"] as const;
  const bySeverity: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {
    lt30: 0,
    "30to60": 0,
    "60to90": 0,
    gt90: 0,
  };

  for (const r of rows) {
    if (!bySeverity[r.severity]) {
      bySeverity[r.severity] = { lt30: 0, "30to60": 0, "60to90": 0, gt90: 0 };
    }
    const cnt = Number(r.count);
    bySeverity[r.severity][r.bucket] = cnt;
    totals[r.bucket] += cnt;
  }

  return Response.json({
    data: {
      totals,
      bySeverity,
      bucketLabels: {
        lt30: "< 30 days",
        "30to60": "30-60 days",
        "60to90": "60-90 days",
        gt90: "> 90 days",
      },
    },
  });
}
