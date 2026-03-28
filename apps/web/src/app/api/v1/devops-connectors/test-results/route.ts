import { db, devopsTestResult } from "@grc/db";
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
  const conditions: SQL[] = [eq(devopsTestResult.orgId, ctx.orgId)];
  const connectorId = searchParams.get("connectorId");
  if (connectorId) conditions.push(eq(devopsTestResult.connectorId, connectorId));
  const category = searchParams.get("testCategory");
  if (category) conditions.push(eq(devopsTestResult.testCategory, category));
  const status = searchParams.get("status");
  if (status) conditions.push(eq(devopsTestResult.status, status));
  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(devopsTestResult).where(where).orderBy(desc(devopsTestResult.executedAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(devopsTestResult).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
