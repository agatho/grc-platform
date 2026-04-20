import { db, eamContext } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createContextSchema, updateContextSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/contexts — List contexts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const contexts = await db
    .select()
    .from(eamContext)
    .where(eq(eamContext.orgId, ctx.orgId))
    .orderBy(desc(eamContext.updatedAt));

  return Response.json({ data: contexts });
}

// POST /api/v1/eam/contexts — Create context
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // If isDefault, ensure no other default exists (handled by partial unique index)
  const created = await db
    .insert(eamContext)
    .values({
      ...parsed.data,
      orgId: ctx.orgId,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created[0] }, { status: 201 });
}

// PUT /api/v1/eam/contexts — Update context
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("id");
  if (!contextId)
    return Response.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db
    .update(eamContext)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(eamContext.id, contextId), eq(eamContext.orgId, ctx.orgId)))
    .returning();

  if (!updated.length)
    return Response.json({ error: "Context not found" }, { status: 404 });
  return Response.json({ data: updated[0] });
}

// DELETE /api/v1/eam/contexts — Delete context
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("id");
  if (!contextId)
    return Response.json({ error: "id required" }, { status: 400 });

  const deleted = await db
    .delete(eamContext)
    .where(and(eq(eamContext.id, contextId), eq(eamContext.orgId, ctx.orgId)))
    .returning();

  if (!deleted.length)
    return Response.json({ error: "Context not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
