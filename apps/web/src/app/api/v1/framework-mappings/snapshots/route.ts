import { db, frameworkCoverageSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset } = paginate(req);
  const where = eq(frameworkCoverageSnapshot.orgId, ctx.orgId);
  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(frameworkCoverageSnapshot).where(where).orderBy(desc(frameworkCoverageSnapshot.snapshotDate)).limit(limit).offset(offset),
    db.select({ value: count() }).from(frameworkCoverageSnapshot).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
