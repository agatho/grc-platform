// Sprint 21: GET/PUT translations for a specific entity
// GET /api/v1/translations/:entityType/:entityId?locale=all|<lang>
// PUT /api/v1/translations/:entityType/:entityId?locale=<lang> — save translation for locale

import { db, translationStatus } from "@grc/db";
import {
  saveTranslationSchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  TRANSLATABLE_ENTITY_TYPES,
  resolveEntity,
  resolveContentLanguage,
  mergeTranslation,
  computeSourceHash,
  sanitizeTranslation,
} from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

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
    return Response.json({ error: "Entity type not translatable" }, { status: 400 });
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale");

  // Fetch entity with raw JSONB fields
  // Table/field names are validated via ENTITY_TABLE_MAP/TRANSLATABLE_FIELDS whitelists above
  const fieldSelects = translatableFields.map((f) => sql.raw(`"${f}"`));
  const isCatalogTable = tableName === "risk_catalog_entry" || tableName === "control_catalog_entry";

  const result = isCatalogTable
    ? await db.execute(sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId} AND deleted_at IS NULL LIMIT 1`)
    : await db.execute(sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`);

  const rows = result as unknown as Record<string, unknown>[];
  if (!rows || rows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }

  const entity = rows[0];

  // If locale=all, return all translations
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
        translations: Object.fromEntries(
          translatableFields.map((f) => [f, entity[f] ?? {}]),
        ),
        status: statusRecords,
      },
    });
  }

  // Resolve for specific locale
  const userLang = resolveContentLanguage({
    queryLocale: locale,
    userContentLanguage: null,
    orgDefaultLanguage: "de",
  });

  const resolved = resolveEntity(
    entity as Record<string, unknown>,
    translatableFields,
    userLang,
    "de",
  );

  return Response.json({ data: resolved });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "dpo");
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;

  if (!TRANSLATABLE_ENTITY_TYPES.includes(entityType)) {
    return Response.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale");
  if (!locale) {
    return Response.json({ error: "locale query parameter is required" }, { status: 400 });
  }

  const tableName = ENTITY_TABLE_MAP[entityType];
  const translatableFields = TRANSLATABLE_FIELDS[entityType];
  if (!tableName || !translatableFields) {
    return Response.json({ error: "Entity type not translatable" }, { status: 400 });
  }

  const body = saveTranslationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate all fields are translatable for this entity type
  const invalidFields = Object.keys(body.data.fields).filter(
    (f) => !translatableFields.includes(f),
  );
  if (invalidFields.length > 0) {
    return Response.json(
      { error: `Non-translatable fields: ${invalidFields.join(", ")}` },
      { status: 422 },
    );
  }

  // Verify entity exists
  // Table/field names are validated via ENTITY_TABLE_MAP/TRANSLATABLE_FIELDS whitelists
  const isCatalogTable = tableName === "risk_catalog_entry" || tableName === "control_catalog_entry";
  const fieldSelects = translatableFields.map((f) => sql.raw(`"${f}"`));

  const existingResult = isCatalogTable
    ? await db.execute(sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId} AND deleted_at IS NULL LIMIT 1`)
    : await db.execute(sql`SELECT id, ${sql.join(fieldSelects, sql`, `)} FROM ${sql.raw(`"${tableName}"`)} WHERE id = ${entityId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`);

  const existingRows = existingResult as unknown as Record<string, unknown>[];
  if (!existingRows || existingRows.length === 0) {
    return Response.json({ error: "Entity not found" }, { status: 404 });
  }

  const existing = existingRows[0];

  // Update each translated field using parameterized queries
  const updateParts: ReturnType<typeof sql>[] = [];
  for (const [field, value] of Object.entries(body.data.fields)) {
    if (!translatableFields.includes(field)) continue; // extra safety
    const sanitizedValue = sanitizeTranslation(value);
    const currentField = existing[field] as Record<string, string> | null;
    const merged = mergeTranslation(currentField, locale, sanitizedValue);
    updateParts.push(sql`${sql.raw(`"${field}"`)} = ${JSON.stringify(merged)}::jsonb`);
  }

  updateParts.push(sql`updated_at = now()`);
  updateParts.push(sql`updated_by = ${ctx.userId}`);

  await withAuditContext(ctx, async (tx) => {
    // Update entity fields
    const updateQuery = isCatalogTable
      ? sql`UPDATE ${sql.raw(`"${tableName}"`)} SET ${sql.join(updateParts, sql`, `)} WHERE id = ${entityId}`
      : sql`UPDATE ${sql.raw(`"${tableName}"`)} SET ${sql.join(updateParts, sql`, `)} WHERE id = ${entityId} AND org_id = ${ctx.orgId}`;
    await tx.execute(updateQuery);

    // Upsert translation_status records
    for (const [field, value] of Object.entries(body.data.fields)) {
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
    },
  });
}
