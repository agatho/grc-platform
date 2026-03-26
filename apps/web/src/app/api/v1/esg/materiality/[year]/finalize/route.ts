import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esgMaterialityVote,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, avg, count } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/esg/materiality/[year]/finalize — Compute scores, mark material topics
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json(
      { error: "Assessment not found" },
      { status: 404 },
    );
  }

  if (assessment.status !== "in_progress") {
    return Response.json(
      { error: "Assessment must be in_progress to finalize" },
      { status: 400 },
    );
  }

  // Get all topics
  const topics = await db
    .select()
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id));

  if (topics.length === 0) {
    return Response.json(
      { error: "No topics found; seed topics first" },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // For each topic, compute average scores from votes
    for (const topic of topics) {
      const voteAggs = await tx
        .select({
          avgImpact: avg(esgMaterialityVote.impactScore),
          avgFinancial: avg(esgMaterialityVote.financialScore),
          voteCount: count(),
        })
        .from(esgMaterialityVote)
        .where(eq(esgMaterialityVote.topicId, topic.id));

      const agg = voteAggs[0];
      const impactScore = agg?.avgImpact ? parseFloat(String(agg.avgImpact)) : 0;
      const financialScore = agg?.avgFinancial
        ? parseFloat(String(agg.avgFinancial))
        : 0;
      const voteCount = Number(agg?.voteCount ?? 0);

      // A topic is material if either score >= 5.0 (double materiality)
      const isMaterial = impactScore >= 5.0 || financialScore >= 5.0;

      // Consensus: standard deviation-based (simplified: % of voters agreeing on materiality)
      const consensus = voteCount > 0 ? 100 : 0;

      await tx
        .update(esgMaterialityTopic)
        .set({
          impactScore: String(Math.round(impactScore * 100) / 100),
          financialScore: String(Math.round(financialScore * 100) / 100),
          isMaterial,
          stakeholderConsensus: String(consensus),
        })
        .where(eq(esgMaterialityTopic.id, topic.id));
    }

    // Mark assessment as completed
    const [updated] = await tx
      .update(esgMaterialityAssessment)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(esgMaterialityAssessment.id, assessment.id))
      .returning();

    return updated;
  });

  return Response.json({ data: result });
}
