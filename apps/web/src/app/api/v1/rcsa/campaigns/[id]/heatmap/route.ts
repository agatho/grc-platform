import {
  db,
  rcsaAssignment,
  rcsaResponse,
  rcsaCampaign,
  risk,
  control,
} from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id/heatmap — Department x Category heatmap data
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get all assignments with responses for this campaign
  const assignments = await db
    .select()
    .from(rcsaAssignment)
    .where(
      and(
        eq(rcsaAssignment.campaignId, id),
        eq(rcsaAssignment.status, "submitted"),
      ),
    );

  const heatmapData: Array<{
    department: string;
    category: string;
    avgScore: number;
    count: number;
  }> = [];

  const cellMap = new Map<string, { totalScore: number; count: number }>();

  for (const assignment of assignments) {
    let department = "Unknown";
    let category = "Unknown";

    if (assignment.entityType === "risk") {
      const [r] = await db
        .select({ department: risk.department, category: risk.riskCategory })
        .from(risk)
        .where(eq(risk.id, assignment.entityId));
      department = r?.department ?? "Unknown";
      category = r?.category ?? "Unknown";
    } else {
      const [c] = await db
        .select({
          department: control.department,
          controlType: control.controlType,
        })
        .from(control)
        .where(eq(control.id, assignment.entityId));
      department = c?.department ?? "Unknown";
      category = c?.controlType ?? "Unknown";
    }

    // Get response
    const [response] = await db
      .select()
      .from(rcsaResponse)
      .where(eq(rcsaResponse.assignmentId, assignment.id))
      .limit(1);

    if (!response) continue;

    let score = 0;
    if (
      assignment.entityType === "risk" &&
      response.likelihoodAssessment &&
      response.impactAssessment
    ) {
      score = response.likelihoodAssessment * response.impactAssessment;
    } else if (assignment.entityType === "control") {
      if (response.controlEffectiveness === "effective") score = 1;
      else if (response.controlEffectiveness === "partially_effective")
        score = 2;
      else if (response.controlEffectiveness === "ineffective") score = 3;
    }

    const key = `${department}|${category}`;
    const existing = cellMap.get(key) ?? { totalScore: 0, count: 0 };
    existing.totalScore += score;
    existing.count += 1;
    cellMap.set(key, existing);
  }

  for (const [key, value] of cellMap.entries()) {
    const [department, category] = key.split("|");
    heatmapData.push({
      department,
      category,
      avgScore:
        value.count > 0
          ? Math.round((value.totalScore / value.count) * 100) / 100
          : 0,
      count: value.count,
    });
  }

  return Response.json({ data: heatmapData });
}
