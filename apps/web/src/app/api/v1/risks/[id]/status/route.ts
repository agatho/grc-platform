import {
  db,
  risk,
  riskTreatment,
  workItem,
  notification,
  userOrganizationRole,
} from "@grc/db";
import {
  riskStatusTransitionSchema,
  validateRiskStatusTransition,
  type RiskStatus,
} from "@grc/shared";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// Map risk status to work item status
const RISK_TO_WORK_ITEM_STATUS: Record<string, string> = {
  identified: "draft",
  assessed: "in_evaluation",
  treated: "in_treatment",
  accepted: "management_approved",
  closed: "completed",
};

// PUT /api/v1/risks/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = riskStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const targetStatus = body.data.status;
  const currentStatus = existing.status;

  // Single source of truth: validation matrix lives in @grc/shared
  // (packages/shared/src/state-machines/risk-status.ts).
  const transition = validateRiskStatusTransition({
    from: currentStatus as RiskStatus,
    to: targetStatus,
  });
  if (!transition.ok) {
    return Response.json(
      {
        error: "Invalid status transition",
        reason: transition.reason,
        from: currentStatus,
        to: targetStatus,
      },
      { status: 422 },
    );
  }

  // Pre-condition: assessed requires likelihood + impact
  if (targetStatus === "assessed") {
    if (!existing.inherentLikelihood || !existing.inherentImpact) {
      return Response.json(
        {
          error:
            "Cannot transition to 'assessed': inherentLikelihood and inherentImpact must be set. Use the assessment endpoint first.",
        },
        { status: 422 },
      );
    }
  }

  // Pre-condition: treated requires at least 1 active treatment
  if (targetStatus === "treated") {
    const treatments = await db
      .select({ id: riskTreatment.id })
      .from(riskTreatment)
      .where(
        and(
          eq(riskTreatment.riskId, id),
          eq(riskTreatment.orgId, ctx.orgId),
          isNull(riskTreatment.deletedAt),
          inArray(riskTreatment.status, ["planned", "in_progress"]),
        ),
      )
      .limit(1);

    if (treatments.length === 0) {
      return Response.json(
        {
          error:
            "Cannot transition to 'treated': at least 1 active treatment (planned or in_progress) is required.",
        },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(risk)
      .set({
        status: targetStatus,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
      )
      .returning();

    // Sync work item status
    if (existing.workItemId) {
      const wiStatus = RISK_TO_WORK_ITEM_STATUS[targetStatus];
      if (wiStatus) {
        await tx
          .update(workItem)
          .set({
            status: wiStatus as typeof workItem.$inferSelect.status,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
            ...(targetStatus === "closed"
              ? { completedAt: new Date(), completedBy: ctx.userId }
              : {}),
          })
          .where(eq(workItem.id, existing.workItemId));
      }
    }

    // Notify owner
    if (existing.ownerId && existing.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: existing.ownerId,
        orgId: ctx.orgId,
        type: "status_change",
        entityType: "risk",
        entityId: id,
        title: `Risk status changed: ${existing.title}`,
        message: `Status changed from '${currentStatus}' to '${targetStatus}'.`,
        channel: "both",
        templateKey: "risk_status_changed",
        templateData: {
          riskId: id,
          riskTitle: existing.title,
          fromStatus: currentStatus,
          toStatus: targetStatus,
        },
        createdBy: ctx.userId,
      });
    }

    // Notify all risk_managers in org
    const riskManagers = await tx
      .select({ userId: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.orgId, ctx.orgId),
          eq(userOrganizationRole.role, "risk_manager"),
          isNull(userOrganizationRole.deletedAt),
        ),
      );

    for (const rm of riskManagers) {
      if (rm.userId === existing.ownerId || rm.userId === ctx.userId) continue;
      await tx.insert(notification).values({
        userId: rm.userId,
        orgId: ctx.orgId,
        type: "status_change",
        entityType: "risk",
        entityId: id,
        title: `Risk status changed: ${existing.title}`,
        message: `Status changed from '${currentStatus}' to '${targetStatus}'.`,
        channel: "both",
        templateKey: "risk_status_changed",
        templateData: {
          riskId: id,
          riskTitle: existing.title,
          fromStatus: currentStatus,
          toStatus: targetStatus,
        },
        createdBy: ctx.userId,
      });
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// The risk-list bulk-status-change UI dispatches `PATCH /api/v1/risks/{id}/status`
// (see apps/web/src/app/(dashboard)/risks/page.tsx). The dedicated route used
// to expose only PUT, so those bulk calls were silently 405-ing. Re-export
// the same handler under PATCH so the UI works without ceremony — semantics
// are identical (idempotent state-machine transition).
export const PATCH = PUT;

