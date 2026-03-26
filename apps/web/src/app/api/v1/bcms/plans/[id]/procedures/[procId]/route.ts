import { db, bcpProcedure } from "@grc/db";
import { updateBcpProcedureSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/bcms/plans/[id]/procedures/[procId]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; procId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId, procId } = await params;

  const body = updateBcpProcedureSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(bcpProcedure)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(bcpProcedure.id, procId),
          eq(bcpProcedure.bcpId, bcpId),
          eq(bcpProcedure.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Procedure not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/bcms/plans/[id]/procedures/[procId]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; procId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId, procId } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(bcpProcedure)
      .where(
        and(
          eq(bcpProcedure.id, procId),
          eq(bcpProcedure.bcpId, bcpId),
          eq(bcpProcedure.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Procedure not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
