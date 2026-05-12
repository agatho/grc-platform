import { db, document, documentEntityLink } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// #NIGHT-035: per-control document list (mirror of /risks/{id}/documents).
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const rows = await db
      .select({
        id: document.id,
        title: document.title,
        category: document.category,
        status: document.status,
        version: document.currentVersion,
        updatedAt: document.updatedAt,
        linkDescription: documentEntityLink.linkDescription,
      })
      .from(documentEntityLink)
      .innerJoin(document, eq(documentEntityLink.documentId, document.id))
      .where(
        and(
          eq(documentEntityLink.orgId, ctx.orgId),
          eq(documentEntityLink.entityType, "control"),
          eq(documentEntityLink.entityId, id),
          isNull(document.deletedAt),
        ),
      )
      .orderBy(desc(document.updatedAt));

    return Response.json({ data: rows, total: rows.length });
  },
);
