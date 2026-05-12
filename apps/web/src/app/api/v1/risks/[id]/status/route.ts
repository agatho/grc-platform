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
import { log } from "@/lib/logger";

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

  // Same-state PUTs are a no-op. Returning 200 with the existing row keeps
  // PATCH idempotent and avoids the audit-log noise + notification fan-out
  // that would otherwise fire for "the status changed from X to X" — and
  // sidesteps the QA-016 crash that hit when the UPDATE / notify path ran
  // on a row that already matched.
  if (currentStatus === targetStatus) {
    return Response.json({ data: existing });
  }

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

  const logger = log.withContext({
    route: "PUT /api/v1/risks/[id]/status",
    userId: ctx.userId,
    orgId: ctx.orgId,
    riskId: id,
    from: currentStatus,
    to: targetStatus,
  });

  // #WAVE3-01 (2026-05-12): the transition was crashing with `code:internal`
  // on assessed→identified. Root cause: the bulk notification fan-out
  // (one row per risk_manager) was happening INSIDE the same transaction
  // as the status UPDATE. If any single notification insert hit a stale
  // FK (user soft-deleted but role roster not pruned) or the audit-log
  // trigger choked on a missing session var, the entire transition rolled
  // back — leaving the risk stuck in its old state.
  //
  // Fix: split the work into two phases.
  //   Phase 1 — required: status UPDATE + work-item sync, in one tx.
  //   Phase 2 — best-effort: notifications, each in its own tx.
  //             A bad notify warns and continues; the transition still
  //             succeeds for the user.
  let updated;
  try {
    updated = await withAuditContext(ctx, async (tx) => {
      const [row] = await tx
        .update(risk)
        .set({
          status: targetStatus,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(risk.id, id),
            eq(risk.orgId, ctx.orgId),
            isNull(risk.deletedAt),
          ),
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

      return row;
    });
  } catch (err) {
    // The status-update path failed. Surface the real error so operators
    // can identify the failing constraint without a deploy log dive.
    const errObj = err as {
      code?: string;
      detail?: string;
      message?: string;
      stack?: string;
    };
    logger.error("status transition (phase 1) failed", {
      pgCode: errObj.code,
      pgDetail: errObj.detail,
      message: errObj.message,
      stack: errObj.stack?.split("\n").slice(0, 5).join(" | "),
    });

    const constraintCodes = new Set(["23503", "23502", "23514", "23505"]);
    if (errObj.code && constraintCodes.has(errObj.code)) {
      return Response.json(
        {
          error: "Failed to apply status transition — database constraint",
          code: errObj.code,
          detail: errObj.detail ?? errObj.message ?? null,
          from: currentStatus,
          to: targetStatus,
        },
        { status: 422 },
      );
    }

    return Response.json(
      {
        error: "Failed to apply status transition",
        code: errObj.code ?? "internal",
        message: errObj.message ?? null,
        from: currentStatus,
        to: targetStatus,
      },
      { status: 500 },
    );
  }

  // Phase 2 — fan out notifications best-effort. Each insert is wrapped
  // independently so one stale FK / missing user does not roll back the
  // entire batch (and absolutely does not roll back the status change
  // already committed in phase 1).
  const notifyOne = async (userId: string) => {
    try {
      await withAuditContext(ctx, async (tx) => {
        await tx.insert(notification).values({
          userId,
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
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      logger.warn("notification dispatch failed (continuing)", {
        recipientId: userId,
        pgCode: e.code,
        message: e.message,
      });
    }
  };

  if (existing.ownerId && existing.ownerId !== ctx.userId) {
    await notifyOne(existing.ownerId);
  }

  try {
    const riskManagers = await db
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
      await notifyOne(rm.userId);
    }
  } catch (err) {
    const e = err as { message?: string };
    logger.warn("risk_manager roster lookup failed (continuing)", {
      message: e.message,
    });
  }

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
