import { db, document, documentVersion, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { documentVersionAtQuerySchema, resolveVersionAt } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, searchParamsToObject } from "@/lib/api";

// GET /api/v1/documents/:id/versions/at?date=ISO — Point-in-time lookup
// Returns the version that was effective at the given date:
// validFrom <= date < validUntil (validUntil NULL = open window),
// with a createdAt-window fallback for legacy rows (D1).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const query = documentVersionAtQuerySchema.safeParse(
    searchParamsToObject(new URL(req.url).searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

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
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
      ),
    );

  const at = new Date(query.data.date);
  const resolved = resolveVersionAt(versions, at);

  if (!resolved) {
    return Response.json(
      { error: "No version was effective at the given date" },
      { status: 404 },
    );
  }

  return Response.json({ data: resolved, meta: { at: at.toISOString() } });
}
