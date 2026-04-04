import { db, documentEntityLink, document } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const VALID_ENTITY_TYPES = [
  "risk",
  "control",
  "finding",
  "asset",
  "process",
  "vendor",
  "audit",
  "incident",
  "bia_assessment",
  "bcp",
  "ropa_entry",
  "dpia",
  "contract",
] as const;

const linkSchema = z.object({
  documentId: z.string().uuid(),
  entityType: z.enum(VALID_ENTITY_TYPES),
  entityId: z.string().uuid(),
  linkDescription: z.string().max(500).optional(),
});

// GET /api/v1/entity-documents?entityType=risk&entityId=xxx — Get documents linked to an entity
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return Response.json(
      { error: "entityType and entityId are required" },
      { status: 400 },
    );
  }

  const links = await db.execute(
    sql`SELECT
          del.id AS link_id,
          del.link_description,
          del.created_at AS linked_at,
          d.id AS document_id,
          d.title,
          d.category,
          d.status,
          d.current_version,
          d.file_name,
          d.file_size,
          d.mime_type,
          d.published_at,
          d.updated_at
        FROM document_entity_link del
        JOIN document d ON del.document_id = d.id
        WHERE del.org_id = ${ctx.orgId}
          AND del.entity_type = ${entityType}
          AND del.entity_id = ${entityId}
          AND d.deleted_at IS NULL
        ORDER BY d.updated_at DESC`,
  );

  return Response.json({ data: links });
}

// POST /api/v1/entity-documents — Link a document to an entity
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [link] = await db
    .insert(documentEntityLink)
    .values({
      documentId: parsed.data.documentId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      linkDescription: parsed.data.linkDescription ?? null,
      orgId: ctx.orgId,
    })
    .onConflictDoNothing()
    .returning();

  if (!link) {
    return Response.json({ error: "Link already exists" }, { status: 409 });
  }

  return Response.json({ data: link }, { status: 201 });
}

// DELETE /api/v1/entity-documents?id=xxx — Remove a document link
export async function DELETE(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("id");

  if (!linkId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = await db
    .delete(documentEntityLink)
    .where(
      and(
        eq(documentEntityLink.id, linkId),
        eq(documentEntityLink.orgId, ctx.orgId),
      ),
    )
    .returning();

  return Response.json({ deleted: deleted.length });
}
