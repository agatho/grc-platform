import { db, itInfrastructureCheck } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);
  const conditions: SQL[] = [eq(itInfrastructureCheck.orgId, ctx.orgId)];
  const checkType = searchParams.get("checkType");
  if (checkType) conditions.push(eq(itInfrastructureCheck.checkType, checkType));
  const status = searchParams.get("status");
  if (status) conditions.push(eq(itInfrastructureCheck.status, status));
  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(itInfrastructureCheck).where(where).orderBy(desc(itInfrastructureCheck.executedAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(itInfrastructureCheck).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
