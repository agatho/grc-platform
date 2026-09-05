import { toRows } from "@grc/db";
import { withAuth, withReadContext } from "@/lib/api";
import { sql } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/budget/usage — Query v_budget_usage view
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Zeilenform aus der
// SELECT-Liste benannt statt `any`. `v_budget_usage` ist eine Sicht;
// die Betragsspalten kommen als `numeric` und damit als Zeichenkette.
type BudgetUsageRow = {
  budget_id: string;
  org_id: string;
  budget_name: string | null;
  budget_type: string | null;
  grc_area: string | null;
  planned_amount: string | number | null;
  currency: string | null;
  total_onetime: string | number | null;
  total_annual: string | number | null;
  total_effort_hours: string | number | null;
  total_used: string | number | null;
  remaining: string | number | null;
  entity_count: string | number | null;
};

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const budgetId = url.searchParams.get("budgetId");

  const rowsResult = await withReadContext(ctx, async (tx) => {
    const r = budgetId
      ? await tx.execute(
          sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId} AND budget_id = ${budgetId}`,
        )
      : await tx.execute(
          sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId}`,
        );
    return toRows(r) as unknown as BudgetUsageRow[];
  });

  const data = rowsResult.map((r) => ({
    budgetId: r.budget_id,
    orgId: r.org_id,
    budgetName: r.budget_name,
    budgetType: r.budget_type,
    grcArea: r.grc_area,
    plannedAmount: r.planned_amount,
    currency: r.currency,
    totalOnetime: r.total_onetime,
    totalAnnual: r.total_annual,
    totalEffortHours: r.total_effort_hours,
    totalUsed: r.total_used,
    remaining: r.remaining,
    entityCount: Number(r.entity_count),
  }));

  return Response.json({ data });
});
