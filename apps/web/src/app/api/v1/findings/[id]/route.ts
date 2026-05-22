import { db, finding, workItem, user, evidence } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateFindingSchema } from "@grc/shared";

// #WAVE19-P1-01: schema lifted to packages/shared so the canonical
// enum (with ISO-19011 values like major_nonconformity) stays in
// lock-step between POST and PUT/PATCH. Inline copy used to drift —
// Wave-18 QA hit a 422 on PUT because the inline severity enum
// hadn't been updated when the canonical one gained new values.

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
      // #WAVE16-P1-B: see /findings/route.ts — list + detail projections
      // both need auditId so the audit-finding cross-module link is
      // visible end-to-end.
      auditId: finding.auditId,
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
//
// #RBAC-AUDIT-FIX: role list aligned with POST /findings. The post-Wave-25
// RBAC audit (docs/audits/rbac-rls-audit-2026-05-22.md §asymmetric) found
// that process_owner and ciso could raise a finding (POST) but were
// blocked from editing the one they raised (PUT). That mismatch made
// the workflow unfinishable for either role.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "auditor",
    "control_owner",
    "process_owner",
    "ciso",
  );
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
    if (body.data.description !== undefined)
      updateValues.description = body.data.description;
    if (body.data.severity !== undefined)
      updateValues.severity = body.data.severity;
    if (body.data.source !== undefined) updateValues.source = body.data.source;
    if (body.data.controlId !== undefined)
      updateValues.controlId = body.data.controlId;
    if (body.data.controlTestId !== undefined)
      updateValues.controlTestId = body.data.controlTestId;
    if (body.data.riskId !== undefined) updateValues.riskId = body.data.riskId;
    // #WAVE19-P1-01: backfill the audit cross-module link via PUT
    // (or its PATCH alias). The inline schema previously omitted
    // auditId, so updates that wanted to attach a finding to an
    // audit retroactively had no path.
    if (body.data.auditId !== undefined)
      updateValues.auditId = body.data.auditId;
    if (body.data.ownerId !== undefined)
      updateValues.ownerId = body.data.ownerId;
    if (body.data.remediationPlan !== undefined)
      updateValues.remediationPlan = body.data.remediationPlan;
    if (body.data.remediationDueDate !== undefined)
      updateValues.remediationDueDate = body.data.remediationDueDate;

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

// PATCH /api/v1/findings/:id — alias for PUT.
//
// #WAVE19-P1-01: Wave-18 QA expected PATCH semantics on findings (the
// REST-y partial-update method). The route used to expose only PUT
// → 405 on PATCH. PATCH and PUT share the exact same partial-update
// semantics here (fields are individually `undefined`-checked), so
// PATCH is a one-line re-export rather than duplicate logic.
export const PATCH = PUT;

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
