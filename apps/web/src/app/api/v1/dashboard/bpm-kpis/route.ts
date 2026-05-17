// BPM Overhaul Phase 2: Dashboard KPI tiles for the BPM module.

import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const kpis = await withReadContext(ctx, async (tx) => {
    const [stats] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE p.deleted_at IS NULL)::int AS total_processes,
        COUNT(*) FILTER (WHERE p.status = 'published' AND p.deleted_at IS NULL)::int AS published,
        COUNT(*) FILTER (WHERE p.status = 'in_review' AND p.deleted_at IS NULL)::int AS in_review,
        COUNT(*) FILTER (WHERE p.status = 'approved' AND p.deleted_at IS NULL)::int AS pending_approval,
        COUNT(*) FILTER (WHERE p.is_critical_process AND p.deleted_at IS NULL)::int AS critical_processes,
        COUNT(*) FILTER (WHERE p.review_date IS NOT NULL AND p.review_date < now() AND p.deleted_at IS NULL)::int AS overdue_review
      FROM process p
      WHERE p.org_id = ${ctx.orgId}
    `)) as any[];

    const [riskStats] = (await tx.execute(sql`
      SELECT
        COUNT(DISTINCT pid)::int AS processes_with_critical_risk
      FROM (
        SELECT p.id AS pid
        FROM process p
        WHERE p.org_id = ${ctx.orgId}
          AND p.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM risk r
            JOIN (
              SELECT risk_id FROM process_risk WHERE process_id = p.id
              UNION
              SELECT psr.risk_id FROM process_step_risk psr
              JOIN process_step ps ON ps.id = psr.process_step_id
              WHERE ps.process_id = p.id
            ) u ON u.risk_id = r.id
            WHERE r.risk_score_residual >= 15 AND r.deleted_at IS NULL
          )
      ) q
    `)) as any[];

    const [coverageStats] = (await tx.execute(sql`
      SELECT
        COUNT(DISTINCT pfm.process_id)::int AS processes_with_framework_mapping
      FROM process_framework_mapping pfm
      JOIN process p ON p.id = pfm.process_id
      WHERE pfm.org_id = ${ctx.orgId} AND p.deleted_at IS NULL
    `)) as any[];

    const [findingStats] = (await tx.execute(sql`
      SELECT
        COUNT(DISTINCT processes.id)::int AS processes_with_open_findings
      FROM process processes
      JOIN finding f ON f.org_id = processes.org_id
        AND f.deleted_at IS NULL
        AND f.status NOT IN ('verified', 'closed', 'cancelled', 'remediated')
        AND (
          f.process_id = processes.id
          OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = processes.id)
        )
      WHERE processes.org_id = ${ctx.orgId} AND processes.deleted_at IS NULL
    `)) as any[];

    const [ropaStats] = (await tx.execute(sql`
      SELECT
        COUNT(*)::int AS processes_as_processing_activity,
        COUNT(*) FILTER (WHERE requires_dpia = true)::int AS processes_requiring_dpia
      FROM process_ropa_profile
      WHERE org_id = ${ctx.orgId} AND is_processing_activity = true
    `)) as any[];

    return {
      ...stats,
      ...riskStats,
      ...coverageStats,
      ...findingStats,
      ...ropaStats,
    };
  });

  return Response.json({ data: kpis });
}
