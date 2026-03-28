import { withAuth } from "@/lib/api";
import { AVAILABLE_ENTITY_TYPES, AVAILABLE_EVENT_TYPES } from "@grc/shared";

// GET /api/v1/webhooks/event-types — Available event types for webhook filter UI
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  return Response.json({
    data: {
      entityTypes: AVAILABLE_ENTITY_TYPES,
      eventTypes: AVAILABLE_EVENT_TYPES,
    },
  });
}
