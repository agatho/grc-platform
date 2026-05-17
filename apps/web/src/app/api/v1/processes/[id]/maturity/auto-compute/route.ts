// BPM Overhaul Phase 8 D3: Auto-compute process maturity from controls + findings + KPIs.
//
// Replaces the hardcoded dimension_scores with a live computation across 5
// dimensions: control_coverage, control_effectiveness, kpi_performance,
// audit_health, documentation_completeness. Each is scored 1–5, the overall
// level is the rounded average. The result is written as a new
// process_maturity_assessment row (assessmentDate=today).

import { db, process, processMaturityAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";

interface DimensionScore {
  dimension: string;
  level: number; // 1–5
  basis: string;
}

function bucket(pct: number): number {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  if (pct >= 25) return 2;
  return 1;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "quality_manager", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const inputs = await withReadContext(ctx, async (tx) => {
    const [c] = (await tx.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM process_step WHERE process_id = ${id} AND deleted_at IS NULL)::int AS steps,
        (SELECT COUNT(*) FROM process_step WHERE process_id = ${id} AND deleted_at IS NULL
           AND (description IS NULL OR description = ''))::int AS steps_no_desc,
        (SELECT COUNT(DISTINCT control_id) FROM (
            SELECT control_id FROM process_control WHERE process_id = ${id}
            UNION
            SELECT psc.control_id FROM process_step_control psc
            JOIN process_step ps ON ps.id = psc.process_step_id
            WHERE ps.process_id = ${id}
          ) u)::int AS total_controls,
        (SELECT COUNT(DISTINCT u.control_id) FROM (
            SELECT control_id FROM process_control WHERE process_id = ${id}
            UNION
            SELECT psc.control_id FROM process_step_control psc
            JOIN process_step ps ON ps.id = psc.process_step_id
            WHERE ps.process_id = ${id}
          ) u JOIN control c ON c.id = u.control_id WHERE c.status = 'effective')::int AS effective_controls,
        (SELECT COUNT(*) FROM finding f
           WHERE f.org_id = ${ctx.orgId} AND f.deleted_at IS NULL
             AND f.status NOT IN ('verified','closed','cancelled','remediated')
             AND (f.process_id = ${id} OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${id}))
        )::int AS open_findings,
        (SELECT COUNT(*) FROM process_kpi_definition WHERE process_id = ${id} AND is_active = true)::int AS kpi_defs,
        (SELECT COUNT(*) FROM process_kpi_measurement m
           JOIN process_kpi_definition d ON d.id = m.kpi_definition_id
           WHERE d.process_id = ${id} AND m.status = 'green')::int AS kpi_green
    `)) as any[];
    return c;
  });

  const steps = Number(inputs?.steps ?? 0);
  const stepsNoDesc = Number(inputs?.steps_no_desc ?? 0);
  const total = Number(inputs?.total_controls ?? 0);
  const effective = Number(inputs?.effective_controls ?? 0);
  const openFindings = Number(inputs?.open_findings ?? 0);
  const kpiDefs = Number(inputs?.kpi_defs ?? 0);
  const kpiGreen = Number(inputs?.kpi_green ?? 0);

  const coveragePct = steps === 0 ? 0 : Math.min(100, (total / steps) * 100);
  const effectivenessPct = total === 0 ? 0 : (effective / total) * 100;
  const docPct = steps === 0 ? 0 : ((steps - stepsNoDesc) / steps) * 100;
  const kpiPct = kpiDefs === 0 ? 0 : (kpiGreen / kpiDefs) * 100;
  const auditPenalty = Math.max(0, 100 - openFindings * 15);

  const scores: DimensionScore[] = [
    { dimension: "control_coverage", level: bucket(coveragePct), basis: `${Math.round(coveragePct)}% coverage` },
    {
      dimension: "control_effectiveness",
      level: bucket(effectivenessPct),
      basis: `${effective}/${total} effective`,
    },
    { dimension: "kpi_performance", level: bucket(kpiPct), basis: `${kpiGreen}/${kpiDefs} green` },
    { dimension: "audit_health", level: bucket(auditPenalty), basis: `${openFindings} open findings` },
    {
      dimension: "documentation_completeness",
      level: bucket(docPct),
      basis: `${steps - stepsNoDesc}/${steps} activities described`,
    },
  ];

  const overall = Math.round(scores.reduce((a, s) => a + s.level, 0) / scores.length);

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(processMaturityAssessment)
        .values({
          orgId: ctx.orgId,
          processId: id,
          assessmentDate: new Date().toISOString().slice(0, 10),
          overallLevel: overall,
          dimensionScores: scores,
          assessorId: ctx.userId,
        })
        .returning();
      return row;
    },
    { actionDetail: "Maturity auto-computed" },
  );

  return Response.json({ data: { ...result, dimensions: scores, overall } });
}
