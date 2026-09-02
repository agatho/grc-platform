import { db, pluginExecutionLog } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/plugins/installations/:id/logs
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(pluginExecutionLog)
    .where(
      and(
        eq(pluginExecutionLog.installationId, id),
        eq(pluginExecutionLog.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(pluginExecutionLog.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pluginExecutionLog)
    .where(
      and(
        eq(pluginExecutionLog.installationId, id),
        eq(pluginExecutionLog.orgId, ctx.orgId),
      ),
    );

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
});
