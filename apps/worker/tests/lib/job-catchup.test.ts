// [ARCTOS-FULL-2026-08-31 · Welle 5c · OP-100]
//
// Der Scheduler aus S10-02 feuert einen Job genau dann, wenn die laufende
// Minute auf seinen Ausdruck passt. Fällt diese eine Minute in ein
// Neustart-, Deploy- oder Ausfallfenster, läuft der Job an diesem Tag GAR
// NICHT — und es entsteht keine Zeile in `job_run`, über die ein Alarm
// stolpern könnte. Die Lücke ist eine fehlende Zeile, keine auffällige.
//
// `findMissedRuns` ist die Antwort darauf, und sie ist bewusst rein:
// Zeitpläne, letzte Läufe, „jetzt" — Liste. Diese Suite prüft sie ohne
// Datenbank.
//
// Gegen den Stand vor dieser Welle fällt sie beim Import:
// `findMissedRuns` und `previousRunAtOrBefore` gab es nicht.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JOB_REGISTRY, findMissedRuns } from "../../src/lib/job-registry";
import type { MissedRun } from "../../src/lib/job-registry";
import {
  parseCron,
  cronMatches,
  previousRunAtOrBefore,
  nextRunAfter,
} from "../../src/lib/scheduler";
import type { JobDefinition } from "../../src/lib/scheduler";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const at = (iso: string) => new Date(iso);
const noop = async () => ({});

function job(name: string, schedule: string): JobDefinition {
  return { name, schedule, run: noop };
}

/** Namen der versaeumten Laeufe, in der Reihenfolge der Registry. */
function names(missed: readonly MissedRun[]): string[] {
  return missed.map((m) => m.job.name);
}

describe("previousRunAtOrBefore (OP-100)", () => {
  it("findet den letzten Solltermin vor einem Zeitpunkt", () => {
    const p = parseCron("30 6 * * *");
    expect(
      previousRunAtOrBefore(p, at("2026-09-05T09:12:00Z"))?.toISOString(),
    ).toBe("2026-09-05T06:30:00.000Z");
  });

  it("greift über den Tageswechsel zurück", () => {
    const p = parseCron("30 6 * * *");
    expect(
      previousRunAtOrBefore(p, at("2026-09-05T02:00:00Z"))?.toISOString(),
    ).toBe("2026-09-04T06:30:00.000Z");
  });

  it("zählt die laufende Minute selbst als Solltermin", () => {
    // „Strictly before" würde einen Neustart exakt in der Minute des Jobs
    // dessen eigenen Termin überspringen lassen.
    const p = parseCron("30 6 * * *");
    expect(
      previousRunAtOrBefore(p, at("2026-09-05T06:30:41Z"))?.toISOString(),
    ).toBe("2026-09-05T06:30:00.000Z");
  });

  it("greift bei einem Monatsausdruck über den Monatswechsel", () => {
    const p = parseCron("0 3 1 * *");
    expect(
      previousRunAtOrBefore(p, at("2026-09-15T00:00:00Z"))?.toISOString(),
    ).toBe("2026-09-01T03:00:00.000Z");
  });

  it("ist das Gegenstück zu nextRunAfter", () => {
    for (const expr of [
      "30 6 * * *",
      "0 */6 * * *",
      "0 3 1 * *",
      "0 5 * * 1",
    ]) {
      const p = parseCron(expr);
      const from = at("2026-09-05T09:12:00Z");
      const prev = previousRunAtOrBefore(p, from);
      expect(prev, expr).not.toBeNull();
      if (!prev) continue;
      expect(cronMatches(p, prev), expr).toBe(true);
      const next = nextRunAfter(p, prev);
      expect(next, expr).not.toBeNull();
      // Zwischen dem letzten Solltermin und dem nächsten liegt „jetzt".
      expect(next && next.getTime() > from.getTime(), expr).toBe(true);
    }
  });
});

