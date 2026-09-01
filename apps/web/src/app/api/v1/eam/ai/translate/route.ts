// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13.4, S05-06, S05-09, S05-10, S05-12]
//
// Die Route schrieb
//     const translatedText = `[${targetLanguage.toUpperCase()}] ${sourceText}`;
// mit `status: "ai_translated"` in die Datenbank — eine als KI-Übersetzung
// ausgewiesene Zeile, die keine ist. Dasselbe Muster wie S14-02
// (erfundene Nachweise), nur im Übersetzungsmodul. Jetzt echter,
// richtliniengebundener Modellaufruf.

import { db, eamTranslation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { translateSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  aiCompleteGoverned,
  buildTranslatePrompt,
  isAiProvider,
} from "@grc/ai";
import { sanitizeTranslation } from "@grc/shared";
import { loadEamAiConfig } from "../_shared/config";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../../ai/_shared/ai-route";

// POST /api/v1/eam/ai/translate — Translate field(s)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId, {
    bucket: "translate",
    capacity: 5,
    windowSeconds: 300,
  });
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

  const body = await req.json().catch(() => null);
  const parsed = translateSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  // Store translation record
  const existing = await db
    .select()
    .from(eamTranslation)
    .where(
      and(
        eq(eamTranslation.entityId, parsed.data.entityId),
        eq(eamTranslation.entityType, parsed.data.entityType),
        eq(eamTranslation.fieldName, parsed.data.fieldName),
        eq(eamTranslation.language, parsed.data.targetLanguage),
      ),
    )
    .limit(1);

  let ai;
  try {
    ai = await aiCompleteGoverned({
      feature: "eam.translate",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      // EAM-Feldtexte enthalten regelmässig Namen von Verantwortlichen.
      containsPersonalData: true,
      requestedProvider: isAiProvider(config.provider) ? config.provider : null,
      messages: buildTranslatePrompt(
        parsed.data.sourceText,
        "de",
        parsed.data.targetLanguage,
      ),
      maxTokens: 4096,
      temperature: 0.1,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const translatedText = sanitizeTranslation(ai.text.trim());
  if (!translatedText) {
    return Response.json(
      { error: "Das Modell hat keinen Übersetzungstext geliefert." },
      { status: 422 },
    );
  }

  let result;
  if (existing.length) {
    result = await db
      .update(eamTranslation)
      .set({
        translatedText,
        status: "ai_translated",
        translatedAt: new Date(),
        translatedBy: ctx.userId,
      })
      .where(eq(eamTranslation.id, existing[0].id))
      .returning();
  } else {
    result = await db
      .insert(eamTranslation)
      .values({
        orgId: ctx.orgId,
        entityId: parsed.data.entityId,
        entityType: parsed.data.entityType,
        fieldName: parsed.data.fieldName,
        language: parsed.data.targetLanguage,
        translatedText,
        status: "ai_translated",
        translatedBy: ctx.userId,
      })
      .returning();
  }

  return aiJson(
    {
      ...result[0],
      provider: ai.provider,
      model: ai.model,
    },
    ai.disclosure,
  );
}
