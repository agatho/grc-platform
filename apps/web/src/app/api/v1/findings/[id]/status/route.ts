import {
  db,
  finding,
  workItem,
  notification,
} from "@grc/db";
import { findingStatusTransitionSchema, VALID_FINDING_TRANSITIONS } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// Map finding status to work item status
const FINDING_TO_WORK_ITEM_STATUS: Record<string, string> = {
  identified: "draft",
  in_remediation: "in_treatment",
  remediated: "in_review",
  verified: "in_approval",
  accepted: "management_approved",
  closed: "completed",
};

// PUT /api/v1/findings/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(finding)
    .where(
      and(
        eq(finding.id, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = findingStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const targetStatus = body.data.status;
  const currentStatus = existing.status;

  // Validate transition
  const allowed = VALID_FINDING_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${(allowed ?? []).join(", ")}`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      status: targetStatus,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    // Set timestamps for specific transitions
    if (targetStatus === "remediated") {
      updateValues.remediatedAt = new Date();
    }
    if (targetStatus === "verified") {
      updateValues.verifiedAt = new Date();
      updateValues.verifiedBy = ctx.userId;
    }

    const [row] = await tx
      .update(finding)
      .set(updateValues)
      .where(
        and(
          eq(finding.id, id),
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
        ),
      )
      .returning();

    // Sync work item status
    if (existing.workItemId) {
      const wiStatus = FINDING_TO_WORK_ITEM_STATUS[targetStatus];
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
        entityType: "finding",
        entityId: id,
        title: `Finding status changed: ${existing.title}`,
        message: `Status changed from '${currentStatus}' to '${targetStatus}'.`,
        channel: "both",
        templateKey: "finding_status_changed",
        templateData: {
          findingId: id,
          findingTitle: existing.title,
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
