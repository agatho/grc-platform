import { db, document, documentVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { restoreDocumentVersionSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createDocumentVersion } from "@/lib/document-versioning";
import {
  getFileStorage,
  orgScopedStorage,
  FileNotFoundInStorageError,
} from "@grc/shared/lib/file-storage";
import { randomUUID } from "node:crypto";

// POST /api/v1/documents/:id/versions/:versionId/restore — Restore an
// old version by creating a NEW version with the old content/file
// snapshot (D1). History is never overwritten.
//
// #S06-19: the restored version used to reference the SAME storage key
// as its source. Two version rows then pointed at one object, and every
// delete path (erase route, document-retention-purge cron) collects
// keys per document and removes them — dropping the bytes out from
// under the other version. The object is now COPIED to a fresh key so
// each version owns its own bytes.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
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

  const { id, versionId } = await params;

  const body = restoreDocumentVersionSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const [source] = await db
    .select()
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.id, versionId),
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
      ),
    );

  if (!source) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  if (source.isCurrent) {
    return Response.json(
      { error: "Version is already the current version" },
      { status: 422 },
    );
  }

  const sourceLabel = source.versionLabel ?? String(source.versionNumber);

  // #S06-19: give the restored version its own object. Done BEFORE the
  // transaction so a storage failure never leaves a version row
  // pointing at a key that was never written.
  let restoredFilePath = source.filePath;
  if (source.filePath) {
    // #S06-10: every key this handler touches must live under this
    // org's prefix — enforced, not assumed.
    const storage = orgScopedStorage(getFileStorage(), ctx.orgId);
    const safeName = (source.fileName ?? "restored")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 200);
    const targetKey = `${ctx.orgId}/${id}/${randomUUID()}-${safeName}`;
    try {
      const bytes = await storage.get(source.filePath);
      await storage.put(targetKey, bytes, {
        contentType: source.mimeType ?? "application/octet-stream",
      });
      restoredFilePath = targetKey;
    } catch (err) {
      if (err instanceof FileNotFoundInStorageError) {
        // The source object is already gone — restore the metadata
        // snapshot but do not invent a key that holds nothing.
        console.warn(
          `[documents/restore] source object missing for version ${versionId}: ${source.filePath}`,
        );
        restoredFilePath = source.filePath;
      } else {
        throw err;
      }
    }
  }

  const restored = await withAuditContext(
    ctx,
    async (tx) => {
      const created = await createDocumentVersion(tx, {
        documentId: id,
        orgId: ctx.orgId,
        userId: ctx.userId,
        bump: "minor",
        content: source.content,
        changeSummary:
          body.data.changeSummary ?? `Restored from version ${sourceLabel}`,
        file: {
          fileName: source.fileName,
          filePath: restoredFilePath,
          fileSize: source.fileSize,
          mimeType: source.mimeType,
          fileSha256: source.fileSha256,
        },
      });

      // Sync the document head to the restored snapshot
      await tx
        .update(document)
        .set({
          content: source.content,
          currentVersion: created.versionNumber,
          fileName: source.fileName,
          filePath: restoredFilePath,
          fileSize: source.fileSize,
          mimeType: source.mimeType,
          fileSha256: source.fileSha256,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)));

      return created;
    },
    {
      actionDetail: `restore_version:${sourceLabel}`,
      reason: body.data.changeSummary ?? "",
    },
  );

  return Response.json(
    {
      data: {
        id: restored.id,
        versionNumber: restored.versionNumber,
        versionLabel: restored.versionLabel,
        restoredFromVersionId: versionId,
      },
    },
    { status: 201 },
  );
}
