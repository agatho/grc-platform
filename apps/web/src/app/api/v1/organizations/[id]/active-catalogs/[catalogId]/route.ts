import { db, orgActiveCatalog } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/organizations/[id]/active-catalogs/[catalogId] — Deactivate catalog
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; catalogId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id: orgId, catalogId } = await params;

  if (orgId !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(orgActiveCatalog)
      .where(
        and(
          eq(orgActiveCatalog.id, catalogId),
          eq(orgActiveCatalog.orgId, orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Active catalog not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deactivated: true } });
}
