import { db, eventLog } from "@grc/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/events — Event log (paginated, filterable) (admin only)
export async function GET(req: Request) {
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
  const from = searchParams.get("from");
  if (from) {
    conditions.push(gte(eventLog.emittedAt, new Date(from)));
  }

  const to = searchParams.get("to");
  if (to) {
    conditions.push(lte(eventLog.emittedAt, new Date(to)));
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
}
