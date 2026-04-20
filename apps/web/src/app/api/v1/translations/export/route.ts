// Sprint 21: Translation Export API
// GET /api/v1/translations/export?entityType=risk&source=de&target=en&format=xliff

import { db } from "@grc/db";
import {
  translationExportQuerySchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  resolveField,
  sanitizeCsvValue,
} from "@grc/shared";
import {
  generateXliff,
  generateCsv,
  type XliffTranslationUnit,
  type CsvRow,
} from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = translationExportQuerySchema.safeParse({
    entityType: url.searchParams.get("entityType"),
    source: url.searchParams.get("source"),
    target: url.searchParams.get("target"),
    format: url.searchParams.get("format") ?? "xliff",
    entityIds: url.searchParams.get("entityIds") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, source, target, format, entityIds } = parsed.data;

  const tableName = ENTITY_TABLE_MAP[entityType];
  const fields = TRANSLATABLE_FIELDS[entityType];
  if (!tableName || !fields) {
    return Response.json(
      { error: "Entity type not translatable" },
      { status: 400 },
    );
  }

  // Build parameterized query
  // Table/field names are validated via ENTITY_TABLE_MAP/TRANSLATABLE_FIELDS whitelists
  const fieldSelects = fields.map((f) => sql.raw(`"${f}"`));
  const isCatalogTable =
    tableName === "risk_catalog_entry" || tableName === "control_catalog_entry";

  const conditions: ReturnType<typeof sql>[] = [sql`deleted_at IS NULL`];
  if (!isCatalogTable) {
    conditions.push(sql`org_id = ${ctx.orgId}`);
  }
  if (entityIds) {
    const idArray = entityIds.split(",").map((id) => id.trim());
    conditions.push(sql`id = ANY(${idArray})`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT id, ${sql.join(fieldSelects, sql`, `)}
    FROM ${sql.raw(`"${tableName}"`)}
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT 5000
  `);

  const entities = result as unknown as Array<Record<string, unknown>>;

  if (format === "csv") {
    const rows: CsvRow[] = [];

    for (const entity of entities) {
      for (const field of fields) {
        const fieldValue = entity[field] as
          | Record<string, string>
          | string
          | null;
        const sourceText = resolveField(fieldValue, source, source);
        const targetText = resolveField(fieldValue, target, source);

        if (!sourceText) continue;

        rows.push({
          id: `${entityType}:${entity.id}:${field}`,
          entityType,
          entityId: entity.id as string,
          field,
          source: sanitizeCsvValue(sourceText),
          target: sanitizeCsvValue(targetText || ""),
        });
      }
    }

    const csv = generateCsv(rows, source, target);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="translations_${entityType}_${source}_${target}.csv"`,
      },
    });
  }

  // XLIFF format
  const units: XliffTranslationUnit[] = [];

  for (const entity of entities) {
    for (const field of fields) {
      const fieldValue = entity[field] as
        | Record<string, string>
        | string
        | null;
      const sourceText = resolveField(fieldValue, source, source);
      const targetText = resolveField(fieldValue, target, source);

      if (!sourceText) continue;

      units.push({
        id: `${entityType}:${entity.id}:${field}`,
        entityType,
        entityId: entity.id as string,
        field,
        source: sourceText,
        target: targetText || "",
        note: `${entityType} ${field}`,
      });
    }
  }

  const xliff = generateXliff({
    sourceLanguage: source,
    targetLanguage: target,
    units,
  });

  return new Response(xliff, {
    headers: {
      "Content-Type": "application/xliff+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="translations_${entityType}_${source}_${target}.xliff"`,
    },
  });
}
