import { db, eventLog } from "@grc/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { toDateParam, invalidDateParam } from "@/lib/query-schema";

// GET /api/v1/events — Event log (paginated, filterable) (admin only)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(eventLog.orgId, ctx.orgId)];

  // Filter by entity type
  const entityType = searchParams.get("entityType");
  if (entityType) {
    conditions.push(eq(eventLog.entityType, entityType));
  }

  // Filter by event type
  const eventType = searchParams.get("eventType");
  if (eventType) {
    conditions.push(eq(eventLog.eventType, eventType));
  }

  // Filter by entity ID
  const entityId = searchParams.get("entityId");
  if (entityId) {
    conditions.push(eq(eventLog.entityId, entityId));
  }

  // Filter by user ID
  const userId = searchParams.get("userId");
  if (userId) {
    conditions.push(eq(eventLog.userId, userId));
  }

  // Filter by time range
  // [Welle 4b-7 · OP-116] `new Date("garbage")` wirft nicht — der Treiber
  // wirft, mit `RangeError` statt SQLSTATE, und der Wickel macht daraus 500.
  const from = searchParams.get("from");
  if (from) {
    const d = toDateParam(from);
    if (!d) return invalidDateParam(req, "from");
    conditions.push(gte(eventLog.emittedAt, d));
  }

  const to = searchParams.get("to");
  if (to) {
    const d = toDateParam(to);
    if (!d) return invalidDateParam(req, "to");
    conditions.push(lte(eventLog.emittedAt, d));
  }

  const rows = await db
    .select()
    .from(eventLog)
    .where(and(...conditions))
    .orderBy(desc(eventLog.emittedAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventLog)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
});
