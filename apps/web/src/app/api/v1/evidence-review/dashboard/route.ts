import { db, evidenceReviewJob, evidenceReviewGap, evidenceReviewResult } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/evidence-review/dashboard — Dashboard stats
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const [summary] = await db
    .select({
      totalJobs: sql<number>`count(*)`,
      completedJobs: sql<number>`count(*) filter (where ${evidenceReviewJob.status} = 'completed')`,
      totalArtifactsReviewed: sql<number>`coalesce(sum(${evidenceReviewJob.totalArtifacts}), 0)`,
      totalCompliant: sql<number>`coalesce(sum(${evidenceReviewJob.compliantArtifacts}), 0)`,
      totalNonCompliant: sql<number>`coalesce(sum(${evidenceReviewJob.nonCompliantArtifacts}), 0)`,
      totalGaps: sql<number>`coalesce(sum(${evidenceReviewJob.gapsIdentified}), 0)`,
      avgConfidence: sql<number>`coalesce(avg(${evidenceReviewJob.overallConfidence}), 0)`,
    })
    .from(evidenceReviewJob)
    .where(eq(evidenceReviewJob.orgId, ctx.orgId));

  const recentJobs = await db.select().from(evidenceReviewJob)
    .where(eq(evidenceReviewJob.orgId, ctx.orgId))
    .orderBy(desc(evidenceReviewJob.createdAt))
    .limit(5);

  const topGaps = await db.select().from(evidenceReviewGap)
    .where(and(eq(evidenceReviewGap.orgId, ctx.orgId), eq(evidenceReviewGap.status, "open")))
    .orderBy(desc(evidenceReviewGap.createdAt))
    .limit(10);

  const classificationBreakdown = await db
    .select({
      classification: evidenceReviewResult.classification,
      count: sql<number>`count(*)`,
    })
    .from(evidenceReviewResult)
    .where(eq(evidenceReviewResult.orgId, ctx.orgId))
    .groupBy(evidenceReviewResult.classification);

  return Response.json({
    data: {
      summary,
      recentJobs,
      topGaps,
      classificationBreakdown: Object.fromEntries(
        classificationBreakdown.map((r) => [r.classification, Number(r.count)]),
      ),
    },
  });
}
