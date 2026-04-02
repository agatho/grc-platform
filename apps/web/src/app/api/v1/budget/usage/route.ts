import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/budget/usage — Query v_budget_usage view
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const budgetId = url.searchParams.get("budgetId");

  let rows;
  if (budgetId) {
    rows = await db.execute(
      sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId} AND budget_id = ${budgetId}`,
    );
  } else {
    rows = await db.execute(
      sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId}`,
    );
  }

  const data = (rows as any[]).map((r: any) => ({
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
