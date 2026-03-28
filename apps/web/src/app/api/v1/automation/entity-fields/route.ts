import { ENTITY_FIELD_MAP, getAvailableEntityTypes } from "@grc/automation";
import { withAuth } from "@/lib/api";

// GET /api/v1/automation/entity-fields — Available fields per entity type (admin only)
export async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  return Response.json({
    data: {
      entityTypes: getAvailableEntityTypes(),
      fields: ENTITY_FIELD_MAP,
    },
  });
}
