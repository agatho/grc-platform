import {
  db,
  process,
  processVersion,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { transitionProcessStatusSchema } from "@grc/shared";
import {
  validateStatusTransition,
  TRANSITIONS_REQUIRING_COMMENT,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import type { ProcessStatus } from "@grc/shared";

// PUT /api/v1/processes/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = transitionProcessStatusSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch existing process
  const [existing] = await db
    .select({
      id: process.id,
      status: process.status,
      processOwnerId: process.processOwnerId,
      reviewerId: process.reviewerId,
      name: process.name,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const currentStatus = existing.status as ProcessStatus;
  const targetStatus = body.data.status;

  // Get user role for this org
  const [userRole] = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  const role = userRole?.role ?? "viewer";
  const isReviewer = existing.reviewerId === ctx.userId;

  // Validate transition
  const validation = validateStatusTransition(
    currentStatus,
    targetStatus,
    role,
    isReviewer,
  );

  if (!validation.valid) {
    return Response.json(
      { error: validation.error },
      { status: 403 },
    );
  }

  // Check comment requirement
  const transitionKey = `${currentStatus}->${targetStatus}`;
  if (
    TRANSITIONS_REQUIRING_COMMENT.includes(transitionKey) &&
    !body.data.comment
  ) {
    return Response.json(
      { error: `Comment is required for transition ${transitionKey}` },
      { status: 422 },
    );
  }

  // Pre-condition: must have at least 1 version to submit for review
  if (targetStatus === "in_review") {
    const versions = await db
      .select({ id: processVersion.id })
      .from(processVersion)
      .where(eq(processVersion.processId, id))
      .limit(1);

    if (versions.length === 0) {
      return Response.json(
        { error: "Process must have at least one version before submitting for review" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateData: Record<string, unknown> = {
      status: targetStatus,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    // Set publishedAt when publishing
    if (targetStatus === "published") {
      updateData.publishedAt = new Date();
    }

    const [row] = await tx
      .update(process)
      .set(updateData)
      .where(
        and(
          eq(process.id, id),
          eq(process.orgId, ctx.orgId),
        ),
      )
      .returning();

    // Send notifications based on transition type
    if (targetStatus === "in_review" && existing.reviewerId) {
      await tx.insert(notification).values({
        userId: existing.reviewerId,
        orgId: ctx.orgId,
        type: "approval_request",
        entityType: "process",
        entityId: id,
        title: `Process review requested: ${existing.name}`,
        message: body.data.comment ?? null,
        channel: "both",
        templateKey: "process_review_requested",
        templateData: {
          processId: id,
          processName: existing.name,
          requestedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    if (
      (targetStatus === "approved" || targetStatus === "draft") &&
      existing.processOwnerId
    ) {
      const notifType = targetStatus === "approved" ? "status_change" : "status_change";
      const title =
        targetStatus === "approved"
          ? `Process approved: ${existing.name}`
          : `Process returned to draft: ${existing.name}`;

      await tx.insert(notification).values({
        userId: existing.processOwnerId,
        orgId: ctx.orgId,
        type: notifType,
        entityType: "process",
        entityId: id,
        title,
        message: body.data.comment ?? null,
        channel: "both",
        templateKey:
          targetStatus === "approved"
            ? "process_approved"
            : "process_rejected",
        templateData: {
          processId: id,
          processName: existing.name,
          reviewedBy: ctx.userId,
          comment: body.data.comment,
        },
        createdBy: ctx.userId,
      });
    }

    return row;
  });

  return Response.json({ data: updated });
}
