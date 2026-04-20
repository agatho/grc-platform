import { db, risk, processRisk } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/risks/:id/process-links/:linkId — Remove process link
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, linkId } = await params;

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
      .delete(processRisk)
      .where(
        and(
          eq(processRisk.id, linkId),
          eq(processRisk.riskId, id),
          eq(processRisk.orgId, ctx.orgId),
        ),
      )
      .returning({ id: processRisk.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Process link not found" }, { status: 404 });
  }

  return Response.json({ data: { id: linkId, deleted: true } });
}
