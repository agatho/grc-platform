import { db, playbookActivation, task, incidentTimelineEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/isms/incidents/[id]/playbook/abort — Abort active playbook
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  const [activation] = await db
    .select()
    .from(playbookActivation)
    .where(
      and(
        eq(playbookActivation.incidentId, incidentId),
        eq(playbookActivation.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!activation) {
    return Response.json(
      { error: "No playbook activation found for this incident" },
      { status: 404 },
    );
  }

  if (activation.status !== "active") {
    return Response.json(
      { error: `Cannot abort: playbook status is "${activation.status}"` },
      { status: 400 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    // Cancel all remaining open/in-progress tasks
    await tx
      .update(task)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(task.orgId, ctx.orgId),
          eq(task.sourceEntityType, "playbook_activation"),
          eq(task.sourceEntityId, activation.id),
          sql`${task.status} IN ('open', 'in_progress')`,
          isNull(task.deletedAt),
        ),
      );

    // Mark activation as aborted
    await tx
      .update(playbookActivation)
      .set({
        status: "aborted",
        completedAt: new Date(),
      })
      .where(eq(playbookActivation.id, activation.id));

    // Add timeline entry
    await tx.insert(incidentTimelineEntry).values({
      incidentId,
      orgId: ctx.orgId,
      actionType: "playbook_aborted",
      description: "Playbook execution aborted. All remaining tasks cancelled.",
      addedBy: ctx.userId,
    });
  });

  return Response.json({ data: { success: true, status: "aborted" } });
}
