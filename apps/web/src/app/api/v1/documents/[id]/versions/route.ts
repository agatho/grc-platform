import { db, document, documentVersion, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/documents/:id/versions — List all versions
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const versions = await db
    .select({
      id: documentVersion.id,
      documentId: documentVersion.documentId,
      versionNumber: documentVersion.versionNumber,
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
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(documentVersion.versionNumber));

  return Response.json({ data: versions });
}
