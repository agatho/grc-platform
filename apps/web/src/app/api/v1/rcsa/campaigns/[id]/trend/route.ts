import { db, rcsaResult, rcsaCampaign } from "@grc/db";
import { eq, and, lt, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id/trend — Current vs previous campaign comparison
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Get current campaign
  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get current result
  const [currentResult] = await db
    .select()
    .from(rcsaResult)
    .where(and(eq(rcsaResult.campaignId, id), eq(rcsaResult.orgId, ctx.orgId)));

  if (!currentResult) {
    return Response.json(
      { error: "Results not yet computed. Close the campaign first." },
      { status: 404 },
    );
  }

  // Find the previous closed campaign (same org, closed before current)
  const [previousCampaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(
      and(
        eq(rcsaCampaign.orgId, ctx.orgId),
        eq(rcsaCampaign.status, "closed"),
        lt(rcsaCampaign.closedAt, campaign.closedAt ?? campaign.createdAt),
      ),
    )
    .orderBy(desc(rcsaCampaign.closedAt))
    .limit(1);

  let previousResult: typeof currentResult | null = null;
  if (previousCampaign) {
    const [prev] = await db
      .select()
      .from(rcsaResult)
      .where(eq(rcsaResult.campaignId, previousCampaign.id));
    previousResult = prev ?? null;
  }

  const toNum = (v: string | null | undefined): number => Number(v ?? 0);

  const deltas = previousResult
    ? {
        completionRate: toNum(currentResult.completionRate) - toNum(previousResult.completionRate),
        avgLikelihood: toNum(currentResult.avgLikelihood) - toNum(previousResult.avgLikelihood),
        avgImpact: toNum(currentResult.avgImpact) - toNum(previousResult.avgImpact),
        controlsEffective: (currentResult.controlsEffective ?? 0) - (previousResult.controlsEffective ?? 0),
        discrepancyCount: (currentResult.discrepancyCount ?? 0) - (previousResult.discrepancyCount ?? 0),
      }
    : {
        completionRate: 0,
        avgLikelihood: 0,
        avgImpact: 0,
        controlsEffective: 0,
        discrepancyCount: 0,
      };

  return Response.json({
    data: {
      current: currentResult,
      previous: previousResult,
      previousCampaignName: previousCampaign?.name ?? null,
      deltas,
      hasPreviousData: !!previousResult,
    },
  });
}
