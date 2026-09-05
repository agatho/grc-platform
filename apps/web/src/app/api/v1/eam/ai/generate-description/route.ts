// POST /api/v1/eam/ai/generate-description — Generate description for entity
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13.4, S05-06, S05-09, S05-10, S05-12]
//
// Die Route antwortete
//     note: "Description generation executed through provider abstraction layer"
// ohne je ein Modell aufgerufen zu haben — eine Aussage über eine
// Ausführung, die nicht stattgefunden hat. Sie führt den Aufruf jetzt
// tatsächlich durch, über denselben richtliniengebundenen Weg wie alle
// anderen KI-Funktionen. `eam_ai_config.provider` geht als WUNSCH ein;
// ob er zulässig ist, entscheidet `ai_org_policy` (S05-03/S05-22).

import { db, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { generateDescriptionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  aiCompleteGoverned,
  buildEamDescriptionPrompt,
  eamDescriptionSchema,
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

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

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

  const parsed = generateDescriptionSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const element = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.id, parsed.data.entityId),
        eq(architectureElement.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!element.length)
    return Response.json({ error: "Entity not found" }, { status: 404 });

  try {
    const result = await aiCompleteGoverned({
      feature: "eam.generate_description",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "architecture_element",
      entityId: element[0].id,
      requestedProvider: isAiProvider(config.provider) ? config.provider : null,
      messages: buildEamDescriptionPrompt({
        elementName: element[0].name,
        elementType: String(
          (element[0] as Record<string, unknown>).elementType ?? "unknown",
        ),
        existingDescription: (element[0] as Record<string, unknown>)
          .description as string | null,
      }),
      maxTokens: 800,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: eamDescriptionSchema,
    });

    return aiJson(
      {
        entityId: parsed.data.entityId,
        entityName: element[0].name,
        description: result.data.description,
        rationale: result.data.rationale ?? null,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
});
