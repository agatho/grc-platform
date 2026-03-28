import { db, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/eam/relationships/:id
export async function DELETE(
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
      .where(and(eq(architectureRelationship.id, id), eq(architectureRelationship.orgId, ctx.orgId)))
      .returning({ id: architectureRelationship.id });
    return deleted;
  });

  if (!result) {
    return Response.json({ error: "Relationship not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
}
