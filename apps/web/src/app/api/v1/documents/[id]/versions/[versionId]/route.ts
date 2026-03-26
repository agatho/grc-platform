import {
  db,
  document,
  documentVersion,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/documents/:id/versions/:versionId — Get specific version
export async function GET(
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
      content: documentVersion.content,
      changeSummary: documentVersion.changeSummary,
      isCurrent: documentVersion.isCurrent,
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
}
