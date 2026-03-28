import { db, riskTreatment } from "@grc/db";
import { managementSummaryRequestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql, count } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/erm/management-summary — Generate Management Summary PDF data
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = managementSummaryRequestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { period_start, period_end, language } = body.data;

  // Total risks
  const totalResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL`,
  );

  // New risks in period
  const newResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
          AND created_at >= ${period_start}::timestamptz
          AND created_at <= ${period_end}::timestamptz`,
  );

  // Category distribution
  const categoryResult = await db.execute(
    sql`SELECT risk_category as category, COUNT(*) as count
        FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        GROUP BY risk_category`,
  );

  // Risk value distribution
  const valueResult = await db.execute(
    sql`SELECT
          CASE
            WHEN risk_value >= 81 THEN 'critical'
            WHEN risk_value >= 61 THEN 'high'
            WHEN risk_value >= 41 THEN 'medium'
            WHEN risk_value >= 21 THEN 'low'
            WHEN risk_value >= 1 THEN 'minimal'
            ELSE 'not_evaluated'
          END as range,
          COUNT(*) as count
        FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        GROUP BY 1 ORDER BY 1`,
  );

  // Top 10 risks by risk value
  const topRisksResult = await db.execute(
    sql`SELECT id, title, risk_category, risk_score_inherent, risk_score_residual, risk_value
        FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        ORDER BY risk_value DESC NULLS LAST
        LIMIT 10`,
  );

  // Treatment summary
  const treatmentResult = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM risk_treatment
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        GROUP BY status`,
  );

  return Response.json({
    data: {
      language,
      period: { start: period_start, end: period_end },
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.session.user.name,
      summary: {
        totalRisks: Number(totalResult[0]?.count ?? 0),
        newRisksInPeriod: Number(newResult[0]?.count ?? 0),
      },
      categoryDistribution: categoryResult,
      valueDistribution: valueResult,
      topRisks: topRisksResult,
      treatmentSummary: treatmentResult,
    },
  });
}
