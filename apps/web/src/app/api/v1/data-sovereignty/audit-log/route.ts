import { db, sovereigntyAuditLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { listSovereigntyAuditLogQuerySchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/audit-log
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listSovereigntyAuditLogQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(sovereigntyAuditLog.orgId, ctx.orgId)];
  if (query.eventType) conditions.push(eq(sovereigntyAuditLog.eventType, query.eventType));
  if (query.isViolation !== undefined) conditions.push(eq(sovereigntyAuditLog.isViolation, query.isViolation));
  if (query.from) conditions.push(gte(sovereigntyAuditLog.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(sovereigntyAuditLog.createdAt, new Date(query.to)));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(sovereigntyAuditLog).where(and(...conditions))
      .orderBy(desc(sovereigntyAuditLog.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(sovereigntyAuditLog).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}
