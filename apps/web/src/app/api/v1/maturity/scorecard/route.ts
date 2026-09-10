import { db, maturityModel, benchmarkPool } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { maturityScorecardQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/maturity/scorecard — Board-ready maturity scorecard
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = maturityScorecardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  // Get all maturity models for this org
  const models = await db
    .select()
    .from(maturityModel)
    .where(eq(maturityModel.orgId, ctx.orgId));

  // Build scorecard
  const scorecard = models.map((m) => ({
    moduleKey: m.moduleKey,
    currentLevel: m.currentLevel,
    targetLevel: m.targetLevel,
    targetDate: m.targetDate,
    scoreBreakdown: m.scoreBreakdown,
    lastCalculatedAt: m.lastCalculatedAt,
  }));

  const benchmarks: Record<string, unknown> = {};
  if (query.compareBenchmark && query.industry) {
    const poolData = await db
      .select()
      .from(benchmarkPool)
      .where(eq(benchmarkPool.industry, query.industry));
    for (const p of poolData) {
      benchmarks[p.moduleKey] = {
        avgScore: p.avgScore,
        medianScore: p.medianScore,
        p25Score: p.p25Score,
        p75Score: p.p75Score,
        participantCount: p.participantCount,
      };
    }
  }

  return Response.json({
    data: {
      modules: scorecard,
      benchmarks: query.compareBenchmark ? benchmarks : undefined,
      generatedAt: new Date().toISOString(),
    },
  });
});
