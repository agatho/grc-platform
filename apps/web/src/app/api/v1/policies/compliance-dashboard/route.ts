import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/policies/compliance-dashboard — Org-wide compliance rates
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Active distributions count
  const activeDistResult = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM policy_distribution
    WHERE org_id = ${ctx.orgId} AND status = 'active'
  `);
  const activeDistributions = (activeDistResult[0] as { count: number }).count;

  // Overall compliance stats
  const overallResult = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE pa.status = 'acknowledged')::int as acknowledged,
      COUNT(*) FILTER (WHERE pa.status IN ('pending', 'overdue'))::int as "overdueCount",
      COUNT(*) FILTER (WHERE pa.status = 'failed_quiz')::int as "failedQuiz",
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE pa.status = 'acknowledged')::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END as "avgComplianceRate",
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE pa.status = 'failed_quiz')::numeric / NULLIF(COUNT(*) FILTER (WHERE pa.quiz_score IS NOT NULL), 0)) * 100, 1)
        ELSE 0
      END as "quizFailureRate"
    FROM policy_acknowledgment pa
    INNER JOIN policy_distribution pd ON pd.id = pa.distribution_id
    WHERE pa.org_id = ${ctx.orgId} AND pd.status = 'active'
  `);
  const overall = overallResult[0] as Record<string, unknown>;

  // Per-distribution compliance
  const perDistribution = await db.execute(sql`
    SELECT
      pd.id as "distributionId",
      pd.title,
      d.title as "documentTitle",
      pd.deadline,
      COUNT(pa.id)::int as total,
      COUNT(pa.id) FILTER (WHERE pa.status = 'acknowledged')::int as acknowledged,
      COUNT(pa.id) FILTER (WHERE pa.status IN ('pending', 'overdue'))::int as overdue,
      CASE WHEN COUNT(pa.id) > 0
        THEN ROUND((COUNT(pa.id) FILTER (WHERE pa.status = 'acknowledged')::numeric / COUNT(pa.id)) * 100, 1)
        ELSE 0
      END as "complianceRate"
    FROM policy_distribution pd
    LEFT JOIN document d ON d.id = pd.document_id
    LEFT JOIN policy_acknowledgment pa ON pa.distribution_id = pd.id
    WHERE pd.org_id = ${ctx.orgId} AND pd.status = 'active'
    GROUP BY pd.id, pd.title, d.title, pd.deadline
    ORDER BY "complianceRate" ASC
  `);

  // Per-department compliance
  const perDepartment = await db.execute(sql`
    SELECT
      COALESCE(u.department, 'Unassigned') as department,
      COUNT(pa.id)::int as total,
      COUNT(pa.id) FILTER (WHERE pa.status = 'acknowledged')::int as acknowledged,
      CASE WHEN COUNT(pa.id) > 0
        THEN ROUND((COUNT(pa.id) FILTER (WHERE pa.status = 'acknowledged')::numeric / COUNT(pa.id)) * 100, 1)
        ELSE 0
      END as "complianceRate"
    FROM policy_acknowledgment pa
    INNER JOIN policy_distribution pd ON pd.id = pa.distribution_id
    INNER JOIN "user" u ON u.id = pa.user_id
    WHERE pa.org_id = ${ctx.orgId} AND pd.status = 'active'
    GROUP BY u.department
    ORDER BY "complianceRate" ASC
  `);

  // Trend: monthly compliance rates over 6 months
  const trend = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', pa.acknowledged_at) as month,
      COUNT(*)::int as acknowledged
    FROM policy_acknowledgment pa
    INNER JOIN policy_distribution pd ON pd.id = pa.distribution_id
    WHERE pa.org_id = ${ctx.orgId}
      AND pa.status = 'acknowledged'
      AND pa.acknowledged_at >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', pa.acknowledged_at)
    ORDER BY month ASC
  `);

  return Response.json({
    data: {
      activeDistributions,
      avgComplianceRate: Number(overall.avgComplianceRate ?? 0),
      overdueCount: Number(overall.overdueCount ?? 0),
      quizFailureRate: Number(overall.quizFailureRate ?? 0),
      perDistribution,
      perDepartment,
      trend,
    },
  });
}
