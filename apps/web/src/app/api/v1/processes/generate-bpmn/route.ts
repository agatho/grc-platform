// POST /api/v1/processes/generate-bpmn — AI generate BPMN (multi-provider)
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-22, S05-06, S05-09, S05-10, S05-12]
//
// Das war die Route, mit der die Fokusfrage des Prüfplans („Kann ein
// Nutzer den Provider wechseln und damit Daten in eine andere
// Jurisdiktion schicken?") mit JA zu beantworten war: `provider` war ein
// freies Request-Feld, der GET verriet jedem authentifizierten Nutzer,
// welche Provider scharf sind, und nichts prüfte den Wunsch gegen eine
// Betreiber- oder Org-Richtlinie.
//
// Jetzt:
//   * `provider` wird als WUNSCH an `aiCompleteGoverned` gereicht. Ohne
//     `ai_org_policy.allow_user_provider_choice = true` scheitert der
//     Request mit 403, egal welcher Provider gewünscht ist. Mit dem
//     Schalter sind nur die Provider wählbar, die die Richtlinie erlaubt.
//   * Der GET zeigt nur noch die für DIESE Organisation zulässigen
//     Provider und sagt ausdrücklich, ob eine Wahl überhaupt möglich ist.
//   * Der eigene In-Memory-`Map`-Rate-Limiter ist durch die gemeinsame
//     Schicht ersetzt.
//   * Der Prompt läuft über den gehärteten Builder, die Ausgabe wird
//     validiert.

import { validateBpmnXml } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import {
  aiCompleteGoverned,
  buildTextToBpmnPrompt,
  bpmnGenerationSchema,
  getAvailableProviders,
  loadOrgAiPolicy,
  safeJsonParse,
  selectProvider,
  ALL_PROVIDERS,
  type AiProvider,
} from "@grc/ai";
import { z } from "zod";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../ai/_shared/ai-route";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const generateWithProviderSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().min(50).max(2000),
  industry: z
    .enum([
      "manufacturing",
      "it_services",
      "financial_services",
      "healthcare",
      "generic",
    ])
    .optional(),
  provider: z.enum(ALL_PROVIDERS as [AiProvider, ...AiProvider[]]).optional(),
});

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Eigener, engerer Eimer: 8 KB Prompt und maxTokens 8192 je Aufruf.
  const limited = await aiRateLimit(ctx.userId, {
    bucket: "bpmn-generate",
    capacity: 10,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const body = generateWithProviderSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { name, description, industry, provider } = body.data;

  try {
    const result = await aiCompleteGoverned({
      feature: "bpm.generate_bpmn",
      orgId: ctx.orgId,
      userId: ctx.userId,
      requestedProvider: provider ?? null,
      messages: buildTextToBpmnPrompt(
        `Process name: ${name}\nIndustry: ${industry ?? "generic"}\n\n${description}`,
        "de",
      ),
      maxTokens: 8192,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: bpmnGenerationSchema,
    });

    const validation = validateBpmnXml(result.data.bpmnXml);
    if (!validation.valid) {
      return Response.json(
        {
          error: "Generated BPMN XML failed validation",
          validationErrors: validation.errors,
        },
        { status: 422 },
      );
    }

    return aiJson(
      {
        bpmnXml: result.data.bpmnXml,
        processName: name,
        summary: result.data.summary ?? null,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      },
      result.disclosure,
    );
  } catch (e) {
    return aiErrorResponse(e);
  }
});
// GET /api/v1/processes/generate-bpmn — Provider, die DIESE Organisation wählen darf
export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const policy = await loadOrgAiPolicy(ctx.orgId);
  const configured = getAvailableProviders();

  // Zulässig ist genau, was `selectProvider` mit diesem Wunsch akzeptiert.
  // Die Liste hier und die Durchsetzung im POST stammen damit aus
  // derselben Funktion — sie können nicht auseinanderlaufen.
  const permitted = configured.filter((p) => {
    try {
      selectProvider({
        policy: { ...policy, allowUserProviderChoice: true },
        configured,
        requested: p,
      });
      return true;
    } catch {
      return false;
    }
  });

  let effectiveDefault: AiProvider | null = null;
  try {
    effectiveDefault = selectProvider({ policy, configured }).provider;
  } catch {
    effectiveDefault = null;
  }

  return Response.json({
    data: {
      // Nur die zulässigen — nicht mehr die vollständige Betreiberliste.
      availableProviders: policy.allowUserProviderChoice ? permitted : [],
      defaultProvider: effectiveDefault,
      providerChoiceAllowed: policy.allowUserProviderChoice,
      egressMode: policy.egressMode,
      policySource: policy.modeSource,
      hint: policy.allowUserProviderChoice
        ? "Die Providerwahl ist für diese Organisation freigegeben und auf die aufgeführten Provider begrenzt."
        : "Die Providerwahl je Anfrage ist für diese Organisation nicht freigegeben; der Provider folgt der Richtlinie.",
    },
  });
});
