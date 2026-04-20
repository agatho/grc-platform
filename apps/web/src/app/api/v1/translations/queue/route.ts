// Sprint 21: Translation Queue API
// GET /api/v1/translations/queue?targetLocale=en&status=missing&entityType=risk

import { db, translationStatus } from "@grc/db";
import {
  translationQueueFilterSchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
} from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = paginate(req);

  const parsed = translationQueueFilterSchema.safeParse({
    entityType: searchParams.get("entityType") ?? undefined,
    targetLocale: searchParams.get("targetLocale") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? "1",
    limit: searchParams.get("limit") ?? "20",
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, targetLocale, status, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  // Build list of entity types to check
  const entityTypes = entityType
    ? [entityType]
    : Object.keys(TRANSLATABLE_FIELDS).filter(
        (et) => et !== "risk_catalog_entry" && et !== "control_catalog_entry",
      );

  const queueItems: Array<{
    entityType: string;
    entityId: string;
    entityTitle: string;
    missingLanguages: string[];
    outdatedLanguages: string[];
    lastModified: string;
    fieldCount: number;
    translatedFieldCount: number;
  }> = [];

  const targetLang = targetLocale ?? "en";

  for (const et of entityTypes) {
    const tableName = ENTITY_TABLE_MAP[et];
    const fields = TRANSLATABLE_FIELDS[et];
    if (!tableName || !fields) continue;

    // Get primary field for title display
    const titleField = fields[0]; // First field is always the title/name

    // Query entities that have missing or outdated translations for the target locale
    // Table/field names validated via ENTITY_TABLE_MAP/TRANSLATABLE_FIELDS whitelists
    const queryLimit = limit + 10;
    const entities = await db.execute(sql`
      SELECT
        e.id,
        e.${sql.raw(`"${titleField}"`)} as raw_title,
        e.updated_at
      FROM ${sql.raw(`"${tableName}"`)} e
      WHERE e.org_id = ${ctx.orgId}
        AND e.deleted_at IS NULL
      ORDER BY e.updated_at DESC
      LIMIT ${queryLimit}
    `);

    const rows = entities as unknown as Array<{
      id: string;
      raw_title: Record<string, string> | string;
      updated_at: string;
    }>;

    for (const row of rows) {
      // Check translation status for each field
      const statusRecords = await db
        .select()
        .from(translationStatus)
        .where(
          and(
            eq(translationStatus.orgId, ctx.orgId),
            eq(translationStatus.entityType, et),
            eq(translationStatus.entityId, row.id),
            eq(translationStatus.language, targetLang),
          ),
        );

      const translatedFields = statusRecords.filter(
        (s) => s.status === "verified" || s.status === "draft_translation",
      );
      const outdatedFields = statusRecords.filter(
        (s) => s.status === "outdated",
      );

      const missingFields = fields.filter(
        (f) => !statusRecords.some((s) => s.field === f),
      );

      // Apply status filter
      if (status === "missing" && missingFields.length === 0) continue;
      if (
        status === "draft" &&
        !statusRecords.some((s) => s.status === "draft_translation")
      )
        continue;
      if (status === "outdated" && outdatedFields.length === 0) continue;
      if (
        status === "verified" &&
        translatedFields.filter((s) => s.status === "verified").length ===
          fields.length
      )
        continue;
      if (status === "complete" && translatedFields.length !== fields.length)
        continue;

      // Resolve title for display
      const rawTitle = row.raw_title;
      const displayTitle =
        typeof rawTitle === "string"
          ? rawTitle
          : typeof rawTitle === "object" && rawTitle !== null
            ? (rawTitle["de"] ?? rawTitle[Object.keys(rawTitle)[0]] ?? "")
            : "";

      // Check which languages are missing across all fields
      const missingLangs = missingFields.length > 0 ? [targetLang] : [];
      const outdatedLangs = outdatedFields.length > 0 ? [targetLang] : [];

      queueItems.push({
        entityType: et,
        entityId: row.id,
        entityTitle: displayTitle,
        missingLanguages: missingLangs,
        outdatedLanguages: outdatedLangs,
        lastModified: row.updated_at,
        fieldCount: fields.length,
        translatedFieldCount: translatedFields.length,
      });
    }
  }

  // Sort by last modified descending
  queueItems.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  );

  // Paginate
  const total = queueItems.length;
  const paged = queueItems.slice(offset, offset + limit);

  return paginatedResponse(paged, total, page, limit);
}
