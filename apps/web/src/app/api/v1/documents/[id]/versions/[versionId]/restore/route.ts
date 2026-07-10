import { db, document, documentVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { restoreDocumentVersionSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createDocumentVersion } from "@/lib/document-versioning";

// POST /api/v1/documents/:id/versions/:versionId/restore — Restore an
// old version by creating a NEW version with the old content/file
// snapshot (D1). History is never overwritten.
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
          filePath: source.filePath,
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
          filePath: source.filePath,
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
