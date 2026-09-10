import { db, document, documentFile, documentVersion, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/documents/:id/files — List file attachments (D4)
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const files = await db
    .select({
      id: documentFile.id,
      documentId: documentFile.documentId,
      versionId: documentFile.versionId,
      versionLabel: documentVersion.versionLabel,
      versionNumber: documentVersion.versionNumber,
      fileName: documentFile.fileName,
      fileSize: documentFile.fileSize,
      mimeType: documentFile.mimeType,
      sha256: documentFile.sha256,
      uploadedBy: documentFile.uploadedBy,
      uploadedByName: user.name,
      createdAt: documentFile.createdAt,
    })
    .from(documentFile)
    .leftJoin(documentVersion, eq(documentFile.versionId, documentVersion.id))
    .leftJoin(user, eq(documentFile.uploadedBy, user.id))
    .where(
      and(
        eq(documentFile.documentId, id),
        eq(documentFile.orgId, ctx.orgId),
        isNull(documentFile.deletedAt),
      ),
    )
    .orderBy(desc(documentFile.createdAt));

  return Response.json({ data: files });
});
