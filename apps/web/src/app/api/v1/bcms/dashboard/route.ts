import { db, biaAssessment, biaProcessImpact, bcp, crisisScenario, bcExercise, bcExerciseFinding } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/bcms/dashboard — BCMS Dashboard KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const orgId = ctx.orgId;

  // Run all queries in parallel
  const [
    essentialProcesses,
    totalBiaImpacts,
    assessedBiaImpacts,
    activeBcps,
    crisisScenarios,
    activeCrises,
    exercisesCompleted,
    exercisesPlanned,
    openFindings,
    avgRto,
  ] = await Promise.all([
    // Essential processes count
    db
      .select({ value: count() })
      .from(biaProcessImpact)
      .where(and(eq(biaProcessImpact.orgId, orgId), eq(biaProcessImpact.isEssential, true))),
    // Total BIA impacts
    db
      .select({ value: count() })
      .from(biaProcessImpact)
      .where(eq(biaProcessImpact.orgId, orgId)),
    // Assessed BIA impacts (have rto set)
    db
      .select({ value: count() })
      .from(biaProcessImpact)
      .where(and(eq(biaProcessImpact.orgId, orgId), sql`${biaProcessImpact.rtoHours} IS NOT NULL`)),
    // Active BCPs (published)
    db
      .select({ value: count() })
      .from(bcp)
      .where(and(eq(bcp.orgId, orgId), eq(bcp.status, "published"), isNull(bcp.deletedAt))),
    // Total crisis scenarios
    db
      .select({ value: count() })
      .from(crisisScenario)
      .where(eq(crisisScenario.orgId, orgId)),
    // Active crises
    db
      .select({ value: count() })
      .from(crisisScenario)
      .where(and(eq(crisisScenario.orgId, orgId), eq(crisisScenario.status, "activated"))),
    // Completed exercises
    db
      .select({ value: count() })
      .from(bcExercise)
      .where(and(eq(bcExercise.orgId, orgId), eq(bcExercise.status, "completed"))),
    // Planned exercises
    db
      .select({ value: count() })
      .from(bcExercise)
      .where(and(eq(bcExercise.orgId, orgId), eq(bcExercise.status, "planned"))),
    // Open exercise findings (no linked finding)
    db
      .select({ value: count() })
      .from(bcExerciseFinding)
      .where(and(eq(bcExerciseFinding.orgId, orgId), isNull(bcExerciseFinding.findingId))),
    // Average RTO
    db
      .select({ value: sql<string>`ROUND(AVG(${biaProcessImpact.rtoHours}), 1)` })
      .from(biaProcessImpact)
      .where(and(eq(biaProcessImpact.orgId, orgId), sql`${biaProcessImpact.rtoHours} IS NOT NULL`)),
  ]);

  const totalImpacts = totalBiaImpacts[0].value;
  const assessed = assessedBiaImpacts[0].value;
  const biaCompletionPct = totalImpacts > 0 ? Math.round((assessed / totalImpacts) * 100) : 0;

  // BCP coverage: essential processes covered by a published BCP
  const essentialCount = essentialProcesses[0].value;
  const publishedBcpCount = activeBcps[0].value;
  const bcpCoveragePct = essentialCount > 0 ? Math.min(100, Math.round((publishedBcpCount / essentialCount) * 100)) : 0;

  const dashboard = {
    essentialProcessCount: essentialCount,
    biaCompletionPct,
    activeBcpCount: publishedBcpCount,
    bcpCoveragePct,
    crisisScenarioCount: crisisScenarios[0].value,
    activeCrisisCount: activeCrises[0].value,
    exercisesCompleted: exercisesCompleted[0].value,
    exercisesPlanned: exercisesPlanned[0].value,
    openExerciseFindings: openFindings[0].value,
    avgRtoHours: avgRto[0].value ? parseFloat(avgRto[0].value) : null,
  };

  return Response.json({ data: dashboard });
}
