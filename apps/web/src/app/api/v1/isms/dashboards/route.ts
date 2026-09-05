import { db, customDashboard } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/dashboards — ISMS dashboard views
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const dashboards = await db
    .select()
    .from(customDashboard)
    .where(
      and(
        eq(customDashboard.orgId, ctx.orgId),
        isNull(customDashboard.deletedAt),
      ),
    )
    .orderBy(asc(customDashboard.createdAt));

  return Response.json({ data: dashboards });
});
