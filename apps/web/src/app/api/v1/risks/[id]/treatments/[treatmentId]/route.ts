import {
  db,
  risk,
  riskTreatment,
  workItem,
  userOrganizationRole,
} from "@grc/db";
import { updateRiskTreatmentSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/risks/:id/treatments/:treatmentId — Update treatment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; treatmentId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, treatmentId } = await params;

  // Verify risk exists in org
  const [existingRisk] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existingRisk) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Fetch treatment
  const [existing] = await db
    .select()
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.id, treatmentId),
        eq(riskTreatment.riskId, id),
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Treatment not found" }, { status: 404 });
  }

  // Allow responsible user to update as well
  const isResponsible = existing.responsibleId === ctx.userId;
  if (!isResponsible) {
    // Already checked admin/risk_manager via withAuth above
  }

  const body = updateRiskTreatmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate responsible if changed
  if (body.data.responsibleId) {
    const [respRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.responsibleId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!respRole) {
      return Response.json(
        { error: "Responsible user not found in this organization" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (body.data.description !== undefined) updateValues.description = body.data.description;
    if (body.data.responsibleId !== undefined) updateValues.responsibleId = body.data.responsibleId;
    if (body.data.expectedRiskReduction !== undefined)
      updateValues.expectedRiskReduction = body.data.expectedRiskReduction?.toString();
    if (body.data.costEstimate !== undefined)
      updateValues.costEstimate = body.data.costEstimate?.toString();
    if (body.data.status !== undefined) updateValues.status = body.data.status;
    if (body.data.dueDate !== undefined) updateValues.dueDate = body.data.dueDate;

    const [row] = await tx
      .update(riskTreatment)
      .set(updateValues)
      .where(
        and(
          eq(riskTreatment.id, treatmentId),
          eq(riskTreatment.riskId, id),
          eq(riskTreatment.orgId, ctx.orgId),
          isNull(riskTreatment.deletedAt),
        ),
      )
      .returning();

    // Sync work item if description or responsible changed
    if (existing.workItemId) {
      const wiUpdate: Record<string, unknown> = {
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      };
      if (body.data.description !== undefined) {
        wiUpdate.name = `Treatment: ${body.data.description.substring(0, 100)}`;
      }
      if (body.data.responsibleId !== undefined) {
        wiUpdate.responsibleId = body.data.responsibleId;
      }
      await tx
        .update(workItem)
        .set(wiUpdate)
        .where(eq(workItem.id, existing.workItemId));
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Treatment not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/risks/:id/treatments/:treatmentId — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; treatmentId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, treatmentId } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(riskTreatment)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(riskTreatment.id, treatmentId),
          eq(riskTreatment.riskId, id),
          eq(riskTreatment.orgId, ctx.orgId),
          isNull(riskTreatment.deletedAt),
        ),
      )
      .returning({ id: riskTreatment.id, workItemId: riskTreatment.workItemId });

    // Soft delete associated work item
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
    return Response.json({ error: "Treatment not found" }, { status: 404 });
  }

  return Response.json({ data: { id: treatmentId, deleted: true } });
}
