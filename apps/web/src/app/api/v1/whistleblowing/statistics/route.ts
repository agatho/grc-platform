// GET /api/v1/whistleblowing/statistics — Anonymized KPIs (admin/risk_manager)

import { db, wbCase, wbReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, gte, lt, isNotNull, count } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);
  const endOfPrevYear = new Date(now.getFullYear(), 0, 1);

  // Total YTD
  const [ytdResult] = await db
    .select({ total: count() })
    .from(wbCase)
    .where(
      and(eq(wbCase.orgId, ctx.orgId), gte(wbCase.createdAt, startOfYear)),
    );

  // Total previous year
  const [prevYearResult] = await db
    .select({ total: count() })
    .from(wbCase)
    .where(
      and(
        eq(wbCase.orgId, ctx.orgId),
        gte(wbCase.createdAt, startOfPrevYear),
        lt(wbCase.createdAt, endOfPrevYear),
      ),
    );

  // Average resolution time (days) for resolved cases
  const avgResResult = await db.execute(
    sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400), 0) as avg_days
        FROM wb_case WHERE org_id = ${ctx.orgId} AND resolved_at IS NOT NULL`,
  );
  const avgResolutionDays = Math.round(
    Number((avgResResult as any)[0]?.avg_days ?? 0),
  );

  // 7-day SLA compliance (acknowledged within 7 days)
  const sla7dResult = await db.execute(
    sql`SELECT
          COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL AND acknowledged_at <= acknowledge_deadline) as compliant,
          COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL OR (acknowledge_deadline < NOW() AND acknowledged_at IS NULL)) as total
        FROM wb_case WHERE org_id = ${ctx.orgId}`,
  );
  const sla7dRow = (sla7dResult as any)[0];
  const sla7dCompliance =
    sla7dRow?.total > 0
      ? Math.round((sla7dRow.compliant / sla7dRow.total) * 100)
      : 100;

  // 3-month SLA compliance (resolved within 3 months)
  const sla3mResult = await db.execute(
    sql`SELECT
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= response_deadline) as compliant,
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL OR (response_deadline < NOW() AND resolved_at IS NULL)) as total
        FROM wb_case WHERE org_id = ${ctx.orgId}`,
  );
  const sla3mRow = (sla3mResult as any)[0];
  const sla3mCompliance =
    sla3mRow?.total > 0
      ? Math.round((sla3mRow.compliant / sla3mRow.total) * 100)
      : 100;

  // Category distribution (YTD)
  const categoryResult = await db.execute(
    sql`SELECT r.category, COUNT(*) as cnt
        FROM wb_case c
        JOIN wb_report r ON r.id = c.report_id
        WHERE c.org_id = ${ctx.orgId} AND c.created_at >= ${startOfYear}
        GROUP BY r.category`,
  );
  const byCategory: Record<string, number> = {};
  for (const row of categoryResult as any[]) {
    byCategory[row.category] = Number(row.cnt);
  }

  // Monthly trend (last 12 months)
  const monthlyResult = await db.execute(
    sql`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM wb_case
        WHERE org_id = ${ctx.orgId}
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month`,
  );
  const byMonth = (monthlyResult as any[]).map((r: any) => ({
    month: r.month,
    count: Number(r.cnt),
  }));

  // Resolution distribution
  const resolutionResult = await db.execute(
    sql`SELECT resolution_category, COUNT(*) as cnt
        FROM wb_case
        WHERE org_id = ${ctx.orgId} AND resolution_category IS NOT NULL
        GROUP BY resolution_category`,
  );
  const byResolution: Record<string, number> = {};
  for (const row of resolutionResult as any[]) {
    byResolution[row.resolution_category] = Number(row.cnt);
  }

  // Status distribution
  const statusResult = await db.execute(
    sql`SELECT status, COUNT(*) as cnt
        FROM wb_case WHERE org_id = ${ctx.orgId}
        GROUP BY status`,
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusResult as any[]) {
    byStatus[row.status] = Number(row.cnt);
  }

  return Response.json({
    data: {
      totalYtd: ytdResult.total,
      totalPreviousYear: prevYearResult.total,
      avgResolutionDays,
      sla7dCompliance,
      sla3mCompliance,
      byCategory,
      byMonth,
      byResolution,
      byStatus,
    },
  });
}
