import { withAuth, withReadContext } from "@/lib/api";
import { sql } from "drizzle-orm";

// GET /api/v1/budget/usage — Query v_budget_usage view
export async function GET(req: Request) {
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
    return Array.isArray(r) ? r : (r?.rows ?? []);
  });

  const data = (rowsResult as any[]).map((r: any) => ({
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
}
