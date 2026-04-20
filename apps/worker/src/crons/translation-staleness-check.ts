// Cron Job: Translation Staleness Check
// DAILY — Marks translations as "outdated" when the source content has changed
// since the translation was made (detected by comparing source_hash).

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

interface StalenessCheckResult {
  checkedRecords: number;
  markedOutdated: number;
  error: string | null;
}

const TRANSLATABLE_TABLES: Array<{
  entityType: string;
  tableName: string;
  fields: string[];
}> = [
  { entityType: "risk", tableName: "risk", fields: ["title", "description"] },
  {
    entityType: "control",
    tableName: "control",
    fields: ["title", "description"],
  },
  {
    entityType: "process",
    tableName: "process",
    fields: ["name", "description"],
  },
  { entityType: "document", tableName: "document", fields: ["title"] },
  {
    entityType: "finding",
    tableName: "finding",
    fields: ["title", "description"],
  },
  { entityType: "incident", tableName: "security_incident", fields: ["title"] },
];

export async function processTranslationStalenessCheck(): Promise<StalenessCheckResult> {
  const now = new Date();
  console.log(`[cron:translation-staleness] Starting at ${now.toISOString()}`);

  let checkedRecords = 0;
  let markedOutdated = 0;

  try {
    // For each entity type, check if the source content has changed
    // since the translation was recorded.
    // We detect this by checking if the entity's updated_at is newer
    // than the translation_status.translated_at.
    for (const { entityType, tableName } of TRANSLATABLE_TABLES) {
      const result = await db.execute(
        sql.raw(`
        UPDATE translation_status ts
        SET status = 'outdated',
            updated_at = now()
        FROM "${tableName}" e
        WHERE ts.entity_type = '${entityType}'
          AND ts.entity_id = e.id
          AND ts.status IN ('verified', 'draft_translation')
          AND e.updated_at > ts.translated_at
          AND ts.deleted_at IS NULL
          AND e.deleted_at IS NULL
      `),
      );

      const affected = (result as any).rowCount ?? 0;
      markedOutdated += affected;

      // Count total checked
      const countResult = await db.execute(
        sql.raw(`
        SELECT COUNT(*) as cnt
        FROM translation_status
        WHERE entity_type = '${entityType}'
          AND status IN ('verified', 'draft_translation')
          AND deleted_at IS NULL
      `),
      );
      checkedRecords += Number(
        (countResult as unknown as Array<{ cnt: string }>)[0]?.cnt ?? 0,
      );
    }

    console.log(
      `[cron:translation-staleness] Checked ${checkedRecords} records, marked ${markedOutdated} as outdated`,
    );

    return { checkedRecords, markedOutdated, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cron:translation-staleness] Error: ${message}`);
    return { checkedRecords: 0, markedOutdated: 0, error: message };
  }
}
