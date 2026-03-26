import {
  db,
  finding,
  workItem,
  user,
  evidence,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updateFindingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  severity: z.enum(["observation", "recommendation", "improvement_requirement", "insignificant_nonconformity", "significant_nonconformity"]).optional(),
  source: z.enum(["control_test", "audit", "incident", "self_assessment", "external"]).optional(),
  controlId: z.string().uuid().nullable().optional(),
  controlTestId: z.string().uuid().nullable().optional(),
  riskId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.string().nullable().optional(),
});

// GET /api/v1/findings/:id — Finding detail with evidence
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
      id: finding.id,
      orgId: finding.orgId,
      workItemId: finding.workItemId,
      elementId: workItem.elementId,
      workItemStatus: workItem.status,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: finding.status,
      source: finding.source,
      controlId: finding.controlId,
      controlTestId: finding.controlTestId,
      riskId: finding.riskId,
      taskId: finding.taskId,
      ownerId: finding.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      remediationPlan: finding.remediationPlan,
      remediationDueDate: finding.remediationDueDate,
      remediatedAt: finding.remediatedAt,
      verifiedAt: finding.verifiedAt,
      verifiedBy: finding.verifiedBy,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
      createdBy: finding.createdBy,
      updatedBy: finding.updatedBy,
    })
    .from(finding)
    .leftJoin(workItem, eq(finding.workItemId, workItem.id))
    .leftJoin(user, eq(finding.ownerId, user.id))
    .where(
      and(
        eq(finding.id, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch evidence
  const evidenceItems = await db
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.entityType, "finding"),
        eq(evidence.entityId, id),
        eq(evidence.orgId, ctx.orgId),
        isNull(evidence.deletedAt),
      ),
    );

  return Response.json({ data: { ...row, evidence: evidenceItems } });
}

// PUT /api/v1/findings/:id — Update finding
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

  const body = updateFindingSchema.safeParse(await req.json());
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
    if (body.data.severity !== undefined) updateValues.severity = body.data.severity;
    if (body.data.source !== undefined) updateValues.source = body.data.source;
    if (body.data.controlId !== undefined) updateValues.controlId = body.data.controlId;
    if (body.data.controlTestId !== undefined) updateValues.controlTestId = body.data.controlTestId;
    if (body.data.riskId !== undefined) updateValues.riskId = body.data.riskId;
    if (body.data.ownerId !== undefined) updateValues.ownerId = body.data.ownerId;
    if (body.data.remediationPlan !== undefined) updateValues.remediationPlan = body.data.remediationPlan;
    if (body.data.remediationDueDate !== undefined) updateValues.remediationDueDate = body.data.remediationDueDate;

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

// DELETE /api/v1/findings/:id — Soft delete
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
      .update(finding)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(finding.id, id),
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
        ),
      )
      .returning({ id: finding.id, workItemId: finding.workItemId });

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
