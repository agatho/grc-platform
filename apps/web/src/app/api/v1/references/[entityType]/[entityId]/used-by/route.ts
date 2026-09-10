import { db, entityReference } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/references/:entityType/:entityId/used-by
// Returns all entities that reference (USE) this entity as a target
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;

  const refs = await db
    .select()
    .from(entityReference)
    .where(
      and(
        eq(entityReference.orgId, ctx.orgId),
        eq(entityReference.targetType, entityType),
        eq(entityReference.targetId, entityId),
      ),
    )
    .orderBy(entityReference.sourceType, entityReference.createdAt);

  return Response.json({ data: refs });
});
