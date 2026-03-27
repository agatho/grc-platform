import { db, importColumnMapping } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { createColumnMappingSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { getSupportedEntityTypes } from "@/lib/import-export/entity-registry";

// POST /api/v1/import/mappings — Save column mapping as template
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createColumnMappingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  if (!getSupportedEntityTypes().includes(body.data.entityType)) {
    return Response.json(
      { error: `Unknown entity type: ${body.data.entityType}` },
      { status: 400 },
    );
  }

  const [mapping] = await withAuditContext(ctx, async (tx) => {
    return tx
      .insert(importColumnMapping)
      .values({
        orgId: ctx.orgId,
        entityType: body.data.entityType,
        name: body.data.name,
        mappingJson: body.data.mappingJson,
        createdBy: ctx.userId,
      })
      .returning();
  });

  return Response.json(mapping, { status: 201 });
}

// GET /api/v1/import/mappings?entityType=risk — List saved mappings
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");

  const conditions = [eq(importColumnMapping.orgId, ctx.orgId)];
  if (entityType) {
    conditions.push(eq(importColumnMapping.entityType, entityType));
  }

  const mappings = await db
    .select()
    .from(importColumnMapping)
    .where(and(...conditions))
    .orderBy(desc(importColumnMapping.createdAt));

  return Response.json({ data: mappings });
}
