import { db, auditLog } from "@grc/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/audit-log — Audit log with filters (admin, auditor, dpo)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "dpo");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  // Build WHERE conditions
  const conditions = [eq(auditLog.orgId, ctx.orgId)];

  const entityType = searchParams.get("entity_type");
  if (entityType) conditions.push(eq(auditLog.entityType, entityType));

  const entityId = searchParams.get("entity_id");
  if (entityId) conditions.push(eq(auditLog.entityId, entityId));

  const action = searchParams.get("action");
  if (action) conditions.push(sql`${auditLog.action} = ${action}::audit_action`);

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditLog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
