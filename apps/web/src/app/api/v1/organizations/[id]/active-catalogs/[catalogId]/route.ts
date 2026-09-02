import { db, orgActiveCatalog } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/organizations/[id]/active-catalogs/[catalogId] — Deactivate catalog
export const DELETE = withErrorHandler(async function DELETE(
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
    return Response.json(
      { error: "Active catalog not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: { id: deleted.id, deactivated: true } });
});
