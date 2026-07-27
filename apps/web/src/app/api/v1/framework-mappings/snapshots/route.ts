import { db, frameworkCoverageSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

async function GET__ctx(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset } = paginate(req);
  const where = eq(frameworkCoverageSnapshot.orgId, ctx.orgId);
  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(frameworkCoverageSnapshot)
      .where(where)
      .orderBy(desc(frameworkCoverageSnapshot.snapshotDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(frameworkCoverageSnapshot).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}

// #SEC-F01b-RUN: wrap handlers so the request-scoped RLS context frame
// (opened by withErrorHandler, mutated by withAuth) is present around the bare
// db.* reads above — otherwise they run context-less under grc_app and RLS
// filters/faults. Also converts prior empty-body 500s to structured problem+json.
export const GET = withErrorHandler(GET__ctx);
