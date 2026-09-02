import { db, document, documentVersion, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/documents/:id/versions/:versionId — Get specific version
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, versionId } = await params;

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

  const [version] = await db
    .select({
      id: documentVersion.id,
      documentId: documentVersion.documentId,
      versionNumber: documentVersion.versionNumber,
      versionLabel: documentVersion.versionLabel,
      versionMajor: documentVersion.versionMajor,
      versionMinor: documentVersion.versionMinor,
      validFrom: documentVersion.validFrom,
      validUntil: documentVersion.validUntil,
      content: documentVersion.content,
      changeSummary: documentVersion.changeSummary,
      isCurrent: documentVersion.isCurrent,
      fileName: documentVersion.fileName,
      fileSha256: documentVersion.fileSha256,
      createdBy: documentVersion.createdBy,
      createdByName: user.name,
      createdAt: documentVersion.createdAt,
    })
    .from(documentVersion)
    .leftJoin(user, eq(documentVersion.createdBy, user.id))
    .where(
      and(
        eq(documentVersion.id, versionId),
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
      ),
    );

  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  return Response.json({ data: version });
});
