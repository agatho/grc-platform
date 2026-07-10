import {
  db,
  document,
  documentVersion,
  documentApprovalStep,
  user,
  userOrganizationRole,
  notification,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { createDocumentApprovalStepsSchema } from "@grc/shared";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/documents/:id/approval-steps — List approval workflow steps
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [doc] = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const steps = await db
    .select({
      id: documentApprovalStep.id,
      documentId: documentApprovalStep.documentId,
      versionId: documentApprovalStep.versionId,
      stepOrder: documentApprovalStep.stepOrder,
      stepType: documentApprovalStep.stepType,
      assigneeUserId: documentApprovalStep.assigneeUserId,
      assigneeName: user.name,
      assigneeEmail: user.email,
      status: documentApprovalStep.status,
      decision: documentApprovalStep.decision,
      comment: documentApprovalStep.comment,
      decidedAt: documentApprovalStep.decidedAt,
      createdAt: documentApprovalStep.createdAt,
      updatedAt: documentApprovalStep.updatedAt,
    })
    .from(documentApprovalStep)
    .leftJoin(user, eq(documentApprovalStep.assigneeUserId, user.id))
    .where(
      and(
        eq(documentApprovalStep.documentId, id),
        eq(documentApprovalStep.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(documentApprovalStep.stepOrder));

  return Response.json({ data: steps });
}

// POST /api/v1/documents/:id/approval-steps — Define the approval
// workflow for the current version. Replaces any existing steps
// (a new review cycle resets the workflow).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const body = createDocumentApprovalStepsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Unique step orders
  const orders = body.data.steps.map((s) => s.stepOrder);
  if (new Set(orders).size !== orders.length) {
    return Response.json(
      { error: "stepOrder values must be unique" },
      { status: 422 },
    );
  }

  // All assignees must belong to this org
  const assigneeIds = [...new Set(body.data.steps.map((s) => s.assigneeUserId))];
  const memberRows = await db
    .select({ userId: userOrganizationRole.userId })
    .from(userOrganizationRole)
    .where(
      and(
        inArray(userOrganizationRole.userId, assigneeIds),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );
  const memberIds = new Set(memberRows.map((r) => r.userId));
  const missing = assigneeIds.filter((a) => !memberIds.has(a));
  if (missing.length > 0) {
    return Response.json(
      { error: "Assignee not found in this organization", details: missing },
      { status: 422 },
    );
  }

  // Snapshot: bind steps to the current version
  const [currentVersion] = await db
    .select({ id: documentVersion.id })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
        eq(documentVersion.isCurrent, true),
      ),
    );

  const created = await withAuditContext(ctx, async (tx) => {
    // A new workflow definition replaces the previous cycle
    await tx
      .delete(documentApprovalStep)
      .where(
        and(
          eq(documentApprovalStep.documentId, id),
          eq(documentApprovalStep.orgId, ctx.orgId),
        ),
      );

    const rows = await tx
      .insert(documentApprovalStep)
      .values(
        body.data.steps.map((step) => ({
          orgId: ctx.orgId,
          documentId: id,
          versionId: currentVersion?.id ?? null,
          stepOrder: step.stepOrder,
          stepType: step.stepType,
          assigneeUserId: step.assigneeUserId,
          status: "pending" as const,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      )
      .returning();

    // Notify assignees
    for (const row of rows) {
      if (row.assigneeUserId === ctx.userId) continue;
      await tx.insert(notification).values({
        userId: row.assigneeUserId,
        orgId: ctx.orgId,
        type: "approval_request",
        entityType: "document",
        entityId: id,
        title: `Document ${row.stepType} step assigned: ${doc.title}`,
        message: `You are assigned as step ${row.stepOrder} (${row.stepType}) for document '${doc.title}'.`,
        channel: "both",
        templateKey: "document_approval_step_assigned",
        templateData: {
          documentId: id,
          documentTitle: doc.title,
          stepOrder: row.stepOrder,
          stepType: row.stepType,
        },
        createdBy: ctx.userId,
      });
    }

    return rows;
  });

  return Response.json({ data: created }, { status: 201 });
}
