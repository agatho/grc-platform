// POST /api/v1/ai/control-suggestions — AI-generated control suggestions for a risk
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
//
// Diese Route war der schlechteste der 23 AI-Endpunkte:
//   * Prompt komplett ungehärtet, Risikotitel und -beschreibung direkt im
//     Fliesstext (`Risk: "${riskRow.title}"`).
//   * Antwort ungeprüft: `suggestions = JSON.parse(cleaned)` in `unknown[]`,
//     direkt in die Response.
//   * Eigener In-Memory-Rate-Limiter (`Map<string, number[]>`), also pro
//     Container und ohne Bezug zu `@/lib/rate-limit`.
//   * `ai_prompt_log` ohne Provider.
//
// Sie ist dieselbe Fachfunktion wie `ai/suggest-controls`, nur ohne
// dessen Härtung. Beide laufen jetzt über `aiCompleteGoverned`.

import { db, risk, riskControl, control } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { aiControlSuggestionsSchema } from "@grc/shared";
import {
  aiCompleteGoverned,
  buildIcsControlSuggestionPrompt,
  icsControlSuggestionsSchema,
  safeJsonParse,
} from "@grc/ai";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiControlSuggestionsSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [riskRow] = await db
    .select({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      riskSource: risk.riskSource,
      riskScoreInherent: risk.riskScoreInherent,
    })
    .from(risk)
    .where(
      and(
        eq(risk.id, body.data.riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    )
    .limit(1);

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const existingLinks = await db
    .select({
      title: control.title,
      controlType: control.controlType,
      frequency: control.frequency,
    })
    .from(riskControl)
    .innerJoin(control, eq(control.id, riskControl.controlId))
    .where(
      and(
        eq(riskControl.riskId, body.data.riskId),
        eq(riskControl.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.control_suggestions",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "risk",
      entityId: riskRow.id,
      messages: buildIcsControlSuggestionPrompt({
        riskTitle: riskRow.title,
        riskDescription: riskRow.description,
        riskCategory: riskRow.riskCategory,
        riskSource: riskRow.riskSource,
        inherentScore: riskRow.riskScoreInherent,
        existingControls: existingLinks,
      }),
      maxTokens: 2000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: icsControlSuggestionsSchema,
    });

    return aiJson(
      {
        riskId: body.data.riskId,
        suggestions: result.data.suggestions,
        model: result.model,
        provider: result.provider,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
});
