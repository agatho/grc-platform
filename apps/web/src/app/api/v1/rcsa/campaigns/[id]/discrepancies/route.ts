import { db, rcsaResult, rcsaCampaign, control } from "@grc/db";
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

// GET /api/v1/rcsa/campaigns/:id/discrepancies — 1st line vs 3rd line mismatches
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: RouteParams,
) {
  const ctx = await withAuth();
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

  const rawDiscrepancies =
    (result.discrepancies as Array<{
      entityType: string;
      entityId: string;
      rcsaRating: string;
      auditRating: string;
      type: string;
    }>) ?? [];

  // Enrich with entity titles
  const enriched = await Promise.all(
    rawDiscrepancies.map(async (d) => {
      let entityTitle: string | undefined;
      if (d.entityType === "control") {
        const [c] = await db
          .select({ title: control.title })
          .from(control)
          .where(eq(control.id, d.entityId));
        entityTitle = c?.title;
      }
      return {
        ...d,
        entityTitle,
      };
    }),
  );

  return Response.json({
    data: enriched,
    meta: { total: enriched.length },
  });
});
