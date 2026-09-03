// DPMS Overhaul: dashboard KPI tiles.

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
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const data = await withReadContext(ctx, async (tx) => {
    const [stats] = (await tx.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM ropa_entry WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL)::int AS ropa_total,
        (SELECT COUNT(*) FROM process_ropa_profile WHERE org_id = ${ctx.orgId} AND is_processing_activity = true)::int AS process_ropa_count,
        (SELECT COUNT(*) FROM dpia WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL)::int AS dpia_total,
        (SELECT COUNT(*) FROM dpia WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status IN ('draft','in_progress','pending_dpo_review'))::int AS dpia_backlog,
        (SELECT COUNT(*) FROM dsr WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status NOT IN ('completed','rejected','cancelled'))::int AS dsr_open,
        (SELECT COUNT(*) FROM dsr WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status NOT IN ('completed','rejected','cancelled') AND due_date < now())::int AS dsr_overdue,
        (SELECT COUNT(*) FROM data_breach WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND status NOT IN ('closed'))::int AS breach_active,
        (SELECT COUNT(*) FROM data_breach WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
           AND is_dpa_notification_required = true AND dpa_notified_at IS NULL
           AND detected_at > now() - interval '72 hours')::int AS breach_72h_pending,
        (SELECT COUNT(*) FROM data_breach WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
           AND is_dpa_notification_required = true AND dpa_notified_at IS NULL
           AND detected_at < now() - interval '72 hours')::int AS breach_72h_overdue,
        (SELECT COUNT(*) FROM tia WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND next_review_date < now())::int AS tia_overdue,
        (SELECT COUNT(*) FROM processor_agreement WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
           AND review_due_date < now() + interval '60 days')::int AS pa_renewals_due
    `)) as unknown as KpiRow[];
    return stats;
  });

  return Response.json({ data });
});
