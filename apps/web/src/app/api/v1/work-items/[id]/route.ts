import { db, workItem, workItemType } from "@grc/db";
import { updateWorkItemSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/work-items/:id — Work item detail with type info
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [row] = await db
    .select({
      id: workItem.id,
      orgId: workItem.orgId,
      typeKey: workItem.typeKey,
      elementId: workItem.elementId,
      name: workItem.name,
      status: workItem.status,
      responsibleId: workItem.responsibleId,
      reviewerId: workItem.reviewerId,
      dueDate: workItem.dueDate,
      completedAt: workItem.completedAt,
      completedBy: workItem.completedBy,
      grcPerspective: workItem.grcPerspective,
      createdAt: workItem.createdAt,
      updatedAt: workItem.updatedAt,
      createdBy: workItem.createdBy,
      updatedBy: workItem.updatedBy,
      deletedAt: workItem.deletedAt,
      deletedBy: workItem.deletedBy,
      // Joined type info
      displayNameDe: workItemType.displayNameDe,
      displayNameEn: workItemType.displayNameEn,
      icon: workItemType.icon,
      colorClass: workItemType.colorClass,
      primaryModule: workItemType.primaryModule,
      secondaryModules: workItemType.secondaryModules,
      hasStatusWorkflow: workItemType.hasStatusWorkflow,
      hasResponsibleUser: workItemType.hasResponsibleUser,
      hasDueDate: workItemType.hasDueDate,
      hasPriority: workItemType.hasPriority,
      hasLinkedAsset: workItemType.hasLinkedAsset,
      hasCiaEvaluation: workItemType.hasCiaEvaluation,
      elementIdPrefix: workItemType.elementIdPrefix,
    })
    .from(workItem)
    .leftJoin(workItemType, eq(workItem.typeKey, workItemType.typeKey))
    .where(
      and(
        eq(workItem.id, id),
        eq(workItem.orgId, ctx.orgId),
        isNull(workItem.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/work-items/:id — Update work item (responsible user or admin)
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
          "Forbidden: only admin or responsible user can update this work item",
      },
      { status: 403 },
    );
  }

  const body = updateWorkItemSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (body.data.name !== undefined) updateValues.name = body.data.name;
    if (body.data.status !== undefined) updateValues.status = body.data.status;
    if (body.data.responsibleId !== undefined)
      updateValues.responsibleId = body.data.responsibleId;
    if (body.data.reviewerId !== undefined)
      updateValues.reviewerId = body.data.reviewerId;
    if (body.data.dueDate !== undefined)
      updateValues.dueDate = body.data.dueDate
        ? new Date(body.data.dueDate)
        : null;
    if (body.data.grcPerspective !== undefined)
      updateValues.grcPerspective = body.data.grcPerspective;

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
