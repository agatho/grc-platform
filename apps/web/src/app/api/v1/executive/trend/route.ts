import { db, executiveKpiSnapshot } from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { executiveTrendQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/executive/trend — 12-month KPI snapshots for trend charts
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = executiveTrendQuerySchema.safeParse({
    months: url.searchParams.get("months") ?? "12",
  });

  const months = parsed.success ? parsed.data.months : 12;

  const rows = await db
    .select({
      snapshotDate: executiveKpiSnapshot.snapshotDate,
      kpis: executiveKpiSnapshot.kpis,
      createdAt: executiveKpiSnapshot.createdAt,
    })
    .from(executiveKpiSnapshot)
    .where(eq(executiveKpiSnapshot.orgId, ctx.orgId))
    .orderBy(desc(executiveKpiSnapshot.snapshotDate))
    .limit(months * 5); // ~5 snapshots per month (weekly)

  return Response.json({
    data: {
      snapshots: rows,
      count: rows.length,
    },
  });
});
