import { db, risk, riskControl, controlEffectivenessScore } from "@grc/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { computeResidualScore } from "@grc/shared";

// POST /api/v1/erm/residual/recompute — Force recompute all auto-residual scores
//
// #PERF-N-PLUS-1: was a 3N round-trip loop:
//   1. SELECT all risks                                  (1 query)
//   2. for each risk r:
//        SELECT riskControl ⋈ ces WHERE risk_id = r.id   (N queries)
//        if any CES: UPDATE risk SET risk_score_residual (N queries)
// Replaced with two queries total:
//   1. SELECT all risks
//   2. SELECT all (risk_id, ces_score) pairs in one go via inArray
// + N updates, but those are run in parallel via Promise.all
// (well-bounded — at most N=O(hundreds) of small UPDATEs).
//
// Net effect on a 500-risk org: 3 × 500 + 1 = 1501 sequential
// round-trips → 1 + 1 + 500-parallel = ~3 sequential round-trips
// (the parallel UPDATEs are bounded by node-postgres' default pool
// size of 10, so still ~50 RTTs total; ~30× speedup on hot path).
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  // 1. Fetch all active risks for the org.
  const risks = await db
    .select({
      id: risk.id,
      riskScoreInherent: risk.riskScoreInherent,
    })
    .from(risk)
    .where(and(eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)));

  if (risks.length === 0) {
    return Response.json({ success: true, updated: 0, total: 0 });
  }

  const riskIds = risks.map((r) => r.id);

  // 2. Fetch ALL (risk_id, ces_score) pairs in a single query. This
  // replaces the per-risk SELECT that drove the original N+1.
  const cesPairs = await db
    .select({
      riskId: riskControl.riskId,
      cesScore: controlEffectivenessScore.score,
    })
    .from(riskControl)
    .innerJoin(
      controlEffectivenessScore,
      and(
        eq(controlEffectivenessScore.controlId, riskControl.controlId),
        eq(controlEffectivenessScore.orgId, ctx.orgId),
      ),
    )
    .where(
      and(
        inArray(riskControl.riskId, riskIds),
        eq(riskControl.orgId, ctx.orgId),
      ),
    );

  // 3. Group in memory: risk_id → ces_score[].
  const byRisk = new Map<string, number[]>();
  for (const { riskId: rid, cesScore } of cesPairs) {
    if (rid == null || cesScore == null) continue;
    const bucket = byRisk.get(rid) ?? [];
    bucket.push(cesScore);
    byRisk.set(rid, bucket);
  }

  // 4. Compute the new residual per risk and bulk-update only the
  // risks that have at least one CES score (preserves the original
  // "skip if no CES" behaviour).
  const updates: Promise<unknown>[] = [];
  let updated = 0;
  const now = new Date();
  for (const r of risks) {
    const scores = byRisk.get(r.id);
    if (!scores || scores.length === 0) continue;
    const inherentScore = r.riskScoreInherent ?? 0;
    const autoResidual = computeResidualScore(inherentScore, scores);
    updates.push(
      db
        .update(risk)
        .set({
          riskScoreResidual: autoResidual,
          updatedAt: now,
          updatedBy: ctx.userId,
        })
        .where(eq(risk.id, r.id)),
    );
    updated++;
  }

  // The UPDATEs are independent — Promise.all collapses N
  // sequential awaits into one parallel batch bounded by the
  // node-postgres connection pool.
  await Promise.all(updates);

  return Response.json({
    success: true,
    updated,
    total: risks.length,
  });
}
