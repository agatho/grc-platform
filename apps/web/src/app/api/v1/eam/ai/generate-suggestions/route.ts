// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13.4, S05-06, S05-09, S05-10, S05-12]
//
// Zwei Defekte:
//  * Die Route antwortete `note: "LLM call executed through provider
//    abstraction layer"`, ohne ein Modell aufzurufen.
//  * Der Prompt entstand aus
//        template.templateText.replace("{industry}", parsed.data.industry)
//    — der Nutzerwert landete unmaskiert im INSTRUKTIONSTEXT einer aus
//    der Datenbank geladenen Vorlage. Die Vorlage ist jetzt reine
//    Instruktion, die Nutzerwerte stehen im Datenumschlag.

import { db, eamAiPromptTemplate, eamAiSuggestionLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { generateSuggestionsSchema } from "@grc/shared";
import { eq, and, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  aiCompleteGoverned,
  buildEamSuggestionsPrompt,
  eamSuggestionsSchema,
  isAiProvider,
  safeJsonParse,
} from "@grc/ai";
import { loadEamAiConfig } from "../_shared/config";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../../ai/_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/eam/ai/generate-suggestions — Generate object suggestions via LLM
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  // Check AI provider
  const config = await loadEamAiConfig(ctx.orgId);

  if (!config) {
    return Response.json(
      {
        error:
          "AI features require an LLM provider. Configure one in Settings > AI Provider.",
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = generateSuggestionsSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  // Resolve prompt template
  const templates = await db
    .select()
    .from(eamAiPromptTemplate)
    .where(
      and(
        eq(eamAiPromptTemplate.templateKey, "object_generation"),
        eq(eamAiPromptTemplate.isActive, true),
        or(
          isNull(eamAiPromptTemplate.orgId),
          eq(eamAiPromptTemplate.orgId, ctx.orgId),
        ),
      ),
    );

  const template = templates.find((t) => t.orgId !== null) ?? templates[0];
  if (!template)
    return Response.json(
      { error: "Prompt template not found" },
      { status: 500 },
    );

  try {
    const result = await aiCompleteGoverned({
      feature: "eam.generate_suggestions",
      orgId: ctx.orgId,
      userId: ctx.userId,
      requestedProvider: isAiProvider(config.provider) ? config.provider : null,
      messages: buildEamSuggestionsPrompt({
        templateText: template.templateText,
        objectType: parsed.data.objectType,
        industry: parsed.data.industry,
        count: parsed.data.count,
        existingObjects: parsed.data.existingObjects ?? [],
      }),
      maxTokens: 2000,
      temperature: 0.4,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: eamSuggestionsSchema,
    });

    const suggestions = result.data.suggestions.slice(0, parsed.data.count);

    await db.insert(eamAiSuggestionLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      featureKey: "object_generation",
      suggestionData: { params: parsed.data, suggestions },
      action: "generated",
      provider: result.provider,
      model: result.model,
    });

    return aiJson(
      {
        suggestions,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    await db.insert(eamAiSuggestionLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      featureKey: "object_generation",
      suggestionData: { params: parsed.data },
      action: "failed",
      provider: config.provider,
      model: config.values.model ?? null,
    });
    return aiErrorResponse(err);
  }
});
