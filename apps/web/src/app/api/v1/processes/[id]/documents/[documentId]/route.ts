import { db, process, processDocument } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/processes/:id/documents/:documentId — Unlink document from process
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, documentId } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Find the link
  const [link] = await db
    .select({ id: processDocument.id })
    .from(processDocument)
    .where(
      and(
        eq(processDocument.processId, id),
        eq(processDocument.documentId, documentId),
      ),
    );

  if (!link) {
    return Response.json(
      { error: "Document link not found" },
      { status: 404 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(processDocument)
      .where(eq(processDocument.id, link.id));
  });

  return Response.json({ success: true });
}
