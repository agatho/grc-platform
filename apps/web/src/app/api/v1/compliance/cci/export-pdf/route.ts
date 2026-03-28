import { db, complianceCultureSnapshot } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { getTopImprovementAreas, CCI_FACTOR_KEYS } from "@grc/shared";
import type { CCIFactorScores, CCIRawMetrics, CCIFactorKey } from "@grc/shared";

// POST /api/v1/compliance/cci/export-pdf — PDF export (returns JSON summary for now)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  // Get latest org-wide snapshot
  const [latest] = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
      ),
    )
    .orderBy(desc(complianceCultureSnapshot.period))
    .limit(1);

  if (!latest) {
    return Response.json(
      { error: "No CCI data available for export" },
      { status: 404 },
    );
  }

  const factorScores = latest.factorScores as CCIFactorScores;
  const rawMetrics = latest.rawMetrics as CCIRawMetrics;
  const improvementAreas = getTopImprovementAreas(factorScores, 3);

  const factorLabels: Record<CCIFactorKey, string> = {
    task_compliance: "Task Compliance",
    policy_ack_rate: "Policy Acknowledgment Rate",
    training_completion: "Training Completion",
    incident_response_time: "Incident Response Time",
    audit_finding_closure: "Audit Finding Closure",
    self_assessment_participation: "Self-Assessment Participation",
  };

  const exportData = {
    title: "Compliance Culture Index Report",
    period: latest.period,
    generatedAt: new Date().toISOString(),
    overallScore: Number(latest.overallScore),
    trend: latest.trend,
    factors: CCI_FACTOR_KEYS.map((key) => ({
      name: factorLabels[key],
      score: factorScores[key] ?? 0,
      rawMetric: rawMetrics[key] ?? { total: 0, successful: 0 },
    })),
    topImprovementAreas: improvementAreas.map((area) => ({
      name: factorLabels[area.key],
      score: area.score,
    })),
  };

  return Response.json({ data: exportData });
}
