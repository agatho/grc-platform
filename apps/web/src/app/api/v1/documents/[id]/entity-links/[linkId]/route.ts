import { db, document, documentEntityLink } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/documents/:id/entity-links/:linkId — Unlink entity
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, linkId } = await params;

  // Verify document exists
  const [doc] = await db
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(documentEntityLink)
      .where(
        and(
          eq(documentEntityLink.id, linkId),
          eq(documentEntityLink.documentId, id),
          eq(documentEntityLink.orgId, ctx.orgId),
        ),
      )
      .returning({ id: documentEntityLink.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Link not found" }, { status: 404 });
  }

  return Response.json({ data: { id: linkId, deleted: true } });
});
