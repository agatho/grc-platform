import {
  db,
  rcsaCampaign,
  rcsaAssignment,
  rcsaResponse,
  rcsaResult,
  controlTest,
} from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AssignmentRow {
  id: string;
  campaignId: string;
  orgId: string;
  userId: string;
  entityType: string;
  entityId: string;
  status: string;
  deadline: Date;
  submittedAt: Date | null;
  remindersSent: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ResponseRow {
  id: string;
  assignmentId: string;
  orgId: string;
  riskStillRelevant: boolean | null;
  likelihoodAssessment: number | null;
  impactAssessment: number | null;
  riskTrend: string | null;
  controlEffectiveness: string | null;
  controlOperating: boolean | null;
  controlWeaknesses: string | null;
  comment: string | null;
  evidenceIds: unknown;
  confidence: number | null;
  respondedAt: Date;
}

// POST /api/v1/rcsa/campaigns/:id/close — Close campaign + compute results
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "active") {
    return Response.json(
      { error: "Only active campaigns can be closed" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Get all assignments
    const assignments: AssignmentRow[] = await tx
      .select()
      .from(rcsaAssignment)
      .where(eq(rcsaAssignment.campaignId, id));

    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter(
      (a: AssignmentRow) => a.status === "submitted",
    );
    const completedCount = completedAssignments.length;
    const completionRate =
      totalAssignments > 0
        ? ((completedCount / totalAssignments) * 100).toFixed(2)
        : "0.00";

    // Get all responses for submitted assignments
    const submittedIds = completedAssignments.map((a: AssignmentRow) => a.id);
    let responses: ResponseRow[] = [];

    if (submittedIds.length > 0) {
      responses = await tx
        .select()
        .from(rcsaResponse)
        .where(
          sql`${rcsaResponse.assignmentId} = ANY(${submittedIds}::uuid[])`,
        );
    }

    // Build a map of assignment to entity info
    const assignmentMap = new Map<string, AssignmentRow>(
      assignments.map((a: AssignmentRow) => [a.id, a]),
    );

    // Risk aggregations
    const riskResponses = responses.filter((r: ResponseRow) => {
      const assignment = assignmentMap.get(r.assignmentId);
      return assignment?.entityType === "risk";
    });

    const avgLikelihood =
      riskResponses.length > 0
        ? (
            riskResponses.reduce(
              (sum: number, r: ResponseRow) => sum + (r.likelihoodAssessment ?? 0),
              0,
            ) / riskResponses.length
          ).toFixed(2)
        : null;

    const avgImpact =
      riskResponses.length > 0
        ? (
            riskResponses.reduce(
              (sum: number, r: ResponseRow) => sum + (r.impactAssessment ?? 0),
              0,
            ) / riskResponses.length
          ).toFixed(2)
        : null;

    const risksIncreasing = riskResponses.filter(
      (r: ResponseRow) => r.riskTrend === "increasing",
    ).length;
    const risksStable = riskResponses.filter(
      (r: ResponseRow) => r.riskTrend === "stable",
    ).length;
    const risksDecreasing = riskResponses.filter(
      (r: ResponseRow) => r.riskTrend === "decreasing",
    ).length;

    // Control aggregations
    const controlResponses = responses.filter((r: ResponseRow) => {
      const assignment = assignmentMap.get(r.assignmentId);
      return assignment?.entityType === "control";
    });

    const controlsEffective = controlResponses.filter(
      (r: ResponseRow) => r.controlEffectiveness === "effective",
    ).length;
    const controlsPartial = controlResponses.filter(
      (r: ResponseRow) => r.controlEffectiveness === "partially_effective",
    ).length;
    const controlsIneffective = controlResponses.filter(
      (r: ResponseRow) => r.controlEffectiveness === "ineffective",
    ).length;

    // Compute discrepancies: RCSA vs latest control_test
    const discrepancies: Array<{
      entityType: string;
      entityId: string;
      rcsaRating: string;
      auditRating: string;
      type: string;
    }> = [];

    for (const response of controlResponses) {
      const assignment = assignmentMap.get(response.assignmentId);
      if (!assignment || !response.controlEffectiveness) continue;

      // Get latest control test result for this control
      const [latestTest] = await tx
        .select()
        .from(controlTest)
        .where(
          and(
            eq(controlTest.controlId, assignment.entityId),
            eq(controlTest.orgId, ctx.orgId),
          ),
        )
        .orderBy(desc(controlTest.createdAt))
        .limit(1);

      if (!latestTest) continue;

      // Check within 12 months
      const testDate = latestTest.createdAt;
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      if (testDate < twelveMonthsAgo) continue;

      const auditResult = latestTest.toeResult ?? latestTest.todResult;
      if (!auditResult) continue;

      // Overconfident: RCSA says effective, audit says ineffective
      if (
        response.controlEffectiveness === "effective" &&
        auditResult === "ineffective"
      ) {
        discrepancies.push({
          entityType: "control",
          entityId: assignment.entityId,
          rcsaRating: "effective",
          auditRating: "ineffective",
          type: "overconfident",
        });
      }

      // Underconfident: RCSA says ineffective, audit says effective
      if (
        response.controlEffectiveness === "ineffective" &&
        auditResult === "effective"
      ) {
        discrepancies.push({
          entityType: "control",
          entityId: assignment.entityId,
          rcsaRating: "ineffective",
          auditRating: "effective",
          type: "underconfident",
        });
      }
    }

    // Delete existing result if any (re-computation)
    await tx.delete(rcsaResult).where(eq(rcsaResult.campaignId, id));

    // Insert result
    const [resultRow] = await tx
      .insert(rcsaResult)
      .values({
        campaignId: id,
        orgId: ctx.orgId,
        totalAssignments,
        completedCount,
        completionRate,
        avgLikelihood,
        avgImpact,
        risksIncreasing,
        risksStable,
        risksDecreasing,
        controlsEffective,
        controlsPartial,
        controlsIneffective,
        discrepancyCount: discrepancies.length,
        discrepancies,
        computedAt: new Date(),
      })
      .returning();

    // Update campaign status to closed
    const [updated] = await tx
      .update(rcsaCampaign)
      .set({
        status: "closed",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rcsaCampaign.id, id))
      .returning();

    return {
      campaign: updated,
      result: resultRow,
    };
  });

  return Response.json({ data: result });
}
