import {
  db,
  process,
  processVersion,
  processApprovalStep,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { transitionProcessStatusSchema } from "@grc/shared";
import {
  validateStatusTransition,
  TRANSITIONS_REQUIRING_COMMENT,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { emitEntityStatusChanged } from "@/lib/entity-events";
import type { ProcessStatus } from "@grc/shared";
import { evaluateTransitionGates } from "@/lib/process-gates";
import { promoteWorkingVersion } from "@/lib/process-working-version";

// PUT /api/v1/processes/:id/status — Status transition
// (also exported as PATCH below for client robustness — B1.3)
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
    // withReadContext sets app.current_org_id — required because the gate
    // library reads FORCE-RLS tables (process_sign_off) since B2.2.
    const blockers = await withReadContext(ctx, async (tx) =>
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
        // B2.4 Release-Cycle: if a working copy exists it is promoted to
        // the next released version on (re-)approval / publication —
        // instead of snapshotting the old released state.
        let promoted: { id: string; versionNumber: number } | null = null;
        if (targetStatus === "approved" || targetStatus === "published") {
          promoted = await promoteWorkingVersion({
            tx,
            processId: id,
            orgId: ctx.orgId,
            userId: ctx.userId,
          });
        }

        if (!promoted) {
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
            // Number past ALL rows (incl. a possible working copy) so the
            // (process_id, version_number) unique index cannot collide.
            const [maxRow] = await tx
              .select({
                max: sql<number>`COALESCE(MAX(${processVersion.versionNumber}), 0)`,
              })
              .from(processVersion)
              .where(eq(processVersion.processId, id));
            const nextNumber = Number(maxRow?.max ?? 0) + 1;

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
              versionNumber: nextNumber,
              bpmnXml: curr.bpmnXml,
              diagramJson: curr.diagramJson,
              isCurrent: true,
              versionType: "released",
              changeSummary: `Auto-version on status -> ${targetStatus}`,
              createdBy: ctx.userId,
            });

            await tx
              .update(process)
              .set({ currentVersion: nextNumber })
              .where(eq(process.id, id));
          }
        }
      } catch (e) {
        // Auto-versioning is best-effort; do not block the state transition.
        console.error("auto-versioning failed", e);
      }
    }

    // B2.3 Kenntnisnahme: on publish, pending acknowledgment steps become
    // active and every assignee is notified.
    if (targetStatus === "published") {
      try {
        const ackSteps = await tx
          .select({
            id: processApprovalStep.id,
            assigneeUserId: processApprovalStep.assigneeUserId,
          })
          .from(processApprovalStep)
          .where(
            and(
              eq(processApprovalStep.processId, id),
              eq(processApprovalStep.orgId, ctx.orgId),
              eq(processApprovalStep.stepType, "acknowledgment"),
              eq(processApprovalStep.status, "pending"),
            ),
          );

        for (const step of ackSteps) {
          await tx
            .update(processApprovalStep)
            .set({
              status: "in_progress",
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(eq(processApprovalStep.id, step.id));

          if (step.assigneeUserId) {
            await tx.insert(notification).values({
              userId: step.assigneeUserId,
              orgId: ctx.orgId,
              type: "approval_request",
              entityType: "process",
              entityId: id,
              title: `Acknowledgment requested: ${existing.name}`,
              message: body.data.comment ?? null,
              channel: "both",
              templateKey: "process_acknowledgment_requested",
              templateData: {
                processId: id,
                processName: existing.name,
                requestedBy: ctx.userId,
              },
              createdBy: ctx.userId,
            });
          }
        }
      } catch (e) {
        console.error("acknowledgment activation failed", e);
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

  // Webhook fan-out (best-effort, after commit — never fails the request)
  if (updated) {
    emitEntityStatusChanged({
      orgId: ctx.orgId,
      entityType: "process",
      entityId: id,
      userId: ctx.userId,
      oldStatus: currentStatus,
      newStatus: targetStatus,
      data: { name: existing.name },
    });
  }

  return Response.json({ data: updated });
}

// B1.3: PATCH alias — the UI historically called PATCH while only PUT was
// exported; accept both so older clients keep working.
export { PUT as PATCH };
