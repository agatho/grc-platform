// Sprint 21: AI Translation API
// POST /api/v1/translations/ai-translate
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-04 (High), S05-06, S05-09,
//  S05-10, S05-11, S05-12, S05-18, S05-19]
//
// ── S05-04: der Datenverlust
//
// Die Route schrieb ein JSONB-Objekt in die FACHSPALTE:
//     UPDATE "control" SET "title" = '{"en":"…"}'::jsonb WHERE …
// Alle zehn adressierten Spalten sind `varchar`/`text`; Postgres castet
// im Assignment-Kontext still. `mergeTranslation()` bekam einen String
// statt eines Objekts, verwarf ihn und legte nur die Übersetzung hinein
// — der deutsche Originaltitel eines Risikos, einer Kontrolle, einer
// Feststellung oder eines Sicherheitsvorfalls war nach einem einzigen
// regulären Klick weg.
//
// Diese Route schreibt jetzt NICHT MEHR in die Fachspalte. Übersetzungen
// liegen in `entity_translation` (Migration 0416), zusammen mit dem
// Quelltext, aus dem übersetzt wurde. Der Originaltext kann durch
// Übersetzen strukturell nicht mehr verloren gehen.
//
// ── S05-19: der latente Cross-Tenant-Write
//
// Für `risk_catalog_entry`/`control_catalog_entry` — global, ohne
// `org_id`, ohne RLS — schaltete der alte Code den Org-Filter ab und
// hätte den mandantenübergreifenden Katalogtext überschrieben, sobald der
// Schema-Drift behoben ist. In `entity_translation` trägt jede Zeile eine
// `org_id`: ein Mandant übersetzt den Katalog für sich.
//
// ── S05-11: die Protokollierung war defekt
//
// Der alte INSERT nannte `prompt_type` und `provider` — beides existiert
// in `ai_prompt_log` nicht — und liess drei NOT-NULL-Spalten aus. Der
// `catch {}` verschluckte den Fehler mit dem Kommentar „table may not
// exist"; die Tabelle existierte. KI-Übersetzungen wurden nie
// protokolliert. Die Protokollierung läuft jetzt über
// `aiCompleteGoverned` und schreibt Provider und Jurisdiktion mit.

import { db } from "@grc/db";
import {
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  aiTranslateSchema,
  computeSourceHash,
  resolveField,
  sanitizeTranslation,
  translationSourceColumn,
  translationEntityHasOrgId,
} from "@grc/shared";
import {
  aiCompleteGoverned,
  buildTranslatePrompt,
  buildBatchTranslatePrompt,
  parseBatchTranslateResponse,
} from "@grc/ai";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  aiRateLimit,
  aiErrorResponse,
} from "../../ai/_shared/ai-route";

