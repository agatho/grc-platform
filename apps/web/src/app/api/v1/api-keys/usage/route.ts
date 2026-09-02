import { db, apiUsageLog } from "@grc/db";
import { apiUsageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/api-keys/usage — Query API usage logs
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = apiUsageQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const conditions = [eq(apiUsageLog.orgId, ctx.orgId)];
  if (query.data.apiKeyId)
    conditions.push(eq(apiUsageLog.apiKeyId, query.data.apiKeyId));
  if (query.data.startDate)
    conditions.push(gte(apiUsageLog.createdAt, new Date(query.data.startDate)));
  if (query.data.endDate)
    conditions.push(lte(apiUsageLog.createdAt, new Date(query.data.endDate)));

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(apiUsageLog)
    .where(and(...conditions))
    .orderBy(desc(apiUsageLog.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiUsageLog)
    .where(and(...conditions));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
});
