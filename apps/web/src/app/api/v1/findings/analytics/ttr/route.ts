import { db, finding, findingSlaConfig } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/findings/analytics/ttr — Time-to-Resolution by severity
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Average TTR in days per severity for resolved findings
  const rows = await db
    .select({
      severity: finding.severity,
      avgDays: sql<number>`ROUND(AVG(
        EXTRACT(EPOCH FROM (COALESCE(${finding.updatedAt}, NOW()) - ${finding.createdAt})) / 86400
      ), 1)`.as("avg_days"),
      medianDays: sql<number>`ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (COALESCE(${finding.updatedAt}, NOW()) - ${finding.createdAt})) / 86400
      ), 1)`.as("median_days"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.status} IN ('closed', 'verified')`,
      ),
    )
    .groupBy(finding.severity);

  // Also fetch SLA targets for reference lines
  const slaConfigs = await db
    .select({
      severity: findingSlaConfig.severity,
      slaDays: findingSlaConfig.slaDays,
    })
    .from(findingSlaConfig)
    .where(eq(findingSlaConfig.orgId, ctx.orgId));

  const slaMap: Record<string, number> = {};
  for (const s of slaConfigs) {
    slaMap[s.severity] = s.slaDays;
  }

  const data = rows.map((r) => ({
    severity: r.severity,
    avgDays: Number(r.avgDays),
    medianDays: Number(r.medianDays),
    count: Number(r.count),
    slaDays: slaMap[r.severity] ?? null,
  }));

  return Response.json({ data });
}
