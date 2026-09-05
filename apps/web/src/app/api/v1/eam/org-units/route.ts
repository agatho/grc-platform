import { db, eamOrgUnit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createOrgUnitSchema, updateOrgUnitSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/org-units — List org units
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
// POST /api/v1/eam/org-units — Create org unit
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createOrgUnitSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const created = await db
    .insert(eamOrgUnit)
    .values({
      ...parsed.data,
      orgId: ctx.orgId,
    })
    .returning();

  return Response.json({ data: created[0] }, { status: 201 });
});
// PUT /api/v1/eam/org-units — Update org unit
export const PUT = withErrorHandler(async function PUT(req: Request) {
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
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const updated = await db
    .update(eamOrgUnit)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(eamOrgUnit.id, unitId), eq(eamOrgUnit.orgId, ctx.orgId)))
    .returning();

  if (!updated.length)
    return Response.json({ error: "Org unit not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
});
// DELETE /api/v1/eam/org-units — Delete org unit
export const DELETE = withErrorHandler(async function DELETE(req: Request) {
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
});
