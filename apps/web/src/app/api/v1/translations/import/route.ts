// Sprint 21: Translation Import API
// POST /api/v1/translations/import — Import XLIFF or CSV translations

import { db, translationStatus } from "@grc/db";
import {
  xliffImportSchema,
  csvImportSchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
  mergeTranslation,
  computeSourceHash,
  sanitizeTranslation,
} from "@grc/shared";
import { parseXliff, parseCsv } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "xliff";

  const rawBody = await req.json();

  if (format === "csv") {
    return handleCsvImport(ctx, rawBody);
  }

  return handleXliffImport(ctx, rawBody);
}

async function handleXliffImport(
  ctx: { orgId: string; userId: string; session: any },
  rawBody: unknown,
) {
  const body = xliffImportSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Size check: 50MB max
  if (body.data.content.length > 52_428_800) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let doc;
  try {
    doc = parseXliff(body.data.content);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse XLIFF";
    return Response.json({ error: message }, { status: 422 });
  }

  const targetLanguage = doc.targetLanguage;
  let imported = 0;
  let skipped = 0;
  const conflicts = 0;
  const errors: Array<{ unitId: string; error: string }> = [];

  if (body.data.dryRun) {
    // Dry run: just count what would be imported
    for (const unit of doc.units) {
      if (!unit.target || unit.target.trim() === "") {
        skipped++;
        continue;
      }
      const fields = TRANSLATABLE_FIELDS[unit.entityType];
      if (!fields || !fields.includes(unit.field)) {
        errors.push({ unitId: unit.id, error: "Invalid entity type or field" });
        continue;
      }
      imported++;
    }

    return Response.json({
      data: {
        dryRun: true,
        totalUnits: doc.units.length,
        imported,
        skipped,
        conflicts,
        errors,
      },
    });
  }

  // Actual import
  await withAuditContext(ctx, async (tx) => {
    for (const unit of doc.units) {
      if (!unit.target || unit.target.trim() === "") {
        skipped++;
        continue;
      }

      const tableName = ENTITY_TABLE_MAP[unit.entityType];
      const fields = TRANSLATABLE_FIELDS[unit.entityType];
      if (!tableName || !fields || !fields.includes(unit.field)) {
        errors.push({ unitId: unit.id, error: "Invalid entity type or field" });
        continue;
      }

      try {
        // Fetch current field value
        const orgFilter =
          tableName === "risk_catalog_entry" ||
          tableName === "control_catalog_entry"
            ? ""
            : `AND org_id = '${ctx.orgId}'`;

        const existingResult = await tx.execute(
          sql.raw(
            `SELECT "${unit.field}" FROM "${tableName}" WHERE id = '${unit.entityId}' ${orgFilter} AND deleted_at IS NULL LIMIT 1`,
          ),
        );

        const existingRows = existingResult as unknown as Record<
          string,
          unknown
        >[];
        if (!existingRows || existingRows.length === 0) {
          errors.push({ unitId: unit.id, error: "Entity not found" });
          continue;
        }

        const currentField = existingRows[0][unit.field] as Record<
          string,
          string
        > | null;
        const sanitized = sanitizeTranslation(unit.target);
        const merged = mergeTranslation(
          currentField,
          targetLanguage,
          sanitized,
        );

        // Update entity field
        await tx.execute(
          sql.raw(
            `UPDATE "${tableName}" SET "${unit.field}" = '${JSON.stringify(merged).replace(/'/g, "''")}'::jsonb, updated_at = now(), updated_by = '${ctx.userId}' WHERE id = '${unit.entityId}' ${orgFilter}`,
          ),
        );

        // Upsert translation_status
        const hash = computeSourceHash(sanitized);
        await tx
          .insert(translationStatus)
          .values({
            orgId: ctx.orgId,
            entityType: unit.entityType,
            entityId: unit.entityId,
            field: unit.field,
            language: targetLanguage,
            status: "verified",
            method: "xliff_import",
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
              method: "xliff_import",
              translatedBy: ctx.userId,
              translatedAt: new Date(),
              sourceHash: hash,
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            },
          });

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        errors.push({ unitId: unit.id, error: message });
      }
    }
  });

  return Response.json({
    data: {
      dryRun: false,
      totalUnits: doc.units.length,
      imported,
      skipped,
      conflicts,
      errors,
    },
  });
}

async function handleCsvImport(
  ctx: { orgId: string; userId: string; session: any },
  rawBody: unknown,
) {
  const body = csvImportSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  let csvData;
  try {
    csvData = parseCsv(body.data.content);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse CSV";
    return Response.json({ error: message }, { status: 422 });
  }

  const { targetLanguage, rows } = csvData;
  let imported = 0;
  let skipped = 0;
  const errors: Array<{ unitId: string; error: string }> = [];

  if (body.data.dryRun) {
    for (const row of rows) {
      if (!row.target || row.target.trim() === "") {
        skipped++;
        continue;
      }
      const fields = TRANSLATABLE_FIELDS[row.entityType];
      if (!fields || !fields.includes(row.field)) {
        errors.push({ unitId: row.id, error: "Invalid entity type or field" });
        continue;
      }
      imported++;
    }

    return Response.json({
      data: { dryRun: true, totalRows: rows.length, imported, skipped, errors },
    });
  }

  await withAuditContext(ctx, async (tx) => {
    for (const row of rows) {
      if (!row.target || row.target.trim() === "") {
        skipped++;
        continue;
      }

      const tableName = ENTITY_TABLE_MAP[row.entityType];
      const fields = TRANSLATABLE_FIELDS[row.entityType];
      if (!tableName || !fields || !fields.includes(row.field)) {
        errors.push({ unitId: row.id, error: "Invalid entity type or field" });
        continue;
      }

      try {
        const orgFilter =
          tableName === "risk_catalog_entry" ||
          tableName === "control_catalog_entry"
            ? ""
            : `AND org_id = '${ctx.orgId}'`;

        const existingResult = await tx.execute(
          sql.raw(
            `SELECT "${row.field}" FROM "${tableName}" WHERE id = '${row.entityId}' ${orgFilter} AND deleted_at IS NULL LIMIT 1`,
          ),
        );

        const existingRows = existingResult as unknown as Record<
          string,
          unknown
        >[];
        if (!existingRows || existingRows.length === 0) {
          errors.push({ unitId: row.id, error: "Entity not found" });
          continue;
        }

        const currentField = existingRows[0][row.field] as Record<
          string,
          string
        > | null;
        const sanitized = sanitizeTranslation(row.target);
        const merged = mergeTranslation(
          currentField,
          targetLanguage,
          sanitized,
        );

        await tx.execute(
          sql.raw(
            `UPDATE "${tableName}" SET "${row.field}" = '${JSON.stringify(merged).replace(/'/g, "''")}'::jsonb, updated_at = now(), updated_by = '${ctx.userId}' WHERE id = '${row.entityId}' ${orgFilter}`,
          ),
        );

        const hash = computeSourceHash(sanitized);
        await tx
          .insert(translationStatus)
          .values({
            orgId: ctx.orgId,
            entityType: row.entityType,
            entityId: row.entityId,
            field: row.field,
            language: targetLanguage,
            status: "verified",
            method: "csv_import",
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
              method: "csv_import",
              translatedBy: ctx.userId,
              translatedAt: new Date(),
              sourceHash: hash,
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            },
          });

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        errors.push({ unitId: row.id, error: message });
      }
    }
  });

  return Response.json({
    data: { dryRun: false, totalRows: rows.length, imported, skipped, errors },
  });
}
