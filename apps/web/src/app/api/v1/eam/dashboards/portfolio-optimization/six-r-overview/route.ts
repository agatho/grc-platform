import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const EFFORT_MONTHS: Record<string, number> = {
  retain: 0,
  replatform: 2,
  refactor: 4,
  rearchitect: 6,
  rebuild: 8,
  replace: 3,
};

// GET /api/v1/eam/dashboards/portfolio-optimization/6r-overview — 6R strategy distribution
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT ap.six_r_strategy AS strategy, COUNT(*)::int AS count
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired' AND ap.six_r_strategy IS NOT NULL
    GROUP BY ap.six_r_strategy
    ORDER BY count DESC
  `);

  const rows = result as unknown as Array<{ strategy: string; count: number }>;
  const data = rows.map((r) => ({
    strategy: r.strategy,
    count: r.count,
    estimatedMonths: r.count * (EFFORT_MONTHS[r.strategy] ?? 0),
  }));

  return Response.json({ data });
});
