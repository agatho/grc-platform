import {
  db,
  policyDistribution,
} from "@grc/db";
import { updateDistributionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/policies/distributions/:id — Distribution detail + stats
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db.execute(sql`
    SELECT
      pd.id,
      pd.org_id as "orgId",
      pd.document_id as "documentId",
      pd.document_version as "documentVersion",
      pd.title,
      pd.target_scope as "targetScope",
      pd.deadline,
      pd.is_mandatory as "isMandatory",
      pd.requires_quiz as "requiresQuiz",
      pd.quiz_pass_threshold as "quizPassThreshold",
      pd.quiz_questions as "quizQuestions",
      pd.reminder_days_before as "reminderDaysBefore",
      pd.status,
      pd.distributed_at as "distributedAt",
      pd.distributed_by as "distributedBy",
      pd.created_by as "createdBy",
      pd.created_at as "createdAt",
      pd.updated_at as "updatedAt",
      d.title as "documentTitle",
      d.content as "documentContent",
      COALESCE(stats.total, 0)::int as "totalRecipients",
      COALESCE(stats.acknowledged, 0)::int as "acknowledged",
      COALESCE(stats.pending, 0)::int as "pending",
      COALESCE(stats.overdue, 0)::int as "overdue",
      COALESCE(stats.failed_quiz, 0)::int as "failedQuiz",
      CASE WHEN COALESCE(stats.total, 0) > 0
        THEN ROUND((COALESCE(stats.acknowledged, 0)::numeric / stats.total) * 100, 1)
        ELSE 0
      END as "complianceRate"
    FROM policy_distribution pd
    LEFT JOIN document d ON d.id = pd.document_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE pa.status = 'acknowledged')::int as acknowledged,
        COUNT(*) FILTER (WHERE pa.status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE pa.status = 'overdue')::int as overdue,
        COUNT(*) FILTER (WHERE pa.status = 'failed_quiz')::int as failed_quiz
      FROM policy_acknowledgment pa
      WHERE pa.distribution_id = pd.id
    ) stats ON true
    WHERE pd.id = ${id} AND pd.org_id = ${ctx.orgId}
  `);

  if (!rows.length) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PATCH /api/v1/policies/distributions/:id — Update distribution (draft only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateDistributionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check distribution exists and is draft
  const [existing] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return Response.json(
      { error: "Only draft distributions can be updated" },
      { status: 409 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data.title !== undefined) values.title = body.data.title;
    if (body.data.targetScope !== undefined) values.targetScope = body.data.targetScope;
    if (body.data.deadline !== undefined) values.deadline = new Date(body.data.deadline);
    if (body.data.isMandatory !== undefined) values.isMandatory = body.data.isMandatory;
    if (body.data.requiresQuiz !== undefined) values.requiresQuiz = body.data.requiresQuiz;
    if (body.data.quizPassThreshold !== undefined) values.quizPassThreshold = body.data.quizPassThreshold;
    if (body.data.quizQuestions !== undefined) values.quizQuestions = body.data.quizQuestions;
    if (body.data.reminderDaysBefore !== undefined) values.reminderDaysBefore = body.data.reminderDaysBefore;

    const [row] = await tx
      .update(policyDistribution)
      .set(values)
      .where(
        and(
          eq(policyDistribution.id, id),
          eq(policyDistribution.orgId, ctx.orgId),
        ),
      )
      .returning();

    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/policies/distributions/:id — Delete distribution (draft only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return Response.json(
      { error: "Only draft distributions can be deleted" },
      { status: 409 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(policyDistribution)
      .where(
        and(
          eq(policyDistribution.id, id),
          eq(policyDistribution.orgId, ctx.orgId),
        ),
      );
  });

  return Response.json({ data: { deleted: true } });
}
