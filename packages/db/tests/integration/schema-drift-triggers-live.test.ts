// [ARCTOS-FULL-2026-08-31 · OP-155] Der Trigger-Teil des Drift-Vergleichs,
// gegen die laufende Datenbank.
//
// Der Unit-Test (`tests/unit/schema-drift.test.ts`) prüft die Logik gegen
// erfundene Zeilen — er kann nicht wissen, ob das Register
// `ALWAYS_ENABLED_GUARDS` noch dem Schema entspricht. Genau das ist hier die
// Frage: eine Liste von 17 Namen im Quelltext ist eine Behauptung über eine
// Datenbank, und eine Behauptung ohne Messung altert.
//
// Warum überhaupt ein Register und keine Ableitung aus den Migrationen:
// sechs der siebzehn werden nicht als Literal gesetzt, sondern in einer
// Schleife (`0401_audit_chain_assign_and_guards.sql:458` schreibt
// `EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I', t,
// t || '_no_truncate')`). Ein Textscan über `drizzle/*.sql` findet deshalb 11
// von 17 — gemessen am 2026-09-03. Ein Soll-Zustand, der ein Drittel der
// Wächter übersieht, ist schlechter als keiner.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import {
  ALWAYS_ENABLED_GUARDS,
  compareTriggers,
  DRIFT_QUERIES,
  type DbTrigger,
} from "../schema-drift";

let admin: ReturnType<typeof createTestDb>;
let triggers: DbTrigger[] = [];

describe("OP-155 · ENABLE-Zustand der Trigger gegen die laufende Datenbank", () => {
  beforeAll(async () => {
    admin = createTestDb();
    triggers = await admin.client.unsafe<DbTrigger[]>(DRIFT_QUERIES.triggers);
  }, 60_000);

  afterAll(async () => {
    await admin.client.end({ timeout: 5 });
  });

  it("liest überhaupt Trigger — sonst wäre alles darunter leer und grün", () => {
    // Die Abfrage kann durch einen Tippfehler im Schemafilter leer laufen.
    // Ohne diese Zusicherung wäre `triggerDrift: []` dann kein Ergebnis,
    // sondern nur die Abwesenheit einer Messung — dieselbe Verwechslung, die
    // OP-155 überhaupt erst beschreibt.
    expect(triggers.length).toBeGreaterThan(100);
  });

  it("kennt genau die 17 ENABLE-ALWAYS-Wächter, die die Datenbank trägt", () => {
    const inDb = triggers
      .filter((t) => t.tgenabled === "A")
      .map((t) => `${t.table_name}.${t.trigger_name}`)
      .sort();
    const registered = ALWAYS_ENABLED_GUARDS.map(
      (g) => `${g.table}.${g.trigger}`,
    ).sort();
    expect(inDb).toEqual(registered);
  });

  it("meldet gegen eine frisch migrierte Datenbank keine Trigger-Drift", () => {
    expect(compareTriggers(triggers)).toEqual([]);
  });

  // Der Nachweis, dass die Prüfung beisst — nicht als Gedankengang, sondern
  // an einem echten Trigger in einer echten Datenbank. Der Zustand wird
  // gemerkt, zurückgestuft, gemessen und wiederhergestellt. Wichtig ist der
  // Weg: `ENABLE TRIGGER ALL` ist genau der Befehl, den WP11 in
  // `tenant-isolation-cleanup.sql` und WP1b in `seed-all.ts` gefunden hat.
  it("wird rot, wenn ENABLE TRIGGER ALL einen Wächter zurückstuft", async () => {
    const guard = ALWAYS_ENABLED_GUARDS.find(
      (g) => g.trigger === "audit_log_refuse_delete_trg",
    )!;
    const before = triggers.find(
      (t) => t.trigger_name === guard.trigger && t.table_name === guard.table,
    );
    expect(before?.tgenabled).toBe("A");

    try {
      await admin.client.unsafe(
        `ALTER TABLE public.${guard.table} DISABLE TRIGGER ALL`,
      );
      await admin.client.unsafe(
        `ALTER TABLE public.${guard.table} ENABLE TRIGGER ALL`,
      );

      const nachher = await admin.client.unsafe<DbTrigger[]>(
        DRIFT_QUERIES.triggers,
      );
      const downgraded = nachher.find(
        (t) => t.trigger_name === guard.trigger && t.table_name === guard.table,
      );
      // Die Messung aus Welle 1b, hier reproduziert: 'A' wird zu 'O'.
      expect(downgraded?.tgenabled).toBe("O");

      const drift = compareTriggers(nachher);
      expect(drift).toContainEqual({
        table: guard.table,
        trigger: guard.trigger,
        kind: "guard-not-always",
        expected: "A",
        actual: "O",
      });
    } finally {
      // Jeden Wächter der Tabelle wieder auf seinen Ausgangszustand — nicht
      // pauschal `ENABLE TRIGGER ALL`, denn das ist der Befehl, der den
      // Schaden anrichtet. Ein Aufräumen, das eine Sicherheitskontrolle
      // dauerhaft entschärft, ist schlimmer als kein Aufräumen (WP11 · S11-11).
      for (const t of triggers.filter((x) => x.table_name === guard.table)) {
        const verb =
          t.tgenabled === "A"
            ? "ENABLE ALWAYS"
            : t.tgenabled === "R"
              ? "ENABLE REPLICA"
              : t.tgenabled === "D"
                ? "DISABLE"
                : "ENABLE";
        await admin.client.unsafe(
          `ALTER TABLE public.${t.table_name} ${verb} TRIGGER "${t.trigger_name}"`,
        );
      }
    }

    const wiederhergestellt = await admin.client.unsafe<DbTrigger[]>(
      DRIFT_QUERIES.triggers,
    );
    expect(compareTriggers(wiederhergestellt)).toEqual([]);
  }, 60_000);
});
