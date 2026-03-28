import { db, eamKeyword } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createKeywordSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/keywords — List all keywords
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const keywords = await db.select().from(eamKeyword)
    .where(eq(eamKeyword.orgId, ctx.orgId))
    .orderBy(desc(eamKeyword.usageCount));

  return Response.json({ data: keywords });
}

// POST /api/v1/eam/keywords — Create keyword
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createKeywordSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await db.insert(eamKeyword).values({
    ...parsed.data,
    orgId: ctx.orgId,
  }).returning();

  return Response.json({ data: created[0] }, { status: 201 });
}

// DELETE /api/v1/eam/keywords — Delete keyword
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const keywordId = url.searchParams.get("id");
  if (!keywordId) return Response.json({ error: "id required" }, { status: 400 });

  const deleted = await db.delete(eamKeyword)
    .where(and(eq(eamKeyword.id, keywordId), eq(eamKeyword.orgId, ctx.orgId)))
    .returning();

  if (!deleted.length) return Response.json({ error: "Keyword not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
