import { db, identityTestResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/identity-connectors/test-results
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(identityTestResult.orgId, ctx.orgId)];
  const connectorId = searchParams.get("connectorId");
  if (connectorId) conditions.push(eq(identityTestResult.connectorId, connectorId));
  const category = searchParams.get("testCategory");
  if (category) conditions.push(eq(identityTestResult.testCategory, category));
  const status = searchParams.get("status");
  if (status) conditions.push(eq(identityTestResult.status, status));

  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(identityTestResult).where(where).orderBy(desc(identityTestResult.executedAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(identityTestResult).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
