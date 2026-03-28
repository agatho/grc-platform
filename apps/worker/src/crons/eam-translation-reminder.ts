// Sprint 51: EAM Translation Reminder Worker — Weekly
// Flags objects with missing translations

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

export async function processEamTranslationReminder(): Promise<{
  objectsWithMissingTranslations: number;
}> {
  console.log("[eam-translation-reminder] Checking for missing translations");

  // Find architecture elements without translations
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS missing_count
    FROM architecture_element ae
    WHERE ae.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM eam_translation et
        WHERE et.entity_id = ae.id AND et.entity_type = 'architecture_element'
      )
  `);

  const count = ((result.rows ?? result) as Array<{ missing_count: number }>)[0]?.missing_count ?? 0;

  console.log(`[eam-translation-reminder] Complete: ${count} objects with missing translations`);

  return { objectsWithMissingTranslations: count };
}
