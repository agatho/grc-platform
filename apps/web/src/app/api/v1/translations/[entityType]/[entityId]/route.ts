// Sprint 21: GET/PUT translations for a specific entity
// GET /api/v1/translations/:entityType/:entityId?locale=all|<lang>
// PUT /api/v1/translations/:entityType/:entityId?locale=<lang>
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-04, S05-18, S05-19]
//
// Der PUT hatte denselben Datenverlust-Defekt wie `ai-translate`: er
// schrieb `'{"en":"…"}'::jsonb` in die `varchar`-Fachspalte und verwarf
// dabei den Originaltext. Beide Pfade schreiben jetzt in
// `entity_translation` (Migration 0416); der GET liest von dort und lässt
// die Fachspalte als Quelltext stehen.

import { db, translationStatus } from "@grc/db";
import {
  saveTranslationSchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  TRANSLATABLE_ENTITY_TYPES,
  resolveContentLanguage,
  computeSourceHash,
  sanitizeTranslation,
  translationSourceColumn,
  translationEntityHasOrgId,
} from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface TranslationRow {
  field: string;
  language: string;
  value: string;
  source_language: string;
  source_value: string;
  status: string;
  method: string;
  provider: string | null;
  model: string | null;
  updated_at: string;
}

/** Quelltext-SELECT für einen Entitätstyp, mit Spalten-Aliasing. */
function buildSourceSelect(entityType: string, fields: string[]) {
  return fields.map((f) =>
    sql.raw(`"${translationSourceColumn(entityType, f)}" AS "${f}"`),
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;

  if (!TRANSLATABLE_ENTITY_TYPES.includes(entityType)) {
    return Response.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const tableName = ENTITY_TABLE_MAP[entityType];
  const translatableFields = TRANSLATABLE_FIELDS[entityType];
  if (!tableName || !translatableFields) {
    return Response.json(
      { error: "Entity type not translatable" },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale");

  const hasOrgId = translationEntityHasOrgId(entityType);
  const orgFilter = hasOrgId ? sql` AND org_id = ${ctx.orgId}` : sql``;
  const softDeleteFilter = hasOrgId ? sql` AND deleted_at IS NULL` : sql``;
  const fieldSelects = buildSourceSelect(entityType, translatableFields);

  const result = await db.execute(
    sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId}${orgFilter}${softDeleteFilter} LIMIT 1`,
  );

  const rows = result as unknown as Record<string, unknown>[];
  if (!rows || rows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }
  const entity = rows[0];

  // Übersetzungen aus dem Seitenspeicher — org-gescopt, auch für die
  // globalen Katalogtabellen (S05-19).
  const translationRows = (await db.execute(sql`
    SELECT field, language, value, source_language, source_value,
           status, method, provider, model, updated_at
      FROM entity_translation
     WHERE org_id = ${ctx.orgId}::uuid
       AND entity_type = ${entityType}
       AND entity_id = ${entityId}::uuid
  `)) as unknown as TranslationRow[];

  const byField: Record<string, Record<string, string>> = {};
  for (const f of translatableFields) byField[f] = {};
  for (const t of translationRows) {
    if (!byField[t.field]) byField[t.field] = {};
    byField[t.field][t.language] = t.value;
  }

  if (locale === "all") {
    const statusRecords = await db
      .select()
      .from(translationStatus)
      .where(
        and(
          eq(translationStatus.orgId, ctx.orgId),
          eq(translationStatus.entityType, entityType),
          eq(translationStatus.entityId, entityId),
        ),
      );

    return Response.json({
      data: {
        id: entityId,
        entityType,
        // Der Quelltext steht weiterhin in der Fachspalte und ist hier
        // ausdrücklich ausgewiesen — nicht mit Übersetzungen vermischt.
        source: Object.fromEntries(
          translatableFields.map((f) => [f, entity[f] ?? null]),
        ),
        translations: byField,
        status: statusRecords,
      },
    });
  }

  const userLang = resolveContentLanguage({
    queryLocale: locale,
    userContentLanguage: null,
    orgDefaultLanguage: "de",
  });

  const resolved: Record<string, unknown> = { id: entityId, entityType };
  const fallback: string[] = [];
  for (const f of translatableFields) {
    const translated = byField[f]?.[userLang];
    if (translated) {
      resolved[f] = translated;
    } else {
      resolved[f] = entity[f] ?? "";
      if (userLang !== "de") fallback.push(f);
    }
    resolved[`${f}_translations`] = byField[f] ?? {};
  }
  resolved._resolvedLanguage = userLang;
  if (fallback.length > 0) resolved._fallback = fallback;

  return Response.json({ data: resolved });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;

  if (!TRANSLATABLE_ENTITY_TYPES.includes(entityType)) {
    return Response.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale");
  if (!locale) {
    return Response.json(
      { error: "locale query parameter is required" },
      { status: 400 },
    );
  }

  const tableName = ENTITY_TABLE_MAP[entityType];
  const translatableFields = TRANSLATABLE_FIELDS[entityType];
  if (!tableName || !translatableFields) {
    return Response.json(
      { error: "Entity type not translatable" },
      { status: 400 },
    );
  }

  const body = saveTranslationSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const invalidFields = Object.keys(body.data.fields).filter(
    (f) => !translatableFields.includes(f),
  );
  if (invalidFields.length > 0) {
    return Response.json(
      { error: `Non-translatable fields: ${invalidFields.join(", ")}` },
      { status: 422 },
    );
  }

  const hasOrgId = translationEntityHasOrgId(entityType);
  const orgFilter = hasOrgId ? sql` AND org_id = ${ctx.orgId}` : sql``;
  const softDeleteFilter = hasOrgId ? sql` AND deleted_at IS NULL` : sql``;
  const fieldSelects = buildSourceSelect(entityType, translatableFields);

  const existingResult = await db.execute(
    sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId}${orgFilter}${softDeleteFilter} LIMIT 1`,
  );

  const existingRows = existingResult as unknown as Record<string, unknown>[];
  if (!existingRows || existingRows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }
  const existing = existingRows[0];

  await withAuditContext(ctx, async (tx) => {
    for (const [field, value] of Object.entries(body.data.fields)) {
      if (!translatableFields.includes(field)) continue; // extra safety
      const sanitizedValue = sanitizeTranslation(value);
      const sourceValue = String(existing[field] ?? "");

      await tx.execute(sql`
        INSERT INTO entity_translation (
          org_id, entity_type, entity_id, field, language,
          value, source_language, source_value, source_hash,
          method, status, created_by, updated_by
        ) VALUES (
          ${ctx.orgId}::uuid, ${entityType}, ${entityId}::uuid, ${field},
          ${locale}, ${sanitizedValue}, 'de', ${sourceValue},
          ${computeSourceHash(sourceValue)}, 'manual', 'verified',
          ${ctx.userId}::uuid, ${ctx.userId}::uuid
        )
        ON CONFLICT (org_id, entity_type, entity_id, field, language)
        DO UPDATE SET
          value = EXCLUDED.value,
          source_value = EXCLUDED.source_value,
          source_hash = EXCLUDED.source_hash,
          method = 'manual',
          status = 'verified',
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
      `);

      const hash = computeSourceHash(value);
      await tx
        .insert(translationStatus)
        .values({
          orgId: ctx.orgId,
          entityType,
          entityId,
          field,
          language: locale,
          status: "verified",
          method: "manual",
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
            status: "verified",
            method: "manual",
            translatedBy: ctx.userId,
            translatedAt: new Date(),
            sourceHash: hash,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          },
        });
    }
  });

  return Response.json({
    data: {
      entityType,
      entityId,
      locale,
      updatedFields: Object.keys(body.data.fields),
      sourceFieldsPreserved: true,
    },
  });
}
