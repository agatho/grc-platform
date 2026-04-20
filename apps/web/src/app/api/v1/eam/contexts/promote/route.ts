import { db, eamContext } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/contexts/:id/promote — Promote context to default
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("id");
  if (!contextId)
    return Response.json({ error: "id required" }, { status: 400 });

  // Verify the context exists and belongs to this org
  const context = await db
    .select()
    .from(eamContext)
    .where(and(eq(eamContext.id, contextId), eq(eamContext.orgId, ctx.orgId)))
    .limit(1);

  if (!context.length)
    return Response.json({ error: "Context not found" }, { status: 404 });
  if (context[0].isDefault)
    return Response.json(
      { error: "Context is already default" },
      { status: 400 },
    );

  // In a transaction: deactivate current default, promote new one
  // Remove current default
  await db
    .update(eamContext)
    .set({ isDefault: false, status: "archived", updatedAt: new Date() })
    .where(
      and(eq(eamContext.orgId, ctx.orgId), eq(eamContext.isDefault, true)),
    );

  // Promote new default
  const promoted = await db
    .update(eamContext)
    .set({ isDefault: true, status: "active", updatedAt: new Date() })
    .where(eq(eamContext.id, contextId))
    .returning();

  return Response.json({ data: promoted[0] });
}
