// GET /api/v1/risks/heatmap?scope=inherent|residual
//
// #WAVE15-P2-03: Wave-14 QA hit `/risks/heatmap` and got back a 422
// "must be valid UUID 8-4-4-4-12" with no clue what the id was meant
// to be — same fall-through-to-[id] pattern as the Wave-12 export
// 500-empty bug. Reality: there was no /heatmap route, so the request
// matched /risks/[id] and tried to cast "heatmap" to UUID.
//
// Implements the canonical 5×5 risk-matrix view that ERM/dashboards
// expect: each cell holds a count of risks at that
// (likelihood, impact) bucket. Both inherent and residual scopes are
// supported via the `scope` query param (default residual — matches
// the FAIR/ISO 31000 view auditors care about).

import { db, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type Scope = "inherent" | "residual";

const SCALE = 5; // 1..5 likelihood × 1..5 impact

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope") ?? "residual";
  const scope: Scope = scopeParam === "inherent" ? "inherent" : "residual";

  // Inherent + residual scores live on the risk row itself (no
  // separate riskAssessment table — every assessment writes directly
  // into the risk's current scores). Risks without scores end up in
  // the unscored bucket so the regulator sees every risk, not just
  // the ones that have been through evaluation.
  const rows = await db
    .select({
      id: risk.id,
      title: risk.title,
      status: risk.status,
      inherentLikelihood: risk.inherentLikelihood,
      inherentImpact: risk.inherentImpact,
      residualLikelihood: risk.residualLikelihood,
      residualImpact: risk.residualImpact,
    })
    .from(risk)
    .where(and(eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)));

  // Build the 5×5 matrix. Cells indexed [likelihood-1][impact-1].
  const matrix: {
    likelihood: number;
    impact: number;
    count: number;
    riskIds: string[];
  }[] = [];
  for (let l = 1; l <= SCALE; l += 1) {
    for (let i = 1; i <= SCALE; i += 1) {
      matrix.push({ likelihood: l, impact: i, count: 0, riskIds: [] });
    }
  }
  const cellAt = (l: number, i: number) => matrix[(l - 1) * SCALE + (i - 1)];

  const unscored: { id: string; title: string }[] = [];

  for (const r of rows) {
    const l =
      scope === "inherent" ? r.inherentLikelihood : r.residualLikelihood;
    const i = scope === "inherent" ? r.inherentImpact : r.residualImpact;

    if (l === null || l === undefined || i === null || i === undefined) {
      unscored.push({ id: r.id, title: r.title });
      continue;
    }

    const lc = Math.max(1, Math.min(SCALE, Number(l)));
    const ic = Math.max(1, Math.min(SCALE, Number(i)));
    const cell = cellAt(lc, ic);
    cell.count += 1;
    cell.riskIds.push(r.id);
  }

  return Response.json({
    data: {
      scope,
      scale: SCALE,
      total: rows.length,
      scored: rows.length - unscored.length,
      unscoredCount: unscored.length,
      unscored,
      matrix,
    },
  });
});
