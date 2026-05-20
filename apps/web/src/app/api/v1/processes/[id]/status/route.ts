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
import { evaluateTransitionGates } from "@/lib/process-gates";

// PUT /api/v1/processes/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "auditor");
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
    return Response.json({ error: validation.error }, { status: 403 });
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

  // BPM Overhaul Phase 3: structured gate-checks via evaluateTransitionGates.
  // Replaces the ad-hoc version pre-condition; the gate library now owns it.
  if (["in_review", "approved", "published"].includes(targetStatus)) {
    const blockers = await db.transaction(async (tx) =>
      evaluateTransitionGates({
        tx,
        processId: id,
        orgId: ctx.orgId,
        target: targetStatus as any,
      }),
    );
    const errorBlockers = blockers.filter((b) => b.severity === "error");
    if (errorBlockers.length > 0) {
      return Response.json(
        {
          error: "Transition blocked by unmet gates",
          blockers,
          targetStatus,
        },
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
      .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId)))
      .returning();

    // BPM Overhaul Phase 6 P6: auto-version on major status transitions.
    // Snapshots the current bpmn_xml of the active version into a new version
    // row so the audit trail and diff-view have a stable per-status anchor.
    if (["approved", "published", "archived"].includes(targetStatus)) {
      try {
        const [curr] = await tx
          .select({
            bpmnXml: processVersion.bpmnXml,
            diagramJson: processVersion.diagramJson,
            versionNumber: processVersion.versionNumber,
          })
          .from(processVersion)
          .where(
            and(
              eq(processVersion.processId, id),
              eq(processVersion.isCurrent, true),
            ),
          )
          .limit(1);

        if (curr) {
          await tx
            .update(processVersion)
            .set({ isCurrent: false })
            .where(
              and(
                eq(processVersion.processId, id),
                eq(processVersion.isCurrent, true),
              ),
            );

          await tx.insert(processVersion).values({
            processId: id,
            orgId: ctx.orgId,
            versionNumber: (curr.versionNumber ?? 0) + 1,
            bpmnXml: curr.bpmnXml,
            diagramJson: curr.diagramJson,
            isCurrent: true,
            changeSummary: `Auto-version on status -> ${targetStatus}`,
            createdBy: ctx.userId,
          });

          await tx
            .update(process)
            .set({ currentVersion: (curr.versionNumber ?? 0) + 1 })
            .where(eq(process.id, id));
        }
      } catch (e) {
        // Auto-versioning is best-effort; do not block the state transition.
        console.error("auto-versioning failed", e);
      }
    }

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
      const notifType =
        targetStatus === "approved" ? "status_change" : "status_change";
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
          targetStatus === "approved" ? "process_approved" : "process_rejected",
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
