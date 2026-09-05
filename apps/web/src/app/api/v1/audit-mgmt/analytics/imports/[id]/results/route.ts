import { db, auditAnalyticsResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/audit-mgmt/analytics/imports/:id/results — Get results for import
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(auditAnalyticsResult)
    .where(
      and(
        eq(auditAnalyticsResult.importId, id),
        eq(auditAnalyticsResult.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(auditAnalyticsResult.createdAt));

  return Response.json({ data: rows });
});
