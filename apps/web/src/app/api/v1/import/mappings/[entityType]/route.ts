import { db, importColumnMapping } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/import/mappings/:entityType — List saved mappings for entity type
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { entityType } = await params;

  const mappings = await db
    .select()
    .from(importColumnMapping)
    .where(
      and(
        eq(importColumnMapping.orgId, ctx.orgId),
        eq(importColumnMapping.entityType, entityType),
      ),
    )
    .orderBy(desc(importColumnMapping.createdAt));

  return Response.json({ data: mappings });
});
// DELETE /api/v1/import/mappings/:entityType (with id query param)
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ entityType: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json(
      { error: "Missing id query parameter" },
      { status: 400 },
    );
  }

  const [deleted] = await db
    .delete(importColumnMapping)
    .where(
      and(
        eq(importColumnMapping.id, id),
        eq(importColumnMapping.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!deleted) {
    return Response.json({ error: "Mapping not found" }, { status: 404 });
  }

  return Response.json({ success: true });
});
