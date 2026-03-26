import { db, audit, user } from "@grc/db";
import { updateAuditSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/audit-mgmt/audits/[id]
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, _req.method);
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select({
      id: audit.id,
      orgId: audit.orgId,
      workItemId: audit.workItemId,
      auditPlanItemId: audit.auditPlanItemId,
      title: audit.title,
      description: audit.description,
      auditType: audit.auditType,
      status: audit.status,
      scopeDescription: audit.scopeDescription,
      scopeProcesses: audit.scopeProcesses,
      scopeDepartments: audit.scopeDepartments,
      scopeFrameworks: audit.scopeFrameworks,
      leadAuditorId: audit.leadAuditorId,
      leadAuditorName: user.name,
      auditorIds: audit.auditorIds,
      auditeeId: audit.auditeeId,
      plannedStart: audit.plannedStart,
      plannedEnd: audit.plannedEnd,
      actualStart: audit.actualStart,
      actualEnd: audit.actualEnd,
      findingCount: audit.findingCount,
      conclusion: audit.conclusion,
      reportDocumentId: audit.reportDocumentId,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
      createdBy: audit.createdBy,
    })
    .from(audit)
    .leftJoin(user, eq(audit.leadAuditorId, user.id))
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/audit-mgmt/audits/[id]
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = updateAuditSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(audit)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(audit.id, id),
          eq(audit.orgId, ctx.orgId),
          isNull(audit.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/audit-mgmt/audits/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(audit)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(audit.id, id),
          eq(audit.orgId, ctx.orgId),
          isNull(audit.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  return Response.json({ data: { id } });
}
