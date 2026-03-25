import {
  db,
  risk,
  riskTreatment,
  workItem,
  user,
} from "@grc/db";
import { updateRiskSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/risks/:id — Full risk detail with treatments, work_item, owner
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Fetch risk with work item and owner
  const [row] = await db
    .select({
      id: risk.id,
      orgId: risk.orgId,
      workItemId: risk.workItemId,
      elementId: workItem.elementId,
      workItemStatus: workItem.status,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      riskSource: risk.riskSource,
      status: risk.status,
      ownerId: risk.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      department: risk.department,
      inherentLikelihood: risk.inherentLikelihood,
      inherentImpact: risk.inherentImpact,
      residualLikelihood: risk.residualLikelihood,
      residualImpact: risk.residualImpact,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
      treatmentStrategy: risk.treatmentStrategy,
      treatmentRationale: risk.treatmentRationale,
      financialImpactMin: risk.financialImpactMin,
      financialImpactMax: risk.financialImpactMax,
      financialImpactExpected: risk.financialImpactExpected,
      riskAppetiteExceeded: risk.riskAppetiteExceeded,
      reviewDate: risk.reviewDate,
      createdAt: risk.createdAt,
      updatedAt: risk.updatedAt,
      createdBy: risk.createdBy,
      updatedBy: risk.updatedBy,
    })
    .from(risk)
    .leftJoin(workItem, eq(risk.workItemId, workItem.id))
    .leftJoin(user, eq(risk.ownerId, user.id))
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch treatments
  const treatments = await db
    .select()
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.riskId, id),
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
      ),
    );

  return Response.json({ data: { ...row, treatments } });
}

// PUT /api/v1/risks/:id — Update risk fields
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
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateRiskSchema.safeParse(await req.json());
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
    if (body.data.riskCategory !== undefined) updateValues.riskCategory = body.data.riskCategory;
    if (body.data.riskSource !== undefined) updateValues.riskSource = body.data.riskSource;
    if (body.data.ownerId !== undefined) updateValues.ownerId = body.data.ownerId;
    if (body.data.department !== undefined) updateValues.department = body.data.department;
    if (body.data.reviewDate !== undefined) updateValues.reviewDate = body.data.reviewDate;
    if (body.data.treatmentStrategy !== undefined)
      updateValues.treatmentStrategy = body.data.treatmentStrategy;
    if (body.data.treatmentRationale !== undefined)
      updateValues.treatmentRationale = body.data.treatmentRationale;
    if (body.data.financialImpactMin !== undefined)
      updateValues.financialImpactMin = body.data.financialImpactMin?.toString() ?? null;
    if (body.data.financialImpactMax !== undefined)
      updateValues.financialImpactMax = body.data.financialImpactMax?.toString() ?? null;
    if (body.data.financialImpactExpected !== undefined)
      updateValues.financialImpactExpected =
        body.data.financialImpactExpected?.toString() ?? null;

    const [row] = await tx
      .update(risk)
      .set(updateValues)
      .where(
        and(
          eq(risk.id, id),
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
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

// DELETE /api/v1/risks/:id — Soft delete (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(risk)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
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
      .returning({ id: risk.id, workItemId: risk.workItemId });

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
