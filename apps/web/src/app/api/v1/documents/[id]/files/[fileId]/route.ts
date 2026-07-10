import { db, document, documentFile } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, ne } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/documents/:id/files/:fileId — Soft-delete a file
// attachment (D4). The physical file is kept for the version history
// (older versions may still reference it); the retention-purge cron
// and GDPR erasure remove files physically.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
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

  const { id, fileId } = await params;

  const [doc] = await db
    .select()
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

  const [file] = await db
    .select()
    .from(documentFile)
    .where(
      and(
        eq(documentFile.id, fileId),
        eq(documentFile.documentId, id),
        eq(documentFile.orgId, ctx.orgId),
        isNull(documentFile.deletedAt),
      ),
    );

  if (!file) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(documentFile)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(documentFile.id, fileId))
      .returning({ id: documentFile.id });

    // Keep the legacy inline fields mirroring the newest remaining file
    if (doc.filePath === file.filePath) {
      const [nextFile] = await tx
        .select()
        .from(documentFile)
        .where(
          and(
            eq(documentFile.documentId, id),
            eq(documentFile.orgId, ctx.orgId),
            isNull(documentFile.deletedAt),
            ne(documentFile.id, fileId),
          ),
        )
        .orderBy(desc(documentFile.createdAt))
        .limit(1);

      await tx
        .update(document)
        .set({
          fileName: nextFile?.fileName ?? null,
          filePath: nextFile?.filePath ?? null,
          fileSize: nextFile?.fileSize ?? null,
          mimeType: nextFile?.mimeType ?? null,
          fileSha256: nextFile?.sha256 ?? null,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));
    }

    return row;
  });

  return Response.json({ data: { id: result.id, deleted: true } });
}
