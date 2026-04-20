// Sprint 21: Translation Progress API
// GET /api/v1/translations/progress?entityType=risk&targetLocale=en

import { db, translationStatus } from "@grc/db";
import {
  translationProgressQuerySchema,
  TRANSLATABLE_FIELDS,
  ENTITY_TABLE_MAP,
} from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = translationProgressQuerySchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? undefined,
    targetLocale: url.searchParams.get("targetLocale"),
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { entityType, targetLocale } = parsed.data;

  // Build list of entity types to report on
  const entityTypes = entityType
    ? [entityType]
    : Object.keys(TRANSLATABLE_FIELDS).filter(
        (et) => et !== "risk_catalog_entry" && et !== "control_catalog_entry",
      );

  const progressData: Array<{
    entityType: string;
    targetLanguage: string;
    total: number;
    translated: number;
    verified: number;
    draft: number;
    outdated: number;
    percentage: number;
  }> = [];

  for (const et of entityTypes) {
    const tableName = ENTITY_TABLE_MAP[et];
    const fields = TRANSLATABLE_FIELDS[et];
    if (!tableName || !fields) continue;

    // Count total entities
    const countResult = await db.execute(
      sql.raw(`
      SELECT COUNT(*) as cnt FROM "${tableName}"
      WHERE org_id = '${ctx.orgId}' AND deleted_at IS NULL
    `),
    );

    const totalEntities = Number(
      (countResult as unknown as Array<{ cnt: string }>)[0]?.cnt ?? 0,
    );

    if (totalEntities === 0) {
      progressData.push({
        entityType: et,
        targetLanguage: targetLocale,
        total: 0,
        translated: 0,
        verified: 0,
        draft: 0,
        outdated: 0,
        percentage: 100,
      });
      continue;
    }

    // Total translatable field-slots: entities * fields
    const totalSlots = totalEntities * fields.length;

    // Count translation status records for target locale
    const statusCounts = await db.execute(sql`
      SELECT status, COUNT(*) as cnt
      FROM translation_status
      WHERE org_id = ${ctx.orgId}
        AND entity_type = ${et}
        AND language = ${targetLocale}
        AND deleted_at IS NULL
      GROUP BY status
    `);

    const counts = statusCounts as unknown as Array<{
      status: string;
      cnt: string;
    }>;
    let verified = 0;
    let draft = 0;
    let outdated = 0;

    for (const row of counts) {
      switch (row.status) {
        case "verified":
          verified = Number(row.cnt);
          break;
        case "draft_translation":
          draft = Number(row.cnt);
          break;
        case "outdated":
          outdated = Number(row.cnt);
          break;
      }
    }

    // Only verified counts as "translated" for progress %
    const translated = verified;
    const percentage =
      totalSlots > 0 ? Math.round((translated / totalSlots) * 100) : 100;

    progressData.push({
      entityType: et,
      targetLanguage: targetLocale,
      total: totalSlots,
      translated,
      verified,
      draft,
      outdated,
      percentage,
    });
  }

  return Response.json({ data: progressData });
}
