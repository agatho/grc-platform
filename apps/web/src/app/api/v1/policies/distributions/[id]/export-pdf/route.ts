import {
  db,
  policyDistribution,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/policies/distributions/:id/export-pdf — Audit-ready PDF report (JSON for frontend rendering)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Get distribution
  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  // Get all acknowledgments with user details
  const acknowledgments = await db.execute(sql`
    SELECT
      pa.id,
      pa.user_id as "userId",
      pa.status,
      pa.acknowledged_at as "acknowledgedAt",
      pa.signature_hash as "signatureHash",
      pa.quiz_score as "quizScore",
      pa.quiz_passed as "quizPassed",
      pa.read_duration_seconds as "readDurationSeconds",
      pa.ip_address as "ipAddress",
      pa.user_agent as "userAgent",
      pa.reminders_sent as "remindersSent",
      u.name as "userName",
      u.email as "userEmail",
      u.department
    FROM policy_acknowledgment pa
    INNER JOIN "user" u ON u.id = pa.user_id
    WHERE pa.distribution_id = ${id}
      AND pa.org_id = ${ctx.orgId}
    ORDER BY pa.status, u.name
  `);

  // Get summary stats
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'acknowledged')::int as acknowledged,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'overdue')::int as overdue,
      COUNT(*) FILTER (WHERE status = 'failed_quiz')::int as "failedQuiz"
    FROM policy_acknowledgment
    WHERE distribution_id = ${id} AND org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: {
      distribution: {
        id: dist.id,
        title: dist.title,
        documentId: dist.documentId,
        documentVersion: dist.documentVersion,
        deadline: dist.deadline,
        isMandatory: dist.isMandatory,
        requiresQuiz: dist.requiresQuiz,
        status: dist.status,
        distributedAt: dist.distributedAt,
      },
      stats: statsResult[0],
      acknowledgments,
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.userId,
    },
  });
}
