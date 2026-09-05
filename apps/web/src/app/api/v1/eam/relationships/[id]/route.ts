import { architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/eam/relationships/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(architectureRelationship)
      .where(
        and(
          eq(architectureRelationship.id, id),
          eq(architectureRelationship.orgId, ctx.orgId),
        ),
      )
      .returning({ id: architectureRelationship.id });
    return deleted;
  });

  if (!result) {
    return Response.json({ error: "Relationship not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
});
