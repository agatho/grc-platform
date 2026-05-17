// TPRM Overhaul: dashboard KPI tiles.

import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const data = await withReadContext(ctx, async (tx) => {
    const [stats] = (await tx.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM vendor WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL)::int AS vendor_total,
        (SELECT COUNT(*) FROM vendor WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status = 'active')::int AS vendor_active,
        (SELECT COUNT(*) FROM vendor WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND tier = 'critical')::int AS vendor_critical_tier,
        (SELECT COUNT(*) FROM vendor WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND dora_critical_ict = true)::int AS dora_critical_count,
        (SELECT COUNT(*) FROM vendor WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND lksg_tier_1 = true)::int AS lksg_tier1_count,
        (SELECT COUNT(*) FROM vendor_due_diligence dd
           JOIN vendor v ON v.id = dd.vendor_id
           WHERE v.org_id = ${ctx.orgId} AND dd.status IN ('pending', 'in_progress'))::int AS dd_open,
        (SELECT COUNT(*) FROM contract WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status = 'active')::int AS contract_active,
        (SELECT COUNT(*) FROM contract WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
           AND end_date < now() + interval '90 days' AND status = 'active')::int AS contract_renewal_due,
        (SELECT COUNT(*) FROM contract WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
           AND end_date < now() AND status = 'active')::int AS contract_overdue,
        (SELECT COUNT(*) FROM contract_obligation co
           JOIN contract c ON c.id = co.contract_id
           WHERE c.org_id = ${ctx.orgId} AND co.due_date < now() AND co.status NOT IN ('completed','waived','cancelled'))::int AS obligations_overdue,
        (SELECT COUNT(*) FROM contract_sla_measurement m
           JOIN contract_sla s ON s.id = m.contract_sla_id
           JOIN contract c ON c.id = s.contract_id
           WHERE c.org_id = ${ctx.orgId} AND m.is_breach = true)::int AS sla_breaches,
        (SELECT COUNT(*) FROM vendor_sub_processor sp
           JOIN vendor v ON v.id = sp.vendor_id
           WHERE v.org_id = ${ctx.orgId} AND sp.status = 'pending')::int AS sub_processors_pending,
        (SELECT COUNT(*) FROM vendor_exit_plan ep
           JOIN vendor v ON v.id = ep.vendor_id
           WHERE v.org_id = ${ctx.orgId} AND ep.status = 'draft')::int AS exit_plans_draft
    `)) as any[];
    return stats;
  });

  return Response.json({ data });
}
