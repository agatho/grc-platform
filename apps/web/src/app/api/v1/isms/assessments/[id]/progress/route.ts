import { db, assessmentControlEval, assessmentRiskEval } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/assessments/[id]/progress
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Control evaluation stats
  const [controlStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where result != 'not_evaluated')::int`,
      effective: sql<number>`count(*) filter (where result = 'effective')::int`,
      partiallyEffective: sql<number>`count(*) filter (where result = 'partially_effective')::int`,
      ineffective: sql<number>`count(*) filter (where result = 'ineffective')::int`,
      notApplicable: sql<number>`count(*) filter (where result = 'not_applicable')::int`,
      notEvaluated: sql<number>`count(*) filter (where result = 'not_evaluated')::int`,
    })
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ),
    );

  // Risk evaluation stats
  const [riskStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where decision != 'pending')::int`,
      accept: sql<number>`count(*) filter (where decision = 'accept')::int`,
      mitigate: sql<number>`count(*) filter (where decision = 'mitigate')::int`,
      transfer: sql<number>`count(*) filter (where decision = 'transfer')::int`,
      avoid: sql<number>`count(*) filter (where decision = 'avoid')::int`,
    })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, id),
        eq(assessmentRiskEval.orgId, ctx.orgId),
      ),
    );

  // Maturity averages
  const [maturityStats] = await db
    .select({
      avgCurrent: sql<number>`round(avg(current_maturity)::numeric, 1)`,
      avgTarget: sql<number>`round(avg(target_maturity)::numeric, 1)`,
    })
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
        sql`current_maturity is not null`,
      ),
    );

  const completionPercentage =
    controlStats.total > 0
      ? Math.round((controlStats.completed / controlStats.total) * 100)
      : 0;

  return Response.json({
    data: {
      controls: {
        ...controlStats,
        completionPercentage,
      },
      risks: riskStats,
      maturity: {
        avgCurrent: maturityStats.avgCurrent ?? 0,
        avgTarget: maturityStats.avgTarget ?? 0,
        avgGap: Number(
          (
            (maturityStats.avgTarget ?? 0) - (maturityStats.avgCurrent ?? 0)
          ).toFixed(1),
        ),
      },
    },
  });
}
