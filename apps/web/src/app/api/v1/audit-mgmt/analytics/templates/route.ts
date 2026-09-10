import { db, auditAnalyticsTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/audit-mgmt/analytics/templates — List analysis templates
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Show platform defaults (orgId=null) + org-specific templates
  const rows = await db
    .select()
    .from(auditAnalyticsTemplate)
    .where(
      or(
        isNull(auditAnalyticsTemplate.orgId),
        eq(auditAnalyticsTemplate.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: rows });
});
