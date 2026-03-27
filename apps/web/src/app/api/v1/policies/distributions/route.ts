import {
  db,
  policyDistribution,
  document,
} from "@grc/db";
import { createDistributionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  count,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/policies/distributions — Create distribution (draft)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDistributionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate document exists in org
  const [doc] = await db
    .select({
      id: document.id,
      currentVersion: document.currentVersion,
      title: document.title,
    })
    .from(document)
    .where(
      and(
        eq(document.id, body.data.documentId),
        eq(document.orgId, ctx.orgId),
      ),
    );

  if (!doc) {
    return Response.json(
      { error: "Document not found in this organization" },
      { status: 404 },
    );
  }

  // Validate quiz questions if quiz is required
  if (body.data.requiresQuiz) {
    if (!body.data.quizQuestions || body.data.quizQuestions.length === 0) {
      return Response.json(
        { error: "Quiz questions are required when quiz is enabled" },
        { status: 422 },
      );
    }
    // Validate correctIndex is within bounds
    for (const q of body.data.quizQuestions) {
      if (q.correctIndex >= q.options.length) {
        return Response.json(
          { error: `correctIndex ${q.correctIndex} is out of bounds for question "${q.question}"` },
          { status: 422 },
        );
      }
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(policyDistribution)
      .values({
        orgId: ctx.orgId,
        documentId: body.data.documentId,
        documentVersion: doc.currentVersion,
        title: body.data.title,
        targetScope: body.data.targetScope,
        deadline: new Date(body.data.deadline),
        isMandatory: body.data.isMandatory,
        requiresQuiz: body.data.requiresQuiz,
        quizPassThreshold: body.data.quizPassThreshold,
        quizQuestions: body.data.quizQuestions ?? [],
        reminderDaysBefore: body.data.reminderDaysBefore ?? [7, 3, 1],
        status: "draft",
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/policies/distributions — List all distributions
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const statusFilter = searchParams.get("status");

  // Base query for distributions with stats
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
      pd.status,
      pd.distributed_at as "distributedAt",
      pd.distributed_by as "distributedBy",
      pd.created_at as "createdAt",
      pd.updated_at as "updatedAt",
      d.title as "documentTitle",
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
    WHERE pd.org_id = ${ctx.orgId}
    ${statusFilter ? sql`AND pd.status = ${statusFilter}` : sql``}
    ORDER BY pd.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.orgId, ctx.orgId),
        statusFilter ? eq(policyDistribution.status, statusFilter) : undefined,
      ),
    );

  return paginatedResponse(rows as unknown as Record<string, unknown>[], total, page, limit);
}
