// Sprint 21: Translation Heatmap API
// GET /api/v1/translations/heatmap — returns completion % per entity type per language

import { db } from "@grc/db";
import { TRANSLATABLE_FIELDS, ENTITY_TABLE_MAP } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Get org active languages
  // Parse active languages from the org record
  let activeLanguages: string[];
  try {
    const rawResult = await db.execute(
      sql`SELECT active_languages FROM organization WHERE id = ${ctx.orgId}`,
    );
    const rawRows = rawResult as unknown as Array<{
      active_languages: string[];
    }>;
    activeLanguages = rawRows[0]?.active_languages ?? ["de"];
    if (typeof activeLanguages === "string") {
      activeLanguages = JSON.parse(activeLanguages);
    }
  } catch {
    activeLanguages = ["de"];
  }

  const entityTypes = Object.keys(TRANSLATABLE_FIELDS).filter(
    (et) => et !== "risk_catalog_entry" && et !== "control_catalog_entry",
  );

  const heatmap: Array<{
    entityType: string;
    language: string;
    total: number;
    translated: number;
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
    const totalSlots = totalEntities * fields.length;

    for (const lang of activeLanguages) {
      // Count verified translations for this language
      const statusResult = await db.execute(sql`
        SELECT COUNT(*) as cnt
        FROM translation_status
        WHERE org_id = ${ctx.orgId}
          AND entity_type = ${et}
          AND language = ${lang}
          AND status = 'verified'
          AND deleted_at IS NULL
      `);
      const translated = Number(
        (statusResult as unknown as Array<{ cnt: string }>)[0]?.cnt ?? 0,
      );

      heatmap.push({
        entityType: et,
        language: lang,
        total: totalSlots,
        translated,
        percentage:
          totalSlots > 0 ? Math.round((translated / totalSlots) * 100) : 100,
      });
    }
  }

  return Response.json({
    data: heatmap,
    activeLanguages,
  });
});
