import { db, risk, riskFrameworkMapping } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/risks/:id/framework-mappings/:mappingId — Remove framework mapping
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; mappingId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, mappingId } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(riskFrameworkMapping)
      .where(
        and(
          eq(riskFrameworkMapping.id, mappingId),
          eq(riskFrameworkMapping.riskId, id),
          eq(riskFrameworkMapping.orgId, ctx.orgId),
        ),
      )
      .returning({ id: riskFrameworkMapping.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Mapping not found" }, { status: 404 });
  }

  return Response.json({ data: { id: mappingId, deleted: true } });
}
