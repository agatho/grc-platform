import {
  db,
  document,
  documentFile,
  documentVersion,
  documentSignatureRequest,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, ne, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/documents/:id/files/:fileId — Soft-delete a file
// attachment (D4). The physical file is kept for the version history
// (older versions may still reference it); the retention-purge cron
// and GDPR erasure remove files physically.
//
// #S06-19 (second half): the route pulled document.file_sha256 forward
// to the next remaining file but left document_version untouched. A
// version — including one that had been SIGNED — could therefore end
// up pointing at a soft-deleted file, while the signature verification
// kept comparing the frozen hash against that stale column and reported
// "unchanged". Versions that reference the deleted key are now checked:
// if any signature request froze such a version, the deletion is
// refused; otherwise the affected versions are cleared explicitly so
// the dangling reference is visible instead of silent.
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

  // #S06-19: which versions still point at this object?
  const affectedVersions = await db
    .select({
      id: documentVersion.id,
      versionLabel: documentVersion.versionLabel,
    })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
        eq(documentVersion.filePath, file.filePath),
      ),
    );

  if (affectedVersions.length > 0) {
    const frozen = await db
      .select({ id: documentSignatureRequest.id })
      .from(documentSignatureRequest)
      .where(
        and(
          eq(documentSignatureRequest.orgId, ctx.orgId),
          inArray(
            documentSignatureRequest.versionId,
            affectedVersions.map((v) => v.id),
          ),
        ),
      );
    if (frozen.length > 0) {
      return Response.json(
        {
          error:
            "This file is the signed artefact of at least one signature request. Deleting it would leave the signature pointing at a file that no longer exists.",
          code: "file_signed",
          versions: affectedVersions.map((v) => v.versionLabel),
        },
        { status: 409 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // #S06-19: clear the version snapshots that referenced the deleted
    // object rather than leaving them pointing at a removed key.
    if (affectedVersions.length > 0) {
      await tx
        .update(documentVersion)
        .set({
          filePath: null,
          fileName: null,
          fileSize: null,
          mimeType: null,
          fileSha256: null,
        })
        .where(
          inArray(
            documentVersion.id,
            affectedVersions.map((v) => v.id),
          ),
        );
    }

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