export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  // [S05-10] Die Route schleift über alle Zielsprachen mit maxTokens 8192
  // je Sprache und hatte kein Rate-Limit. Eigener, enger Eimer.
  const limited = await aiRateLimit(ctx.userId, {
    bucket: "translate",
    capacity: 5,
    windowSeconds: 300,
  });
  if (limited) return limited;

  const body = aiTranslateSchema.safeParse(await req.json().catch(() => null));
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
    return Response.json(
      { error: "Entity type not translatable" },
      { status: 400 },
    );
  }

  const fieldsToTranslate = body.data.fields
    ? body.data.fields.filter((f) => allTranslatableFields.includes(f))
    : allTranslatableFields;

  if (fieldsToTranslate.length === 0) {
    return Response.json(
      { error: "No valid translatable fields specified" },
      { status: 422 },
    );
  }

  const hasOrgId = translationEntityHasOrgId(entityType);
  const orgFilter = hasOrgId ? sql` AND org_id = ${ctx.orgId}` : sql``;
  const softDeleteFilter = hasOrgId ? sql` AND deleted_at IS NULL` : sql``;

  // Physische Spaltennamen (S05-19: `title` vs. `title_de` in den
  // Katalogtabellen). Beide Seiten stammen aus Allowlists.
  const columnByField = new Map(
    allTranslatableFields.map((f) => [f, translationSourceColumn(entityType, f)]),
  );
  const fieldSelects = allTranslatableFields.map((f) =>
    sql.raw(`"${columnByField.get(f)}" AS "${f}"`),
  );

  const entityResult = await db.execute(
    sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId}${orgFilter}${softDeleteFilter} LIMIT 1`,
  );

  const entityRows = entityResult as unknown as Record<string, unknown>[];
  if (!entityRows || entityRows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }

  const entity = entityRows[0];
  const orgDefaultLang = sourceLanguage ?? "de";

  const sourceTexts: Record<string, string> = {};
  for (const field of fieldsToTranslate) {
    const text = resolveField(
      entity[field] as Record<string, string> | string | null,
      orgDefaultLang,
      orgDefaultLang,
    );
    if (text) sourceTexts[field] = text;
  }

  if (Object.keys(sourceTexts).length === 0) {
    return Response.json(
      { error: "No source content to translate" },
      { status: 422 },
    );
  }

  const translations: Record<string, Record<string, string>> = {};
  const failures: Record<string, string> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let provider: string | null = null;
  let model: string | null = null;
  let disclosure: unknown = null;
  let policyError: unknown = null;

  const singleField = Object.keys(sourceTexts).length === 1;

  for (const targetLang of targetLanguages) {
    if (targetLang === orgDefaultLang) continue;
    if (policyError) break;

    try {
      const messages = singleField
        ? buildTranslatePrompt(
            Object.values(sourceTexts)[0],
            orgDefaultLang,
            targetLang,
          )
        : buildBatchTranslatePrompt(sourceTexts, orgDefaultLang, targetLang);

      const result = await aiCompleteGoverned({
        feature: "translations.ai_translate",
        orgId: ctx.orgId,
        userId: ctx.userId,
        entityType,
        entityId,
        // Titel und Beschreibungen von Feststellungen und
        // Sicherheitsvorfällen enthalten regelmässig Personennamen.
        containsPersonalData: true,
        messages,
        maxTokens: singleField ? 4096 : 8192,
        temperature: 0.1,
      });

      const translatedTexts = singleField
        ? {
            [Object.keys(sourceTexts)[0]]: sanitizeTranslation(
              result.text.trim(),
            ),
          }
        : Object.fromEntries(
            Object.entries(
              parseBatchTranslateResponse(
                result.text,
                Object.keys(sourceTexts),
              ),
            ).map(([k, v]) => [k, sanitizeTranslation(String(v))]),
          );

      totalInputTokens += result.usage?.inputTokens ?? 0;
      totalOutputTokens += result.usage?.outputTokens ?? 0;
      provider = result.provider;
      model = result.model;
      disclosure = result.disclosure;
      translations[targetLang] = translatedTexts;
    } catch (err) {
      // Eine Richtlinienverletzung betrifft ALLE Zielsprachen — abbrechen
      // statt sie einzeln durchzuprobieren.
      if (
        err instanceof Error &&
        (err.name === "AiPolicyViolationError" ||
          err.name === "AiOutputInvalidError")
      ) {
        if (err.name === "AiPolicyViolationError") {
          policyError = err;
          continue;
        }
      }
      failures[targetLang] =
        err instanceof Error ? err.message : "Translation failed";
    }
  }

  if (policyError && Object.keys(translations).length === 0) {
    return aiErrorResponse(policyError);
  }

  // Speichern — ausschliesslich in `entity_translation`. Die Fachspalte
  // wird NICHT angefasst (S05-04).
  await withAuditContext(ctx, async (tx) => {
    for (const [targetLang, translatedFields] of Object.entries(translations)) {
      for (const [field, translatedText] of Object.entries(translatedFields)) {
        const sourceValue = sourceTexts[field] ?? "";
        if (!translatedText) continue;
        await tx.execute(sql`
          INSERT INTO entity_translation (
            org_id, entity_type, entity_id, field, language,
            value, source_language, source_value, source_hash,
            method, status, provider, model, created_by, updated_by
          ) VALUES (
            ${ctx.orgId}::uuid, ${entityType}, ${entityId}::uuid, ${field},
            ${targetLang}, ${translatedText}, ${orgDefaultLang},
            ${sourceValue}, ${computeSourceHash(sourceValue)},
            'ai', 'draft_translation', ${provider}, ${model},
            ${ctx.userId}::uuid, ${ctx.userId}::uuid
          )
          ON CONFLICT (org_id, entity_type, entity_id, field, language)
          DO UPDATE SET
            value = EXCLUDED.value,
            source_language = EXCLUDED.source_language,
            source_value = EXCLUDED.source_value,
            source_hash = EXCLUDED.source_hash,
            method = 'ai',
            status = 'draft_translation',
            provider = EXCLUDED.provider,
            model = EXCLUDED.model,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
        `);
      }
    }
  });

  return Response.json({
    data: {
      translations,
      failures,
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      provider,
      model,
      // Der Originaltext bleibt, wo er ist — das ist die Zusage, die die
      // alte Implementierung gebrochen hat.
      sourceFieldsPreserved: true,
      aiDisclosure: disclosure,
    },
  });
}
