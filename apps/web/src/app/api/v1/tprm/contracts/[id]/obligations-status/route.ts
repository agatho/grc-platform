// TPRM Overhaul: per-contract obligation status with due/overdue counts.

import { db, contract } from "@grc/db";
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
  const [c] = await db
    .select({ id: contract.id, title: contract.title })
    .from(contract)
    .where(and(eq(contract.id, id), eq(contract.orgId, ctx.orgId), isNull(contract.deletedAt)));
  if (!c) return Response.json({ error: "Contract not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const obligations = await tx.execute(sql`
      SELECT id, title, description, obligation_type, status, due_date, owner_id,
             CASE
               WHEN status IN ('completed','waived','cancelled') THEN 'closed'
               WHEN due_date < now() THEN 'overdue'
               WHEN due_date < now() + interval '14 days' THEN 'due_soon'
               ELSE 'on_track'
             END AS sla_state
      FROM contract_obligation
      WHERE contract_id = ${id}
      ORDER BY due_date ASC NULLS LAST
    `);

    const summary = (obligations as any[]).reduce(
      (acc, o) => {
        acc.total += 1;
        acc[o.sla_state] = (acc[o.sla_state] ?? 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>,
    );

    return { obligations, summary };
  });

  return Response.json({ data: { contractId: id, contractTitle: c.title, ...data } });
}
