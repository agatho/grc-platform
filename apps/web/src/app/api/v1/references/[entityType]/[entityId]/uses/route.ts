import { db, entityReference } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/references/:entityType/:entityId/uses
// Returns all entities that this entity references (USES) as targets
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
        eq(entityReference.sourceType, entityType),
        eq(entityReference.sourceId, entityId),
      ),
    )
    .orderBy(entityReference.targetType, entityReference.createdAt);

  return Response.json({ data: refs });
});
