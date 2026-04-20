import { db, document, documentEntityLink } from "@grc/db";
import { createDocumentEntityLinkSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/documents/:id/entity-links — List entity links
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

  const links = await db
    .select()
    .from(documentEntityLink)
    .where(
      and(
        eq(documentEntityLink.documentId, id),
        eq(documentEntityLink.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: links });
}

// POST /api/v1/documents/:id/entity-links — Link entity to document
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const body = createDocumentEntityLinkSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check for duplicate link
  const [existingLink] = await db
    .select({ id: documentEntityLink.id })
    .from(documentEntityLink)
    .where(
      and(
        eq(documentEntityLink.documentId, id),
        eq(documentEntityLink.entityType, body.data.entityType),
        eq(documentEntityLink.entityId, body.data.entityId),
        eq(documentEntityLink.orgId, ctx.orgId),
      ),
    );

  if (existingLink) {
    return Response.json(
      { error: "This entity is already linked to this document" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(documentEntityLink)
      .values({
        orgId: ctx.orgId,
        documentId: id,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        linkDescription: body.data.linkDescription,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
