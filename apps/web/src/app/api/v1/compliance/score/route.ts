// GET /api/v1/compliance/score — single-number compliance posture (0-100).
//
// #WAVE14-CROSS-05: many compliance dashboards need one headline number.
// This composite blends three independent signals so a single weak axis
// can't dominate (or hide behind a strong one):
//
//   * Coverage   — average framework coverage % (Q: do we have controls?)
//   * Effective  — control-test pass rate            (Q: do they work?)
//   * Maturity   — average current/target ratio      (Q: are they mature?)
//
// All three are weighted equally. The arithmetic mean is intentional:
// an org with 100% coverage but 0% effective controls scores ~33, not
// ~50, which matches how an auditor would read the situation.
//
// Anything missing (no analyses, no tests, no maturity rows) contributes
// 0 to its sub-score; the field's presence in the response (`hasData`)
// lets the UI hide misleading components instead of rendering "0".

import {
  db,
  frameworkGapAnalysis,
  control,
  controlTest,
  controlMaturity,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // ── Coverage signal ─────────────────────────────────────────────
  // Latest analysis per framework, then average. Mirrors
  // /compliance/coverage so the headline matches the breakdown.
  const recentAnalyses = await db
    .select({
      framework: frameworkGapAnalysis.framework,
      coveragePct: frameworkGapAnalysis.coveragePercentage,
      analysisDate: frameworkGapAnalysis.analysisDate,
    })
    .from(frameworkGapAnalysis)
    .where(eq(frameworkGapAnalysis.orgId, ctx.orgId))
    .orderBy(sql`${frameworkGapAnalysis.analysisDate} DESC`)
    .limit(50);

  const latestByFramework = new Map<string, number>();
  for (const a of recentAnalyses) {
    if (!latestByFramework.has(a.framework)) {
      latestByFramework.set(a.framework, Number(a.coveragePct));
    }
  }
  const coverageValues = Array.from(latestByFramework.values());
  const coverageScore =
    coverageValues.length > 0
      ? Math.round(
          coverageValues.reduce((s, v) => s + v, 0) / coverageValues.length,
        )
      : 0;

  // ── Effectiveness signal ────────────────────────────────────────
  // Same partial-weight rule as /controls/effectiveness so the two
  // numbers stay aligned.
  const [eff] = await db
    .select({
      effective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'effective')::int`,
      partial: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'partially_effective')::int`,
      ineffective: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'ineffective')::int`,
    })
    .from(control)
    .leftJoin(controlTest, eq(controlTest.controlId, control.id))
    .where(
      and(
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
        isNull(controlTest.deletedAt),
      ),
    );
  const tested =
    (eff?.effective ?? 0) + (eff?.partial ?? 0) + (eff?.ineffective ?? 0);
  const effectivenessScore =
    tested > 0
      ? Math.round(
          (((eff?.effective ?? 0) + (eff?.partial ?? 0) * 0.5) / tested) * 100,
        )
      : 0;

  // ── Maturity signal ─────────────────────────────────────────────
  // Average (current/target) ratio across all assessed controls. The
  // CMMI scale is 1–5; expressing as % keeps the three signals in the
  // same unit before the composite mean.
  const [mat] = await db
    .select({
      currentSum: sql<number>`coalesce(sum(${controlMaturity.currentMaturity}), 0)::int`,
      targetSum: sql<number>`coalesce(sum(${controlMaturity.targetMaturity}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(controlMaturity)
    .where(eq(controlMaturity.orgId, ctx.orgId));
  const maturityScore =
    mat && mat.n > 0 && mat.targetSum > 0
      ? Math.min(100, Math.round((mat.currentSum / mat.targetSum) * 100))
      : 0;

  const components = {
    coverage: { score: coverageScore, hasData: coverageValues.length > 0 },
    effectiveness: { score: effectivenessScore, hasData: tested > 0 },
    maturity: { score: maturityScore, hasData: (mat?.n ?? 0) > 0 },
  };

  // Composite: arithmetic mean across the three signals so missing data
  // pulls the headline down (which is what an auditor would see).
  const overall = Math.round(
    (coverageScore + effectivenessScore + maturityScore) / 3,
  );

  return Response.json({
    data: {
      overall,
      components,
      asOf: new Date().toISOString(),
    },
  });
});
