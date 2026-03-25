import { db, workItem } from "@grc/db";
import { workItemStatusTransitionSchema } from "@grc/shared";
import type { WorkItemStatus } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// Valid status transitions map
const VALID_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  draft: ["in_evaluation", "active", "cancelled"],
  in_evaluation: ["in_review", "active", "cancelled"],
  in_review: ["in_approval", "active", "cancelled"],
  in_approval: ["management_approved", "active", "cancelled"],
  management_approved: ["active", "cancelled"],
  active: ["in_treatment", "completed", "obsolete"],
  in_treatment: ["completed", "cancelled"],
  completed: [], // terminal
  obsolete: [], // terminal
  cancelled: [], // terminal
};

// Terminal states that set completedAt/completedBy
const TERMINAL_STATES: WorkItemStatus[] = ["completed", "obsolete", "cancelled"];

// PUT /api/v1/work-items/:id/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch existing work item
  const [existing] = await db
    .select()
    .from(workItem)
    .where(
      and(
        eq(workItem.id, id),
        eq(workItem.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check permission: responsible user or admin
  const isResponsible = existing.responsibleId === ctx.userId;
  const adminCheck = await withAuth("admin");
  const isAdmin = !(adminCheck instanceof Response);

  if (!isAdmin && !isResponsible) {
    return Response.json(
      {
        error:
          "Forbidden: only admin or responsible user can change work item status",
      },
      { status: 403 },
    );
  }

  const body = workItemStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const newStatus = body.data.status;
  const currentStatus = existing.status as WorkItemStatus;

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions || allowedTransitions.length === 0) {
    return Response.json(
      {
        error: `Cannot transition from '${currentStatus}': status is terminal`,
      },
      { status: 400 },
    );
  }

  if (!allowedTransitions.includes(newStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedTransitions.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      status: newStatus,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    // Set completedAt/completedBy for terminal states
    if (TERMINAL_STATES.includes(newStatus)) {
      updateValues.completedAt = new Date();
      updateValues.completedBy = ctx.userId;
    }

    const [row] = await tx
      .update(workItem)
      .set(updateValues)
      .where(
        and(
          eq(workItem.id, id),
          eq(workItem.orgId, ctx.orgId),
          isNull(workItem.deletedAt),
        ),
      )
      .returning();

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
