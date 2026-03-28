// Sprint 21: AI Translation API
// POST /api/v1/translations/ai-translate — Claude-powered GRC translation

import { db, translationStatus } from "@grc/db";
import { aiComplete } from "@grc/ai";
import {
  aiTranslateSchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  resolveField,
  mergeTranslation,
  computeSourceHash,
  sanitizeTranslation,
} from "@grc/shared";
import {
  buildTranslatePrompt,
  buildBatchTranslatePrompt,
  parseBatchTranslateResponse,
} from "@grc/ai";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "dpo");
  if (ctx instanceof Response) return ctx;

  const body = aiTranslateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, entityId, targetLanguages, sourceLanguage } = body.data;

  const tableName = ENTITY_TABLE_MAP[entityType];
  const allTranslatableFields = TRANSLATABLE_FIELDS[entityType];
  if (!tableName || !allTranslatableFields) {
    return Response.json({ error: "Entity type not translatable" }, { status: 400 });
  }

  const fieldsToTranslate = body.data.fields
    ? body.data.fields.filter((f) => allTranslatableFields.includes(f))
    : allTranslatableFields;

  if (fieldsToTranslate.length === 0) {
    return Response.json({ error: "No valid translatable fields specified" }, { status: 422 });
  }

  // Fetch entity
  const orgFilter = tableName === "risk_catalog_entry" || tableName === "control_catalog_entry"
    ? ""
    : `AND org_id = '${ctx.orgId}'`;

  const fieldSelects = allTranslatableFields.map((f) => `"${f}"`).join(", ");
  const entityResult = await db.execute(sql.raw(
    `SELECT id, ${fieldSelects} FROM "${tableName}" WHERE id = '${entityId}' ${orgFilter} AND deleted_at IS NULL LIMIT 1`,
  ));

  const entityRows = entityResult as unknown as Record<string, unknown>[];
  if (!entityRows || entityRows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }

  const entity = entityRows[0];

  // Determine source language
  const orgDefaultLang = sourceLanguage ?? "de";

  // Collect source texts for translation
  const sourceTexts: Record<string, string> = {};
  for (const field of fieldsToTranslate) {
    const value = entity[field];
    const text = resolveField(
      value as Record<string, string> | string | null,
      orgDefaultLang,
      orgDefaultLang,
    );
    if (text) {
      sourceTexts[field] = text;
    }
  }

  if (Object.keys(sourceTexts).length === 0) {
    return Response.json({ error: "No source content to translate" }, { status: 422 });
  }

  // Translate to each target language
  const translations: Record<string, Record<string, string>> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let provider = "claude_api";

  for (const targetLang of targetLanguages) {
    if (targetLang === orgDefaultLang) continue;

    try {
      let translatedTexts: Record<string, string>;

      if (Object.keys(sourceTexts).length === 1) {
        // Single field — use simple prompt
        const [field, text] = Object.entries(sourceTexts)[0];
        const prompt = buildTranslatePrompt(text, orgDefaultLang, targetLang);
        const response = await aiComplete({
          messages: [{ role: "user", content: prompt }],
          maxTokens: 4096,
          temperature: 0.1,
        });
        translatedTexts = { [field]: sanitizeTranslation(response.text.trim()) };
        totalInputTokens += response.usage?.inputTokens ?? 0;
        totalOutputTokens += response.usage?.outputTokens ?? 0;
        provider = response.provider;
      } else {
        // Multiple fields — use batch prompt
        const prompt = buildBatchTranslatePrompt(sourceTexts, orgDefaultLang, targetLang);
        const response = await aiComplete({
          messages: [{ role: "user", content: prompt }],
          maxTokens: 8192,
          temperature: 0.1,
        });
        const parsed = parseBatchTranslateResponse(response.text, Object.keys(sourceTexts));
        translatedTexts = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, sanitizeTranslation(String(v))]),
        );
        totalInputTokens += response.usage?.inputTokens ?? 0;
        totalOutputTokens += response.usage?.outputTokens ?? 0;
        provider = response.provider;
      }

      translations[targetLang] = translatedTexts;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation failed";
      translations[targetLang] = { _error: message };
    }
  }

  // Save translations to DB
  await withAuditContext(ctx, async (tx) => {
    for (const [targetLang, translatedFields] of Object.entries(translations)) {
      if (translatedFields._error) continue;

      for (const [field, translatedText] of Object.entries(translatedFields)) {
        // Merge translation into JSONB field
        const currentField = entity[field] as Record<string, string> | null;
        const merged = mergeTranslation(currentField, targetLang, translatedText);

        await tx.execute(sql.raw(
          `UPDATE "${tableName}" SET "${field}" = '${JSON.stringify(merged).replace(/'/g, "''")}'::jsonb, updated_at = now(), updated_by = '${ctx.userId}' WHERE id = '${entityId}' ${orgFilter}`,
        ));

        // Upsert translation_status
        const hash = computeSourceHash(translatedText);
        await tx
          .insert(translationStatus)
          .values({
            orgId: ctx.orgId,
            entityType,
            entityId,
            field,
            language: targetLang,
            status: "draft_translation",
            method: provider.includes("claude") ? "ai_claude" : "ai_ollama",
            translatedBy: ctx.userId,
            translatedAt: new Date(),
            sourceHash: hash,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .onConflictDoUpdate({
            target: [
              translationStatus.orgId,
              translationStatus.entityType,
              translationStatus.entityId,
              translationStatus.field,
              translationStatus.language,
            ],
            set: {
              status: "draft_translation",
              method: provider.includes("claude") ? "ai_claude" : "ai_ollama",
              translatedBy: ctx.userId,
              translatedAt: new Date(),
              sourceHash: hash,
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            },
          });
      }
    }

    // Log AI usage (if ai_prompt_log table exists from Sprint 11)
    try {
      await tx.execute(sql`
        INSERT INTO ai_prompt_log (org_id, user_id, prompt_type, input_tokens, output_tokens, provider, created_at)
        VALUES (${ctx.orgId}, ${ctx.userId}, 'translation', ${totalInputTokens}, ${totalOutputTokens}, ${provider}, now())
      `);
    } catch {
      // ai_prompt_log table may not exist — silently skip
    }
  });

  return Response.json({
    data: {
      translations,
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens,
      },
      provider,
    },
  });
}
