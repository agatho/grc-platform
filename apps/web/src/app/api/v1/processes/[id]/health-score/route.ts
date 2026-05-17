// BPM Overhaul Phase 8: 360° Process Health Score (0–100).
//
// Combines risk pressure, control coverage, control effectiveness, open
// findings, and maturity into a single score. Cheap aggregation, computed
// per call (no caching yet).

import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

interface Component {
  key: string;
  score: number;          // 0–100, higher = healthier
  weight: number;         // sums to 1.0 across components
  note: string;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id, name: process.name, status: process.status })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const [risks] = (await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(r.risk_score_residual), 0)::float AS avg_residual,
        COALESCE(MAX(r.risk_score_residual), 0)::int AS max_residual,
        SUM(CASE WHEN r.risk_score_residual >= 15 THEN 1 ELSE 0 END)::int AS critical
      FROM (
        SELECT risk_id FROM process_risk WHERE process_id = ${id}
        UNION
        SELECT psr.risk_id FROM process_step_risk psr
        JOIN process_step ps ON ps.id = psr.process_step_id
        WHERE ps.process_id = ${id}
      ) AS uniq
      JOIN risk r ON r.id = uniq.risk_id AND r.deleted_at IS NULL
    `)) as any[];

    const [controls] = (await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN c.status = 'effective' THEN 1 ELSE 0 END)::int AS effective,
        SUM(CASE WHEN c.status = 'ineffective' THEN 1 ELSE 0 END)::int AS ineffective
      FROM (
        SELECT control_id FROM process_control WHERE process_id = ${id}
        UNION
        SELECT psc.control_id FROM process_step_control psc
        JOIN process_step ps ON ps.id = psc.process_step_id
        WHERE ps.process_id = ${id}
      ) AS uniq
      JOIN control c ON c.id = uniq.control_id AND c.deleted_at IS NULL
    `)) as any[];

    const [findings] = (await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE f.status NOT IN ('verified', 'closed', 'cancelled', 'remediated'))::int AS open_count,
        COUNT(*) FILTER (WHERE f.severity = 'critical' AND f.status NOT IN ('verified', 'closed', 'cancelled', 'remediated'))::int AS open_critical
      FROM finding f
      WHERE f.org_id = ${ctx.orgId}
        AND f.deleted_at IS NULL
        AND (
          f.process_id = ${id}
          OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${id})
        )
    `)) as any[];

    const [maturity] = (await tx.execute(sql`
      SELECT overall_level::int AS level
      FROM process_maturity_assessment
      WHERE process_id = ${id} AND org_id = ${ctx.orgId}
      ORDER BY assessment_date DESC
      LIMIT 1
    `)) as any[];

    const [steps] = (await tx.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM process_step
      WHERE process_id = ${id} AND deleted_at IS NULL
    `)) as any[];

    return { risks, controls, findings, maturity, steps };
  });

  const components: Component[] = [];

  // 1. Risk pressure (lower residual = higher score)
  const avgRes = Number(data.risks?.avg_residual ?? 0);
  const riskScore = clamp(100 - avgRes * 4); // 25 residual → 0
  components.push({
    key: "risk_pressure",
    score: Math.round(riskScore),
    weight: 0.25,
    note: `Avg residual ${avgRes.toFixed(1)}, ${data.risks?.critical ?? 0} critical`,
  });

  // 2. Control coverage = controls / activities (saturates at 1+/activity)
  const totalSteps = Number(data.steps?.total ?? 0);
  const totalControls = Number(data.controls?.total ?? 0);
  const coverage = totalSteps === 0 ? 0 : Math.min(1, totalControls / totalSteps);
  components.push({
    key: "control_coverage",
    score: Math.round(coverage * 100),
    weight: 0.2,
    note: `${totalControls} controls for ${totalSteps} activities`,
  });

  // 3. Control effectiveness = effective / total controls
  const eff = totalControls === 0 ? 0 : Number(data.controls?.effective ?? 0) / totalControls;
  components.push({
    key: "control_effectiveness",
    score: Math.round(eff * 100),
    weight: 0.2,
    note: `${data.controls?.effective ?? 0}/${totalControls} effective`,
  });

  // 4. Open findings (each open critical −20, others −5)
  const openCritical = Number(data.findings?.open_critical ?? 0);
  const openTotal = Number(data.findings?.open_count ?? 0);
  const findingScore = clamp(100 - openCritical * 20 - (openTotal - openCritical) * 5);
  components.push({
    key: "findings",
    score: Math.round(findingScore),
    weight: 0.2,
    note: `${openTotal} open (${openCritical} critical)`,
  });

  // 5. Maturity (1–5 scale → 20/40/60/80/100)
  const maturityLevel = Number(data.maturity?.level ?? 0);
  components.push({
    key: "maturity",
    score: maturityLevel > 0 ? maturityLevel * 20 : 0,
    weight: 0.15,
    note: maturityLevel ? `Level ${maturityLevel}` : "Not assessed",
  });

  const overall = Math.round(
    components.reduce((acc, c) => acc + c.score * c.weight, 0),
  );

  let band: "critical" | "at_risk" | "good" | "excellent" = "critical";
  if (overall >= 85) band = "excellent";
  else if (overall >= 70) band = "good";
  else if (overall >= 50) band = "at_risk";

  return Response.json({
    data: {
      processId: id,
      processName: existing.name,
      processStatus: existing.status,
      overall,
      band,
      components,
      computedAt: new Date().toISOString(),
    },
  });
}
