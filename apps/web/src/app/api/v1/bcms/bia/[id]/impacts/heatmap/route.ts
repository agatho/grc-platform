import { db, biaProcessImpact, biaAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/bia/[id]/impacts/heatmap — Heatmap data for BIA
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: biaId } = await params;

  // Verify BIA exists
  const [bia] = await db
    .select({ id: biaAssessment.id })
    .from(biaAssessment)
    .where(
      and(eq(biaAssessment.id, biaId), eq(biaAssessment.orgId, ctx.orgId)),
    );

  if (!bia) {
    return Response.json(
      { error: "BIA assessment not found" },
      { status: 404 },
    );
  }

  const impacts = await db
    .select()
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, biaId),
        eq(biaProcessImpact.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(biaProcessImpact.isEssential));

  // Compute heatmap: max qualitative score determines color
  const heatmapData = impacts.map((imp) => {
    const qualScores = [
      imp.impactReputation,
      imp.impactLegal,
      imp.impactOperational,
      imp.impactFinancial,
      imp.impactSafety,
    ].filter((s): s is number => s != null);
    const maxQual = qualScores.length > 0 ? Math.max(...qualScores) : 0;

    return {
      id: imp.id,
      processId: imp.processId,
      mtpdHours: imp.mtpdHours,
      rtoHours: imp.rtoHours,
      rpoHours: imp.rpoHours,
      impact24h: imp.impact24h,
      impactReputation: imp.impactReputation,
      maxQualitativeScore: maxQual,
      priorityRanking: imp.priorityRanking,
      isEssential: imp.isEssential,
      severity:
        maxQual >= 5
          ? "critical"
          : maxQual >= 4
            ? "high"
            : maxQual >= 3
              ? "medium"
              : "low",
    };
  });

  return Response.json({ data: heatmapData });
});
