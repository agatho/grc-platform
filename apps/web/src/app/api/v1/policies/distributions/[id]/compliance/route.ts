import {
  db,
  policyDistribution,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/policies/distributions/:id/compliance — Compliance rate + user list
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { page, limit, offset, searchParams } = paginate(req);
  const statusFilter = searchParams.get("status");

  // Verify distribution belongs to org
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

  // Get acknowledgments with user details
  const rows = await db.execute(sql`
    SELECT
      pa.id,
      pa.user_id as "userId",
      pa.status,
      pa.acknowledged_at as "acknowledgedAt",
      pa.signature_hash as "signatureHash",
      pa.quiz_score as "quizScore",
      pa.quiz_passed as "quizPassed",
      pa.read_duration_seconds as "readDurationSeconds",
      pa.reminders_sent as "remindersSent",
      u.name as "userName",
      u.email as "userEmail",
      u.department
    FROM policy_acknowledgment pa
    INNER JOIN "user" u ON u.id = pa.user_id
    WHERE pa.distribution_id = ${id}
      AND pa.org_id = ${ctx.orgId}
      ${statusFilter ? sql`AND pa.status = ${statusFilter}` : sql``}
    ORDER BY
      CASE pa.status
        WHEN 'overdue' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'failed_quiz' THEN 3
        WHEN 'acknowledged' THEN 4
      END,
      pa.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Get total count
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int as total
    FROM policy_acknowledgment pa
    WHERE pa.distribution_id = ${id}
      AND pa.org_id = ${ctx.orgId}
      ${statusFilter ? sql`AND pa.status = ${statusFilter}` : sql``}
  `);
  const total = (countResult[0] as { total: number }).total;

  // Get summary stats
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'acknowledged')::int as acknowledged,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'overdue')::int as overdue,
      COUNT(*) FILTER (WHERE status = 'failed_quiz')::int as "failedQuiz",
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'acknowledged')::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END as "complianceRate"
    FROM policy_acknowledgment
    WHERE distribution_id = ${id} AND org_id = ${ctx.orgId}
  `);

  return Response.json({
    data: rows,
    stats: statsResult[0],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
