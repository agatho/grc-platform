import { ENTITY_FIELD_MAP, getAvailableEntityTypes } from "@grc/automation";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/automation/entity-fields — Available fields per entity type (admin only)
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  return Response.json({
    data: {
      entityTypes: getAvailableEntityTypes(),
      fields: ENTITY_FIELD_MAP,
    },
  });
});
