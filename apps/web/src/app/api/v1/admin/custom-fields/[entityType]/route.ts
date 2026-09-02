import { db, customFieldDefinition } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/custom-fields/:entityType — List fields for entity type
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType } = await params;

  const fields = await db
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.orgId, ctx.orgId),
        eq(customFieldDefinition.entityType, entityType),
        eq(customFieldDefinition.isActive, true),
      ),
    )
    .orderBy(customFieldDefinition.sortOrder);

  return Response.json({ data: fields });
});
