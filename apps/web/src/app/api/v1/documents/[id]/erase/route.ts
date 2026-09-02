import { db, document, documentFile, workItem, auditLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eraseDocumentSchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { getFileStorage, orgScopedStorage } from "@grc/shared/lib/file-storage";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/documents/:id/erase — GDPR Art. 17 hard erasure (D3).
// Admin only, mandatory justification. Removes the document, ALL
// versions, approval steps, acknowledgments, file rows (FK cascade)
// and the physical files. Refused while a legal hold is active.
// The audit-log entry (incl. reason) is written BEFORE deletion.
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = eraseDocumentSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Note: deliberately no isNull(deletedAt) filter — soft-deleted
  // documents must be erasable too (GDPR erasure is stronger).
  const [doc] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.legalHold) {
    return Response.json(
      {
        error:
          "Document is under legal hold and cannot be erased. Remove the legal hold first.",
        code: "legal_hold_active",
      },
      { status: 422 },
    );
  }

  // Collect all physical file paths (multi-file rows + legacy inline)
  const fileRows = await db
    .select({ filePath: documentFile.filePath })
    .from(documentFile)
    .where(
      and(eq(documentFile.documentId, id), eq(documentFile.orgId, ctx.orgId)),
    );
  const filePaths = new Set<string>(fileRows.map((f) => f.filePath));
  if (doc.filePath) filePaths.add(doc.filePath);

  await withAuditContext(
    ctx,
    async (tx) => {
      // Audit-log entry BEFORE the hard delete so the erasure and its
      // justification are traceable even though the rows disappear.
      // [WP4 · S03-05 — audit call only; this route belongs to WP7/WP8]
      // The GDPR Art. 17 erasure event is one of the most
      // forensically valuable entries the system writes, and it used to
      // be written outside the hash chain and outside every anchor.
      // Migration 0401 assigns the chain in a BEFORE INSERT trigger on
      // audit_log, so this entry is now chained like any other.
      await tx.insert(auditLog).values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        userEmail: ctx.session.user.email,
        userName: ctx.session.user.name,
        entityType: "document",
        entityId: id,
        entityTitle: doc.title,
        action: "delete",
        actionDetail: "gdpr_erasure",
        metadata: {
          reason: body.data.reason,
          documentTitle: doc.title,
          category: doc.category,
          status: doc.status,
          currentVersion: doc.currentVersion,
          erasedFiles: [...filePaths],
        },
      });

      // #S06-16: migration 0421 makes document_signature append-only —
      // a decided chain link cannot be deleted. The Art. 17 erasure is
      // the one legitimate exception, and it announces itself instead
      // of the guard having to guess: the trigger releases the DELETE
      // only inside this marked transaction.
      await tx.execute(
        sql`SELECT set_config('app.dms_signature_purge', 'all', true)`,
      );

      // Hard delete: versions, acknowledgments, entity links, approval
      // steps and file rows are removed via ON DELETE CASCADE.
      await tx
        .delete(document)
        .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));

      if (doc.workItemId) {
        await tx
          .update(workItem)
          .set({
            deletedAt: new Date(),
            deletedBy: ctx.userId,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(workItem.id, doc.workItemId));
      }
    },
    { actionDetail: "gdpr_erasure", reason: body.data.reason },
  );

  // Remove physical files after the DB transaction committed — a
  // failed delete must not roll back the erasure (orphaned files are
  // preferable to a half-erased record). Storage-agnostic: local FS
  // or S3, depending on STORAGE_BACKEND.
  // #S06-10: every key this handler touches must live under this
  // org's prefix — enforced, not assumed.
  const storage = orgScopedStorage(getFileStorage(), ctx.orgId);
  for (const relPath of filePaths) {
    try {
      await storage.delete(relPath);
    } catch {
      // File already gone or not accessible — nothing to do.
    }
  }

  return Response.json({ data: { id, erased: true } });
});
