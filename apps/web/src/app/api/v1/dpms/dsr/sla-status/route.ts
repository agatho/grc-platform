// DPMS Overhaul: DSR SLA status (Art. 12(3) — 30 days).

import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const data = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT
        d.id,
        d.dsr_type,
        d.status,
        d.received_at,
        d.due_date,
        EXTRACT(DAY FROM (d.due_date - now()))::int AS days_remaining,
        CASE
          WHEN d.status IN ('completed', 'rejected', 'cancelled') THEN 'closed'
          WHEN d.due_date < now() THEN 'overdue'
          WHEN d.due_date < now() + interval '7 days' THEN 'due_soon'
          ELSE 'on_track'
        END AS sla_status
      FROM dsr d
      WHERE d.org_id = ${ctx.orgId}
        AND d.deleted_at IS NULL
        AND d.status NOT IN ('completed', 'rejected', 'cancelled')
      ORDER BY d.due_date ASC
      LIMIT 100
    `);
  });

  const overdue = (data as any[]).filter(
    (r) => r.sla_status === "overdue",
  ).length;
  const dueSoon = (data as any[]).filter(
    (r) => r.sla_status === "due_soon",
  ).length;

  return Response.json({
    data: {
      requests: data,
      summary: { total: (data as any[]).length, overdue, dueSoon },
    },
  });
}