describe("findMissedRuns (OP-100)", () => {
  const now = at("2026-09-05T09:00:00Z");

  it("erkennt einen täglichen Job, dessen Minute im Neustartfenster lag", () => {
    const jobs = [job("morning-report", "30 6 * * *")];
    const missed = findMissedRuns(
      jobs,
      new Map([["morning-report", at("2026-09-04T06:30:00Z")]]),
      now,
    );
    expect(names(missed)).toEqual(["morning-report"]);
    expect(missed[0]?.dueAt.toISOString()).toBe("2026-09-05T06:30:00.000Z");
    expect(missed[0]?.intervalMs).toBe(24 * 60 * 60 * 1000);
  });

  it("meldet nichts, wenn der Job an seinem Termin gelaufen ist", () => {
    const jobs = [job("morning-report", "30 6 * * *")];
    const missed = findMissedRuns(
      jobs,
      new Map([["morning-report", at("2026-09-05T06:30:02Z")]]),
      now,
    );
    expect(missed).toEqual([]);
  });

  it("holt einen Job ohne jede Historie NICHT nach", () => {
    // Grenze 1: beim ersten Start einer Installation ist nichts versäumt.
    // Ohne diese Regel führe der erste Start 131 Jobs gleichzeitig.
    const missed = findMissedRuns(
      [job("morning-report", "30 6 * * *")],
      new Map(),
      now,
    );
    expect(missed).toEqual([]);
  });

  it("holt kurz getaktete Jobs NICHT nach", () => {
    // Grenze 2: `webhook-dispatch` (*/2) heilt sich binnen zwei Minuten
    // selbst. Ein Nachholen bei jedem Rolling Deploy brächte nichts.
    const jobs = [
      job("webhook-dispatch", "*/2 * * * *"),
      job("queue", "*/15 * * * *"),
      job("hourly", "17 * * * *"),
    ];
    const lastRuns = new Map([
      ["webhook-dispatch", at("2026-09-05T07:00:00Z")],
      ["queue", at("2026-09-05T07:00:00Z")],
      ["hourly", at("2026-09-05T07:17:00Z")],
    ]);
    // Nur der stündliche Job (Intervall = Schwelle) wird nachgeholt.
    expect(names(findMissedRuns(jobs, lastRuns, now))).toEqual(["hourly"]);
  });

  it("holt einen monatlichen Job nach, dessen Termin verstrichen ist", () => {
    const jobs = [job("cci-monthly-aggregation", "0 2 1 * *")];
    const missed = findMissedRuns(
      jobs,
      new Map([["cci-monthly-aggregation", at("2026-08-01T02:00:00Z")]]),
      now,
    );
    expect(names(missed)).toEqual(["cci-monthly-aggregation"]);
    expect(missed[0]?.dueAt.toISOString()).toBe("2026-09-01T02:00:00.000Z");
  });

  it("überspringt einen Job mit unlesbarem Ausdruck, statt abzubrechen", () => {
    const jobs = [job("broken", "not a cron"), job("fine", "30 6 * * *")];
    const lastRuns = new Map([
      ["broken", at("2026-09-01T00:00:00Z")],
      ["fine", at("2026-09-04T06:30:00Z")],
    ]);
    expect(names(findMissedRuns(jobs, lastRuns, now))).toEqual(["fine"]);
  });

  it("meldet gegen die echte Registry nichts, wenn alles gerade lief", () => {
    // Negativkontrolle: wäre die Vergleichsrichtung vertauscht, meldete
    // dieser Fall alle 131 Jobs statt keinen.
    const lastRuns = new Map(JOB_REGISTRY.map((j) => [j.name, now]));
    expect(findMissedRuns(JOB_REGISTRY, lastRuns, now)).toEqual([]);
  });
});

// [Welle 5c] Die Zahlen, die `crons/job-run-retention.ts` und
// `src/index.ts` im Kommentar führen — nachgerechnet statt fortgeschrieben.
describe("Kennzahlen der Job-Registry", () => {
  function runsPerDay(): number {
    let perYear = 0;
    for (const j of JOB_REGISTRY) {
      const p = parseCron(j.schedule);
      const minutes = p.fields[0];
      const hours = p.fields[1];
      if (!minutes || !hours) continue;
      const minuteHourSlots = minutes.size * hours.size;
      // Der Tagesteil (dom/month/dow) hängt nicht von Minute und Stunde ab,
      // also genügt eine Probeminute je Tag.
      const probeMinute = [...minutes][0] ?? 0;
      const probeHour = [...hours][0] ?? 0;
      let days = 0;
      const cursor = new Date(Date.UTC(2026, 0, 1, probeHour, probeMinute));
      for (let i = 0; i < 366; i++) {
        if (cronMatches(p, cursor)) days++;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      perYear += minuteHourSlots * days;
    }
    return Math.round(perYear / 366);
  }

  it("führt 131 Jobs, nicht 129", () => {
    expect(JOB_REGISTRY.length).toBe(131);
  });

  it("erzeugt rund 4.000 job_run-Zeilen am Tag, nicht 40.000", () => {
    const perDay = runsPerDay();
    expect(perDay).toBeGreaterThan(3500);
    expect(perDay).toBeLessThan(4500);
    // Die alte Zahl im Kommentar lag um den Faktor zehn daneben.
    expect(perDay).toBeLessThan(40_000 / 5);
  });

  it("hat genau einen Job mit einer Taktung unter fünf Minuten", () => {
    const fast = JOB_REGISTRY.filter((j) => {
      const m = /^\*\/(\d+) /.exec(j.schedule);
      return m !== null && Number(m[1]) < 5;
    });
    expect(fast.map((j) => j.name)).toEqual(["webhook-dispatch"]);
  });

  it("hält die Kommentare an diesen Zahlen fest", () => {
    // Beide Dateien ZITIEREN die alte Zahl in ihrer Korrektur, ein
    // Verbotsmuster auf „129" würde also die Berichtigung selbst treffen.
    // Geprüft wird deshalb, dass die GEMESSENE Zahl dasteht — und dass sie
    // dieselbe ist, die `JOB_REGISTRY` heute hergibt.
    const count = String(JOB_REGISTRY.length);

    const retention = readFileSync(
      resolve(REPO, "apps/worker/src/crons/job-run-retention.ts"),
      "utf8",
    );
    expect(
      retention,
      `job-run-retention.ts nennt nicht die gemessene Jobzahl ${count}`,
    ).toContain(count);

    const index = readFileSync(
      resolve(REPO, "apps/worker/src/index.ts"),
      "utf8",
    );
    expect(
      index,
      `index.ts nennt nicht die gemessene Jobzahl ${count}`,
    ).toContain(`${count} registered jobs`);
  });
});
