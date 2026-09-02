import { db, importJob } from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { count } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/import — List import jobs (history)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const entityType = searchParams.get("entityType");
  const status = searchParams.get("status");

  const conditions = [eq(importJob.orgId, ctx.orgId)];
  if (entityType) {
    conditions.push(eq(importJob.entityType, entityType));
  }
  if (status) {
    conditions.push(eq(importJob.status, status));
  }

  const { and } = await import("drizzle-orm");
  const where = and(...conditions);

  const [totalResult] = await db
    .select({ total: count() })
    .from(importJob)
    .where(where);

  const jobs = await db
    .select()
    .from(importJob)
    .where(where)
    .orderBy(desc(importJob.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(jobs, totalResult.total, page, limit);
});
