// Audit Overhaul: dashboard KPI tiles for the Audit module.

import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Jede Spalte dieser Abfragen
// ist ein `COUNT(...)::int`; der Treiber liefert sie deshalb als Zahl. Das
// ist die ganze Zeilenform — sie als `Record<string, number>` zu benennen
// behauptet nicht mehr, als aus der SELECT-Liste ablesbar ist.
type KpiRow = Record<string, number>;

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const kpis = await withReadContext(ctx, async (tx) => {
    const [stats] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE a.deleted_at IS NULL)::int AS total_audits,
        COUNT(*) FILTER (WHERE a.status = 'planned' AND a.deleted_at IS NULL)::int AS planned,
        COUNT(*) FILTER (WHERE a.status IN ('preparation', 'fieldwork') AND a.deleted_at IS NULL)::int AS in_progress,
        COUNT(*) FILTER (WHERE a.status IN ('reporting', 'review') AND a.deleted_at IS NULL)::int AS pending_close,
        COUNT(*) FILTER (WHERE a.status = 'completed' AND a.deleted_at IS NULL)::int AS completed,
        COUNT(*) FILTER (WHERE a.actual_end IS NULL AND a.planned_end < now() AND a.status NOT IN ('completed','cancelled') AND a.deleted_at IS NULL)::int AS overdue
      FROM audit a
      WHERE a.org_id = ${ctx.orgId}
    `)) as unknown as KpiRow[];

    const [findings] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE f.status NOT IN ('verified','closed','cancelled','remediated') AND f.deleted_at IS NULL)::int AS open,
        COUNT(*) FILTER (WHERE f.severity = 'critical' AND f.status NOT IN ('verified','closed','cancelled','remediated') AND f.deleted_at IS NULL)::int AS open_critical,
        COUNT(*) FILTER (WHERE f.severity = 'high' AND f.status NOT IN ('verified','closed','cancelled','remediated') AND f.deleted_at IS NULL)::int AS open_high,
        COUNT(*) FILTER (WHERE f.remediation_due_date < now() AND f.status NOT IN ('verified','closed','cancelled','remediated') AND f.deleted_at IS NULL)::int AS overdue_remediation
      FROM finding f
      WHERE f.org_id = ${ctx.orgId} AND f.audit_id IS NOT NULL
    `)) as unknown as KpiRow[];

    const [universe] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total_universe,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND next_audit_due < now())::int AS overdue_audit_cycle
      FROM audit_universe_entry
      WHERE org_id = ${ctx.orgId}
    `)) as unknown as KpiRow[];

    return { ...stats, ...findings, ...universe };
  });

  return Response.json({ data: kpis });
});
