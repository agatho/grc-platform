import { db, eamDataObjectCrud } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createCrudMappingSchema, updateCrudMappingSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/data-objects/:id/crud-mappings — Create CRUD mapping
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createCrudMappingSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await db.insert(eamDataObjectCrud).values({
    ...parsed.data,
    orgId: ctx.orgId,
  }).returning();

  return Response.json({ data: created[0] }, { status: 201 });
}

// PUT /api/v1/eam/data-objects/:id/crud-mappings — Update CRUD mapping
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const mappingId = url.searchParams.get("mappingId");
  if (!mappingId) return Response.json({ error: "mappingId required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateCrudMappingSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.update(eamDataObjectCrud)
    .set(parsed.data)
    .where(and(eq(eamDataObjectCrud.id, mappingId), eq(eamDataObjectCrud.orgId, ctx.orgId)))
    .returning();

  if (!updated.length) return Response.json({ error: "Mapping not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
}
