import { db, catalogEntryReference } from "@grc/db";
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
  "incident",
  "threat",
  "vulnerability",
] as const;

const createSchema = z.object({
  catalogEntryId: z.string().uuid(),
  entityType: z.enum(VALID_ENTITY_TYPES),
  entityId: z.string().uuid(),
});

const bulkCreateSchema = z.object({
  catalogEntryId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        entityType: z.enum(VALID_ENTITY_TYPES),
        entityId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(100),
});

// GET /api/v1/catalog-references — List references for a catalog entry or entity
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const catalogEntryId = searchParams.get("catalogEntryId");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!catalogEntryId && !entityId) {
    return Response.json(
      { error: "Provide catalogEntryId or entityId query parameter" },
      { status: 400 },
    );
  }

  let refs;
  if (catalogEntryId) {
    // All entities linked to this catalog entry
    refs = await db
      .select()
      .from(catalogEntryReference)
      .where(
        and(
          eq(catalogEntryReference.orgId, ctx.orgId),
          eq(catalogEntryReference.catalogEntryId, catalogEntryId),
        ),
      );
  } else {
    // All catalog entries linked to this entity
    const conditions = [
      eq(catalogEntryReference.orgId, ctx.orgId),
      eq(catalogEntryReference.entityId, entityId!),
    ];
    if (entityType) {
      conditions.push(
        eq(catalogEntryReference.entityType, entityType),
      );
    }
    refs = await db
      .select()
      .from(catalogEntryReference)
      .where(and(...conditions));
  }

  // Enrich with catalog entry details
  if (refs.length > 0) {
    const entryIds = refs.map((r) => r.catalogEntryId);
    const entries = await db.execute(
      sql`SELECT ce.id, ce.code, ce.name, c.name AS catalog_name
          FROM catalog_entry ce
          JOIN catalog c ON ce.catalog_id = c.id
          WHERE ce.id = ANY(${entryIds})`,
    );
    const entryMap = new Map(
      (entries as any[]).map((e: any) => [
        e.id,
        { code: e.code, name: e.name, catalogName: e.catalog_name },
      ]),
    );

    const enriched = refs.map((r) => ({
      ...r,
      entry: entryMap.get(r.catalogEntryId) ?? null,
    }));
    return Response.json({ data: enriched });
  }

  return Response.json({ data: refs });
}

// POST /api/v1/catalog-references — Assign catalog entry to entity (single or bulk)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();

  // Bulk mode
  if (body.assignments) {
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const rows = parsed.data.assignments.map((a) => ({
      catalogEntryId: parsed.data.catalogEntryId,
      entityType: a.entityType,
      entityId: a.entityId,
      orgId: ctx.orgId,
    }));

    const inserted = await db
      .insert(catalogEntryReference)
      .values(rows)
      .onConflictDoNothing()
      .returning();

    return Response.json(
      { data: inserted, created: inserted.length },
      { status: 201 },
    );
  }

  // Single mode
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [ref] = await db
    .insert(catalogEntryReference)
    .values({
      catalogEntryId: parsed.data.catalogEntryId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      orgId: ctx.orgId,
    })
    .onConflictDoNothing()
    .returning();

  if (!ref) {
    return Response.json(
      { error: "Assignment already exists" },
      { status: 409 },
    );
  }

  return Response.json({ data: ref }, { status: 201 });
}

// DELETE /api/v1/catalog-references — Remove assignment
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const catalogEntryId = searchParams.get("catalogEntryId");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (id) {
    const deleted = await db
      .delete(catalogEntryReference)
      .where(
        and(
          eq(catalogEntryReference.id, id),
          eq(catalogEntryReference.orgId, ctx.orgId),
        ),
      )
      .returning();
    return Response.json({ deleted: deleted.length });
  }

  if (catalogEntryId && entityType && entityId) {
    const deleted = await db
      .delete(catalogEntryReference)
      .where(
        and(
          eq(catalogEntryReference.orgId, ctx.orgId),
          eq(catalogEntryReference.catalogEntryId, catalogEntryId),
          eq(catalogEntryReference.entityType, entityType),
          eq(catalogEntryReference.entityId, entityId),
        ),
      )
      .returning();
    return Response.json({ deleted: deleted.length });
  }

  return Response.json(
    { error: "Provide id or (catalogEntryId + entityType + entityId)" },
    { status: 400 },
  );
}
