import {
  db,
  control,
  workItem,
  user,
  riskControl,
} from "@grc/db";
import { updateControlSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/controls/:id — Full control detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: control.id,
      orgId: control.orgId,
      workItemId: control.workItemId,
      elementId: workItem.elementId,
      workItemStatus: workItem.status,
      title: control.title,
      description: control.description,
      controlType: control.controlType,
      frequency: control.frequency,
      automationLevel: control.automationLevel,
      status: control.status,
      assertions: control.assertions,
      ownerId: control.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      department: control.department,
      objective: control.objective,
      testInstructions: control.testInstructions,
      reviewDate: control.reviewDate,
      createdAt: control.createdAt,
      updatedAt: control.updatedAt,
      createdBy: control.createdBy,
      updatedBy: control.updatedBy,
    })
    .from(control)
    .leftJoin(workItem, eq(control.workItemId, workItem.id))
    .leftJoin(user, eq(control.ownerId, user.id))
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch linked risks
  const riskLinks = await db
    .select()
    .from(riskControl)
    .where(
      and(
        eq(riskControl.controlId, id),
        eq(riskControl.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: { ...row, riskLinks } });
}

// PUT /api/v1/controls/:id — Update control fields
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

  const body = updateControlSchema.safeParse(await req.json());
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

    if (body.data.title !== undefined) updateValues.title = body.data.title;
    if (body.data.description !== undefined) updateValues.description = body.data.description;
    if (body.data.controlType !== undefined) updateValues.controlType = body.data.controlType;
    if (body.data.frequency !== undefined) updateValues.frequency = body.data.frequency;
    if (body.data.automationLevel !== undefined) updateValues.automationLevel = body.data.automationLevel;
    if (body.data.assertions !== undefined) updateValues.assertions = body.data.assertions;
    if (body.data.ownerId !== undefined) updateValues.ownerId = body.data.ownerId;
    if (body.data.department !== undefined) updateValues.department = body.data.department;
    if (body.data.objective !== undefined) updateValues.objective = body.data.objective;
    if (body.data.testInstructions !== undefined) updateValues.testInstructions = body.data.testInstructions;
    if (body.data.reviewDate !== undefined) updateValues.reviewDate = body.data.reviewDate;

    const [row] = await tx
      .update(control)
      .set(updateValues)
      .where(
        and(
          eq(control.id, id),
          eq(control.orgId, ctx.orgId),
          isNull(control.deletedAt),
        ),
      )
      .returning();

    // Sync work item name if title changed
    if (body.data.title !== undefined && existing.workItemId) {
      await tx
        .update(workItem)
        .set({
          name: body.data.title,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(workItem.id, existing.workItemId));
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/controls/:id — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(control)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
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
      .returning({ id: control.id, workItemId: control.workItemId });

    // Soft delete the associated work item
    if (row?.workItemId) {
      await tx
        .update(workItem)
        .set({
          deletedAt: new Date(),
          deletedBy: ctx.userId,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(workItem.id, row.workItemId));
    }

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
