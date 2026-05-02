// Cron Job: SoA → Programme Cockpit Backfill
//
// Iteriert über alle Orgs mit einer aktiven ISO 27001 Journey UND einer
// nicht-leeren SoA-Tabelle und ruft die Sync-Engine pro SoA-Eintrag auf.
// Der Sync-Helper ist idempotent (matched by metadata.soaEntryId), daher
// ist es egal, wenn der Cron täglich läuft — neue oder geänderte Einträge
// werden projiziert, alle anderen sind no-op.
//
// Frequenz: täglich 06:30 (nach dem Deadline-Monitor um 06:00).
//
// Zweck:
//   - Stellt sicher, dass historische SoA-Einträge irgendwann auch in der
//     Implementation-Wave-Subtask-Liste auftauchen (Backfill für Orgs, die
//     ihre SoA vor dem Sync-Feature befüllt haben).
//   - Heilt Drift-Fälle, in denen ein Forward-Hook gescheitert ist (z.B.
//     weil der Web-Pod beim SoA-Update gerade restartete).

import {
  db,
  programmeJourney,
  soaEntry,
  syncAllSoaEntriesToProgramme,
} from "@grc/db";
import { and, eq, isNull, sql } from "drizzle-orm";

interface SoaBackfillResult {
  orgsScanned: number;
  orgsWithJourney: number;
  totalEntries: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function processSoaProgrammeBackfill(): Promise<SoaBackfillResult> {
  console.log(
    `[cron:soa-programme-backfill] Starting at ${new Date().toISOString()}`,
  );

  // Find orgs that have a non-archived ISO 27001 journey AND at least one
  // SoA entry. Doing this in one query avoids scanning idle orgs.
  const orgRows = await db
    .selectDistinct({ orgId: programmeJourney.orgId })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.templateCode, "iso27001-2022"),
        isNull(programmeJourney.deletedAt),
        sql`${programmeJourney.status} != 'archived'`,
      ),
    );

  let totalEntries = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let orgsWithJourney = 0;

  for (const { orgId } of orgRows) {
    // Skip orgs without any SoA entries — saves a sync round-trip.
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(soaEntry)
      .where(eq(soaEntry.orgId, orgId));
    if (count === 0) continue;

    orgsWithJourney++;
    try {
      const r = await syncAllSoaEntriesToProgramme(db, orgId, null);
      totalEntries += r.total;
      created += r.created;
      updated += r.updated;
      skipped += r.skipped;
      console.log(
        `[cron:soa-programme-backfill] org=${orgId} total=${r.total} created=${r.created} updated=${r.updated} skipped=${r.skipped}`,
      );
    } catch (err) {
      errors++;
      console.error(
        `[cron:soa-programme-backfill] org=${orgId} sync failed:`,
        err,
      );
    }
  }

  console.log(
    `[cron:soa-programme-backfill] Done. orgsScanned=${orgRows.length} orgsWithJourney=${orgsWithJourney} totalEntries=${totalEntries} created=${created} updated=${updated} skipped=${skipped} errors=${errors}`,
  );

  return {
    orgsScanned: orgRows.length,
    orgsWithJourney,
    totalEntries,
    created,
    updated,
    skipped,
    errors,
  };
}
