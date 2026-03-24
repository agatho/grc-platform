import { db, accessLog } from "@grc/db";
import { desc, eq, sql, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/access-log — Login events (admin)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const eventType = searchParams.get("event_type");
  const where = eventType
    ? sql`${accessLog.eventType} = ${eventType}::access_event_type`
    : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(accessLog)
      .where(where)
      .orderBy(desc(accessLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(accessLog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
