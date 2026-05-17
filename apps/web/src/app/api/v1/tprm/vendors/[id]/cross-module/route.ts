// TPRM Overhaul: cross-module aggregation per vendor.

import { db, vendor } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [v] = await db
    .select()
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)));
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const [stats] = (await tx.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM contract WHERE vendor_id = ${id} AND deleted_at IS NULL)::int AS contract_total,
        (SELECT COUNT(*) FROM contract WHERE vendor_id = ${id} AND status = 'active' AND deleted_at IS NULL)::int AS contract_active,
        (SELECT COUNT(*) FROM vendor_due_diligence WHERE vendor_id = ${id})::int AS dd_total,
        (SELECT COUNT(*) FROM lksg_assessment WHERE vendor_id = ${id})::int AS lksg_total,
        (SELECT COUNT(*) FROM vendor_sub_processor WHERE vendor_id = ${id})::int AS sub_processor_count,
        (SELECT COUNT(*) FROM contract_sla_measurement m
           JOIN contract_sla s ON s.id = m.contract_sla_id
           JOIN contract c ON c.id = s.contract_id
           WHERE c.vendor_id = ${id} AND m.is_breach = true)::int AS sla_breaches,
        (SELECT COUNT(*) FROM vendor_exit_plan WHERE vendor_id = ${id})::int AS exit_plans,
        0::int AS incidents
    `)) as any[];

    const contracts = (await tx.execute(sql`
      SELECT id, title, status, contract_type, start_date, end_date, value_amount, value_currency
      FROM contract
      WHERE vendor_id = ${id} AND deleted_at IS NULL
      ORDER BY end_date DESC NULLS LAST
      LIMIT 25
    `)) as any[];

    return { stats, contracts };
  });

  return Response.json({
    data: {
      vendorId: id,
      vendorName: v.name,
      designation: {
        doraCriticalIct: v.doraCriticalIct,
        lksgTier1: v.lksgTier1,
        designationRationale: v.designationRationale,
      },
      ...data,
      recentIncidents: [],
    },
  });
}
