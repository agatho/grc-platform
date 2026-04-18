// POST /api/v1/ai-act/systems/[id]/oversight-check
//
// Sprint 5.4: Art. 14 Human-Oversight-Design-Check + Oversight-Log-Quality.

import { db, aiSystem, aiHumanOversightLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessHumanOversight,
  assessOversightLogQuality,
  type HumanOversightDesign,
  type OversightLogStats,
} from "@grc/shared";
import { and, eq, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  hasUnderstandableOutputs: z.boolean().default(false),
  hasOverrideCapability: z.boolean().default(false),
  hasStopFunction: z.boolean().default(false),
  hasAutomationBiasTraining: z.boolean().default(false),
  hasDefinedRoles: z.boolean().default(false),
  assignedOversightPersonnel: z.number().int().nonnegative().default(0),
  oversightFrequency: z
    .enum(["continuous", "periodic", "on_demand", "none"])
    .default("none"),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [system] = await db
    .select({ id: aiSystem.id, riskClassification: aiSystem.riskClassification })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const design: HumanOversightDesign = parsed.data;
  const designResult = assessHumanOversight(design);

  // Aktuelle Log-Stats ermitteln
  const [counts] = await db
    .select({
      totalLogs: sql<number>`count(*)::int`,
      overrideCount: sql<number>`count(*) filter (where ${aiHumanOversightLog.logType} = 'decision_override')::int`,
      interventionCount: sql<number>`count(*) filter (where ${aiHumanOversightLog.logType} = 'intervention')::int`,
      monitoringCheckCount: sql<number>`count(*) filter (where ${aiHumanOversightLog.logType} = 'monitoring_check')::int`,
      highRiskLogsCount: sql<number>`count(*) filter (where ${aiHumanOversightLog.riskLevel} in ('high','critical'))::int`,
    })
    .from(aiHumanOversightLog)
    .where(
      and(
        eq(aiHumanOversightLog.orgId, ctx.orgId),
        eq(aiHumanOversightLog.aiSystemId, id),
      ),
    );

  const [latest] = await db
    .select({ createdAt: aiHumanOversightLog.createdAt })
    .from(aiHumanOversightLog)
    .where(
      and(
        eq(aiHumanOversightLog.orgId, ctx.orgId),
        eq(aiHumanOversightLog.aiSystemId, id),
      ),
    )
    .orderBy(desc(aiHumanOversightLog.createdAt))
    .limit(1);

  const daysSinceLastLog = latest?.createdAt
    ? Math.floor(
        (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const stats: OversightLogStats = {
    totalLogs: counts?.totalLogs ?? 0,
    overrideCount: counts?.overrideCount ?? 0,
    interventionCount: counts?.interventionCount ?? 0,
    monitoringCheckCount: counts?.monitoringCheckCount ?? 0,
    highRiskLogsCount: counts?.highRiskLogsCount ?? 0,
    daysSinceLastLog,
  };

  const logQuality = assessOversightLogQuality(stats);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      design: {
        designCompleteness: designResult.designCompleteness,
        isAdequate: designResult.isAdequate,
        gaps: designResult.gaps,
        warnings: designResult.warnings,
      },
      logs: {
        stats,
        activityLevel: logQuality.activityLevel,
        overrideRate: logQuality.overrideRate,
        hasRecentActivity: logQuality.hasRecentActivity,
        warnings: logQuality.warnings,
      },
    },
  });
}
