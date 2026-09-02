import { db, controlMaturity, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/maturity/radar — avg maturity per domain/department
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Group maturity by control department (domain proxy)
  const rows = await db
    .select({
      axis: sql<string>`coalesce(${control.department}, 'Uncategorized')`,
      current: sql<number>`round(avg(${controlMaturity.currentMaturity})::numeric, 1)`,
      target: sql<number>`round(avg(${controlMaturity.targetMaturity})::numeric, 1)`,
    })
    .from(controlMaturity)
    .innerJoin(control, eq(controlMaturity.controlId, control.id))
    .where(eq(controlMaturity.orgId, ctx.orgId))
    .groupBy(control.department);

  return Response.json({ data: rows });
});
