import { db, rcsaResult, rcsaCampaign } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/campaigns/:id/export-pdf — PDF report (JSON for client-side rendering)
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: RouteParams,
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(and(eq(rcsaCampaign.id, id), eq(rcsaCampaign.orgId, ctx.orgId)));

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [result] = await db
    .select()
    .from(rcsaResult)
    .where(and(eq(rcsaResult.campaignId, id), eq(rcsaResult.orgId, ctx.orgId)));

  if (!result) {
    return Response.json(
      { error: "Results not yet computed. Close the campaign first." },
      { status: 404 },
    );
  }

  // Return structured data for client-side PDF generation
  const reportData = {
    campaign: {
      name: campaign.name,
      description: campaign.description,
      periodStart: campaign.periodStart,
      periodEnd: campaign.periodEnd,
      frequency: campaign.frequency,
      status: campaign.status,
    },
    results: {
      totalAssignments: result.totalAssignments,
      completedCount: result.completedCount,
      completionRate: result.completionRate,
      avgLikelihood: result.avgLikelihood,
      avgImpact: result.avgImpact,
      risksIncreasing: result.risksIncreasing,
      risksStable: result.risksStable,
      risksDecreasing: result.risksDecreasing,
      controlsEffective: result.controlsEffective,
      controlsPartial: result.controlsPartial,
      controlsIneffective: result.controlsIneffective,
      discrepancyCount: result.discrepancyCount,
      discrepancies: result.discrepancies,
    },
    generatedAt: new Date().toISOString(),
  };

  return Response.json({ data: reportData });
});
