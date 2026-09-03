import { db, pluginHook } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/plugins/hooks — List all available hook points
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const moduleKey = url.searchParams.get("module");

  const conditions = moduleKey ? eq(pluginHook.module, moduleKey) : undefined;

  const rows = await db
    .select()
    .from(pluginHook)
    .where(conditions)
    .orderBy(pluginHook.key);

  return Response.json({ data: rows });
});
