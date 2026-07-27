import { db, saasComplianceCheck } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/identity-connectors/saas-checks
async function GET__ctx(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(saasComplianceCheck.orgId, ctx.orgId)];
  const platform = searchParams.get("platform");
  if (platform) conditions.push(eq(saasComplianceCheck.platform, platform));
  const checkType = searchParams.get("checkType");
  if (checkType) conditions.push(eq(saasComplianceCheck.checkType, checkType));
  const status = searchParams.get("status");
  if (status) conditions.push(eq(saasComplianceCheck.status, status));

  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(saasComplianceCheck)
      .where(where)
      .orderBy(desc(saasComplianceCheck.executedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(saasComplianceCheck).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}

// #SEC-F01b-RUN: wrap handlers so the request-scoped RLS context frame
// (opened by withErrorHandler, mutated by withAuth) is present around the bare
// db.* reads above — otherwise they run context-less under grc_app and RLS
// filters/faults. Also converts prior empty-body 500s to structured problem+json.
export const GET = withErrorHandler(GET__ctx);
