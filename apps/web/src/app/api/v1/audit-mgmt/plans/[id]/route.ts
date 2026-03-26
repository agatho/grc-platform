import { db, auditPlan } from "@grc/db";
import { updateAuditPlanSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/audit-mgmt/plans/[id]
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, _req.method);
  if (moduleCheck) return moduleCheck;

  const [plan] = await db
    .select()
    .from(auditPlan)
    .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)));

  if (!plan) {
    return Response.json({ error: "Audit plan not found" }, { status: 404 });
  }

  return Response.json({ data: plan });
}

// PUT /api/v1/audit-mgmt/plans/[id]
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = updateAuditPlanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(auditPlan)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Audit plan not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/audit-mgmt/plans/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(auditPlan)
      .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Audit plan not found" }, { status: 404 });
  }

  return Response.json({ data: { id } });
}
