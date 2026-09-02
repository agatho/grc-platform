import { db, widgetDefinition } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/dashboards/widget-definitions — List available widget types
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const definitions = await db
    .select()
    .from(widgetDefinition)
    .where(eq(widgetDefinition.isActive, true))
    .orderBy(widgetDefinition.type, widgetDefinition.key);

  return Response.json({ data: definitions, total: definitions.length });
});
