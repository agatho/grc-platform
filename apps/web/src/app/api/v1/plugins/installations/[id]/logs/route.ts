import { db, pluginExecutionLog } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/plugins/installations/:id/logs
export async function GET(
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
}
