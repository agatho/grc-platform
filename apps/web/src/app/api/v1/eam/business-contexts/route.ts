import { db, eamBusinessContext } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  createBusinessContextSchema,
  updateBusinessContextSchema,
} from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/business-contexts — List business contexts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const contexts = await db
    .select()
    .from(eamBusinessContext)
    .where(eq(eamBusinessContext.orgId, ctx.orgId))
    .orderBy(desc(eamBusinessContext.createdAt));

  return Response.json({ data: contexts });
}

// POST /api/v1/eam/business-contexts — Create business context
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createBusinessContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await db
    .insert(eamBusinessContext)
    .values({
      ...parsed.data,
      orgId: ctx.orgId,
    })
    .returning();

  return Response.json({ data: created[0] }, { status: 201 });
}

// PUT /api/v1/eam/business-contexts — Update business context
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("id");
  if (!contextId)
    return Response.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const parsed = updateBusinessContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db
    .update(eamBusinessContext)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(eamBusinessContext.id, contextId),
        eq(eamBusinessContext.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated.length)
    return Response.json(
      { error: "Business context not found" },
      { status: 404 },
    );
  return Response.json({ data: updated[0] });
}

// DELETE /api/v1/eam/business-contexts — Delete business context
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
    .delete(eamBusinessContext)
    .where(
      and(
        eq(eamBusinessContext.id, contextId),
        eq(eamBusinessContext.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!deleted.length)
    return Response.json(
      { error: "Business context not found" },
      { status: 404 },
    );
  return Response.json({ data: { deleted: true } });
}
