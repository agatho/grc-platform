import { db, abacAccessLog } from "@grc/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  toDateParam,
  invalidDateParam,
  isUuidParam,
  invalidUuidParam,
} from "@/lib/query-schema";

// GET /api/v1/admin/abac/audit — ABAC access audit log
export const GET = withErrorHandler(async function GET(req: Request) {
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

  if (entityType) conditions.push(eq(abacAccessLog.entityType, entityType));
  if (decision) conditions.push(eq(abacAccessLog.decision, decision));
  // [Welle 4b-7 · OP-116] `new Date("garbage")` wirft nicht — der Treiber
  // wirft, mit `RangeError` statt SQLSTATE, und der Wickel macht daraus 500.
  if (userId && !isUuidParam(userId)) return invalidUuidParam(req, "userId");
  if (userId) conditions.push(eq(abacAccessLog.userId, userId));
  if (from) {
    const d = toDateParam(from);
    if (!d) return invalidDateParam(req, "from");
    conditions.push(gte(abacAccessLog.createdAt, d));
  }
  if (to) {
    const d = toDateParam(to);
    if (!d) return invalidDateParam(req, "to");
    conditions.push(lte(abacAccessLog.createdAt, d));
  }

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
});
