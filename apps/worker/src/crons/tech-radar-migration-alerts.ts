// Sprint 37: Technology Radar Migration Alerts Worker
// Runs weekly — finds HOLD technologies with active applications, creates tasks

import { db, technologyEntry } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { NotImplementedEvidenceError } from "../lib/job-runtime";

// ── [N-2 · Welle 6a] `alertsCreated` zaehlte Warnungen, die es nicht gab ──
//
// Der Kopfkommentar sagt „creates tasks". Der Rumpf zaehlte Technologien im
// Ring `hold` mit mindestens einer verknuepften Anwendung und gab die Zahl
// als `alertsCreated` zurueck — ohne eine einzige Aufgabe, Benachrichtigung
// oder Zeile zu schreiben. Aufgefallen ist es ueber `noUnusedLocals`:
// `technologyApplicationLink`, `architectureElement` und `and` waren
// importiert und unbenutzt, also genau die Bausteine der nie geschriebenen
// Aufgabenerzeugung.
//
// Ein Feld namens `alertsCreated`, das die Zahl der KANDIDATEN traegt, ist
// erfundene Taetigkeit: der woechentliche Lauf quittierte „12 Warnungen
// erzeugt", und niemand hatte je eine bekommen. Der Job verweigert jetzt
// nach dem Muster von `connector-health-monitor.ts` — gibt es nichts zu
// melden, ist die Null gemessen; gibt es etwas, sagt der Fehler, dass die
// Meldung fehlt.
export const processTechRadarMigrationAlerts = withCronInstrumentation(
  "tech-radar-migration-alerts",
  async (): Promise<{
    holdTechnologies: number;
    alertsCreated: number;
  }> => {
    const holdWithUsage = await db
      .select({
        techId: technologyEntry.id,
        techName: technologyEntry.name,
        orgId: technologyEntry.orgId,
        appCount: sql<number>`(SELECT count(*) FROM technology_application_link tal WHERE tal.technology_id = ${technologyEntry.id})::int`,
      })
      .from(technologyEntry)
      .where(eq(technologyEntry.ring, "hold"));

    const withApps = holdWithUsage.filter((t) => t.appCount > 0);

    if (withApps.length === 0) {
      return { holdTechnologies: 0, alertsCreated: 0 };
    }

    throw new NotImplementedEvidenceError(
      "technology radar migration alerts",
      `${withApps.length} technolog(ies) on the HOLD ring still have active ` +
        `applications. No task, notification or record is created for them, ` +
        `so no alert is reported either.`,
    );
  },
);
