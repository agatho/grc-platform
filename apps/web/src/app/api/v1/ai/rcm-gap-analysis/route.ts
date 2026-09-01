// POST /api/v1/ai/rcm-gap-analysis — AI-driven RCM gap analysis
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
// Vorher: Inline-Prompt mit `JSON.stringify(riskData.slice(0,50))` im
// Fliesstext, kein Rate-Limit, `result = { gaps: [] }` als stiller
// Fallback bei unparsebarer Antwort — ein leeres Ergebnis war nicht von
// „keine Lücken gefunden" zu unterscheiden.

import { db, risk, riskControl, control } from "@grc/db";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { aiRcmGapAnalysisSchema } from "@grc/shared";
import {
  aiCompleteGoverned,
  buildRcmGapPrompt,
  rcmGapsSchema,
  safeJsonParse,
} from "@grc/ai";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiRcmGapAnalysisSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const riskConditions = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];
  if (body.data.scope === "high_risk") {
    riskConditions.push(sql`${risk.riskScoreInherent} >= 15`);
  }

  const risks = await db
    .select({
      id: risk.id,
      title: risk.title,
      riskCategory: risk.riskCategory,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(risk)
    .where(and(...riskConditions));

  // #PERF-N-PLUS-1: one inArray query plus in-memory grouping instead of
  // one riskControl ⋈ control query per risk.
  const riskIds = risks.map((r) => r.id);
  const links =
    riskIds.length > 0
      ? await db
          .select({
            riskId: riskControl.riskId,
            title: control.title,
            controlType: control.controlType,
            frequency: control.frequency,
          })
          .from(riskControl)
          .innerJoin(control, eq(control.id, riskControl.controlId))
          .where(
            and(
              inArray(riskControl.riskId, riskIds),
              eq(riskControl.orgId, ctx.orgId),
              isNull(control.deletedAt),
            ),
          )
      : [];

  const linksByRisk = new Map<
    string,
    Array<{ title: string; type: string; frequency: string }>
  >();
  for (const l of links) {
    if (l.riskId == null) continue;
    const bucket = linksByRisk.get(l.riskId) ?? [];
    bucket.push({ title: l.title, type: l.controlType, frequency: l.frequency });
    linksByRisk.set(l.riskId, bucket);
  }

  const riskData = [];
  for (const r of risks) {
    const controls = linksByRisk.get(r.id) ?? [];
    if (body.data.scope === "unlinked" && controls.length > 0) continue;
    riskData.push({
      id: r.id,
      title: r.title,
      category: r.riskCategory,
      inherentScore: r.riskScoreInherent,
      controls,
    });
  }

  const knownRiskIds = new Set(riskData.map((r) => r.id));

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.rcm_gap_analysis",
      orgId: ctx.orgId,
      userId: ctx.userId,
      messages: buildRcmGapPrompt({ scope: body.data.scope, risks: riskData }),
      maxTokens: 4000,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: rcmGapsSchema,
    });

    // Serverseitige Härtung analog ai/suggest-controls: eine Lücke darf
    // sich nur auf ein Risiko beziehen, das der Server selbst geliefert
    // hat. Erfundene oder eingeschleuste IDs fallen heraus.
    const gaps = result.data.gaps.filter((g) => knownRiskIds.has(g.riskId));

    return aiJson(
      {
        scope: body.data.scope,
        risksAnalyzed: riskData.length,
        gaps,
        discardedGaps: result.data.gaps.length - gaps.length,
        model: result.model,
        provider: result.provider,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
