import { db, eamOrgUnit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createOrgUnitSchema, updateOrgUnitSchema } from "@grc/shared";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/org-units — List org units
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const units = await db
    .select()
    .from(eamOrgUnit)
    .where(eq(eamOrgUnit.orgId, ctx.orgId))
    .orderBy(eamOrgUnit.name);

  return Response.json({ data: units });
}

// POST /api/v1/eam/org-units — Create org unit
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createOrgUnitSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await db
    .insert(eamOrgUnit)
    .values({
      ...parsed.data,
      orgId: ctx.orgId,
    })
    .returning();

  return Response.json({ data: created[0] }, { status: 201 });
}

// PUT /api/v1/eam/org-units — Update org unit
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const unitId = url.searchParams.get("id");
  if (!unitId) return Response.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateOrgUnitSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db
    .update(eamOrgUnit)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(eamOrgUnit.id, unitId), eq(eamOrgUnit.orgId, ctx.orgId)))
    .returning();

  if (!updated.length)
    return Response.json({ error: "Org unit not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
}

// DELETE /api/v1/eam/org-units — Delete org unit
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const unitId = url.searchParams.get("id");
  if (!unitId) return Response.json({ error: "id required" }, { status: 400 });

  const deleted = await db
    .delete(eamOrgUnit)
    .where(and(eq(eamOrgUnit.id, unitId), eq(eamOrgUnit.orgId, ctx.orgId)))
    .returning();

  if (!deleted.length)
    return Response.json({ error: "Org unit not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
