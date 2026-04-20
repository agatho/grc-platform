import {
  db,
  control,
  workItem,
  notification,
  userOrganizationRole,
} from "@grc/db";
import {
  controlStatusTransitionSchema,
  VALID_CONTROL_TRANSITIONS,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// Map control status to work item status
const CONTROL_TO_WORK_ITEM_STATUS: Record<string, string> = {
  designed: "draft",
  implemented: "active",
  effective: "completed",
  ineffective: "in_treatment",
  retired: "obsolete",
};

// PUT /api/v1/controls/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(control)
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = controlStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const targetStatus = body.data.status;
  const currentStatus = existing.status;

  // Validate transition
  const allowed = VALID_CONTROL_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${(allowed ?? []).join(", ")}`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(control)
      .set({
        status: targetStatus,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(control.id, id),
          eq(control.orgId, ctx.orgId),
          isNull(control.deletedAt),
        ),
      )
      .returning();

    // Sync work item status
    if (existing.workItemId) {
      const wiStatus = CONTROL_TO_WORK_ITEM_STATUS[targetStatus];
      if (wiStatus) {
        await tx
          .update(workItem)
          .set({
            status: wiStatus as typeof workItem.$inferSelect.status,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
            ...(targetStatus === "retired"
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
        entityType: "control",
        entityId: id,
        title: `Control status changed: ${existing.title}`,
        message: `Status changed from '${currentStatus}' to '${targetStatus}'.`,
        channel: "both",
        templateKey: "control_status_changed",
        templateData: {
          controlId: id,
          controlTitle: existing.title,
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
