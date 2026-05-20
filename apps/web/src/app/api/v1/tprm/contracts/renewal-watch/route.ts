// TPRM Overhaul: contracts due for renewal in the next 90 days + overdue.

import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const horizonDays = Math.min(
    365,
    Math.max(1, parseInt(url.searchParams.get("horizonDays") ?? "90", 10)),
  );

  const data = await withReadContext(ctx, async (tx) => {
    const overdue = await tx.execute(sql`
      SELECT c.id, c.title, c.contract_type, c.status, c.end_date,
             v.id AS vendor_id, v.name AS vendor_name, v.dora_critical_ict, v.lksg_tier_1,
             EXTRACT(DAY FROM (now() - c.end_date))::int AS days_overdue
      FROM contract c
      JOIN vendor v ON v.id = c.vendor_id
      WHERE c.org_id = ${ctx.orgId}
        AND c.deleted_at IS NULL
        AND c.end_date IS NOT NULL
        AND c.end_date < now()
        AND c.status IN ('active', 'renewal', 'pending_approval')
      ORDER BY c.end_date ASC
      LIMIT 100
    `);

    const upcoming = await tx.execute(sql`
      SELECT c.id, c.title, c.contract_type, c.status, c.end_date,
             v.id AS vendor_id, v.name AS vendor_name, v.dora_critical_ict, v.lksg_tier_1,
             EXTRACT(DAY FROM (c.end_date - now()))::int AS days_remaining
      FROM contract c
      JOIN vendor v ON v.id = c.vendor_id
      WHERE c.org_id = ${ctx.orgId}
        AND c.deleted_at IS NULL
        AND c.end_date IS NOT NULL
        AND c.end_date BETWEEN now() AND now() + (${horizonDays}::int * interval '1 day')
        AND c.status IN ('active', 'renewal')
      ORDER BY c.end_date ASC
      LIMIT 200
    `);

    return { overdue, upcoming };
  });

  return Response.json({ data: { horizonDays, ...data } });
}
