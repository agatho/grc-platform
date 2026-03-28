import { db, apiUsageLog } from "@grc/db";
import { apiUsageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/api-keys/usage — Query API usage logs
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = apiUsageQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const conditions = [eq(apiUsageLog.orgId, ctx.orgId)];
  if (query.data.apiKeyId) conditions.push(eq(apiUsageLog.apiKeyId, query.data.apiKeyId));
  if (query.data.startDate) conditions.push(gte(apiUsageLog.createdAt, new Date(query.data.startDate)));
  if (query.data.endDate) conditions.push(lte(apiUsageLog.createdAt, new Date(query.data.endDate)));

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
}
