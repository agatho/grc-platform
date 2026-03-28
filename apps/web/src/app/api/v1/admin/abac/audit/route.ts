import { db, abacAccessLog } from "@grc/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/admin/abac/audit — ABAC access audit log
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const userId = url.searchParams.get("userId");
  const entityType = url.searchParams.get("entityType");
  const decision = url.searchParams.get("decision");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions = [eq(abacAccessLog.orgId, ctx.orgId)];

  if (userId) conditions.push(eq(abacAccessLog.userId, userId));
  if (entityType) conditions.push(eq(abacAccessLog.entityType, entityType));
  if (decision) conditions.push(eq(abacAccessLog.decision, decision));
  if (from) conditions.push(gte(abacAccessLog.createdAt, new Date(from)));
  if (to) conditions.push(lte(abacAccessLog.createdAt, new Date(to)));

  const logs = await db
    .select()
    .from(abacAccessLog)
    .where(and(...conditions))
    .orderBy(desc(abacAccessLog.createdAt))
    .limit(limit)
    .offset(offset);

  // Stats
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      granted: sql<number>`count(*) filter (where decision = 'granted')::int`,
      denied: sql<number>`count(*) filter (where decision = 'denied')::int`,
    })
    .from(abacAccessLog)
    .where(eq(abacAccessLog.orgId, ctx.orgId));

  return Response.json({ data: logs, stats, meta: { limit, offset } });
}
