import { db, notification } from "@grc/db";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/notifications — Own notifications (all roles)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [
    eq(notification.userId, ctx.userId),
    eq(notification.orgId, ctx.orgId),
    isNull(notification.deletedAt),
  ];

  if (searchParams.get("unread") === "true") {
    conditions.push(eq(notification.isRead, false));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(notification).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
