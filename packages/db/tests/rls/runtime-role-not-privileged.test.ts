// [ARCTOS-FULL-2026-08-31 · OP-092] Der Wächter über die Voraussetzung, unter
// der diese ganze Suite überhaupt etwas aussagt.
//
// Der Registereintrag nennt die Gefahr genau: „Ohne `APP_DATABASE_URL` läuft
// die RLS-Suite als Superuser und ist wertlos." Der Grund steht in
// `src/index.ts`: der Laufzeit-Pool nimmt
// `process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL` — ein bequemer,
// lautloser Fallback. Fehlt die Variable, verbindet der globale `db`-Proxy als
// Superuser `grc`, und ein Superuser umgeht Row Level Security UNABHÄNGIG von
// `FORCE`. Sämtliche Policies dieses Schemas sind dann wirkungslos.
//
// Was daraus folgt, ist schlimmer als ein fehlgeschlagener Lauf: die Suite
// wird **grün**. Jede Zusicherung der Form „der fremde Mandant ist nicht
// sichtbar" prüft dann eine Datenbank, in der RLS gar nicht greift — und wo
// ein Test in dieser Lage doch rot würde, läge es an den Daten, nicht an der
// Isolation. Ein grüner Lauf unter Superuser ist genau die Sorte Zahl, gegen
// die diese Arbeit angetreten ist: er sieht aus wie ein Nachweis.
//
// `tenant-isolation-systemtest.test.ts` prüft das für SEINE eigene Verbindung
// (`createAppDb`, aus `DATABASE_URL` abgeleitet). Diese Datei prüft die andere
// Verbindung — den globalen `db`-Proxy aus `@grc/db`, den
// `request-scoped-context.test.ts` und `auth-session-refresh-rls.test.ts`
// benutzen und der als einziger `APP_DATABASE_URL` liest. Für ihn gab es
// bisher keine Prüfung; er ist derjenige, den die Variable steuert.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, checkRuntimeRoleIsolation } from "../../src/index";
import { createTestDb } from "../helpers";

// Frische Kennungen je Lauf, keine festen. Eine feste UUID macht den Test
// zustandsbehaftet: bleibt nach einem Abbruch eine Audit-Zeile auf dieser
// Organisation liegen, laesst `audit_log` (append-only) sie nicht mehr
// entfernen, der Fremdschluessel haelt die Organisation fest, und jeder
// weitere Lauf scheitert am Aufraeumen statt an seiner eigenen Aussage —
// gemessen 2026-09-03.
const ORG = crypto.randomUUID();
const RISK = crypto.randomUUID();

let admin: ReturnType<typeof createTestDb>;

describe("OP-092 · der Laufzeit-Pool dieser Suite darf RLS nicht umgehen", () => {
  beforeAll(async () => {
    admin = createTestDb();
    // `session_replication_role = 'replica'` unterdrückt die Audit-Trigger
    // dieser beiden Tabellen (`tgenabled = 'O'`) und damit die Zeilen in
    // `audit_log`. Ohne das entstünde je eine Audit-Zeile, die wegen
    // `audit_log_refuse_delete_trg` (ENABLE ALWAYS) NICHT mehr entfernt werden
    // kann — und der Fremdschlüssel `audit_log.org_id` hielte danach die
    // Organisation fest. Der Aufräumteil unten scheiterte genau daran
    // (gemessen 2026-09-03). Die 17 ALWAYS-Wächter bleiben unberührt; hier
    // wird nichts abgeschaltet, was etwas schützt.
    await admin.client.unsafe(`SET session_replication_role = 'replica'`);
    await admin.client.unsafe(
      `INSERT INTO organization (id, name, type, country, is_eu)
       VALUES ($1, 'OP092 Probe', 'subsidiary', 'DEU', true)
       ON CONFLICT (id) DO NOTHING`,
      [ORG],
    );
    await admin.client.unsafe(
      `INSERT INTO risk (id, org_id, title, risk_category, risk_source)
       VALUES ($1, $2, 'OP092 Probe-Risiko', 'operational', 'erm')
       ON CONFLICT (id) DO NOTHING`,
      [RISK, ORG],
    );
    await admin.client.unsafe(`SET session_replication_role = 'origin'`);
  }, 60_000);

  afterAll(async () => {
    // Das Löschen des Risikos wieder unter `replica`: der Audit-Trigger auf
    // `risk` feuert sonst und schreibt eine `delete`-Zeile nach `audit_log`,
    // die auf diese Organisation zeigt. Weil `audit_log` append-only ist
    // (`audit_log_refuse_delete_trg`, ENABLE ALWAYS), liesse sich diese Zeile
    // nie mehr entfernen, und der Fremdschlüssel `audit_log.org_id` hielte die
    // Organisation für immer fest — gemessen 2026-09-03, drei Läufe, drei
    // liegengebliebene Organisationen.
    await admin.client.unsafe(`SET session_replication_role = 'replica'`);
    await admin.client.unsafe(`DELETE FROM risk WHERE id = $1`, [RISK]);
    // Die Organisation nur, wenn nichts Unlöschbares mehr auf sie zeigt.
    // Unter `replica` prüft PostgreSQL keine Fremdschlüssel — ein blindes
    // DELETE hinterliesse also stumme verwaiste Verweise. Deshalb wird die
    // eine Tabelle, die nicht aufräumbar ist, vorher gezählt. (Ein DELETE
    // unter `origin` ist keine Alternative: die RI-Abfrage läuft dann gegen
    // `access_log`, das RLS mit FORCE trägt, und scheitert mit
    // „referential integrity query … gave unexpected result" — gemessen.)
    const [{ n }] = await admin.client.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit_log WHERE org_id = $1`,
      [ORG],
    );
    if (n === 0) {
      await admin.client.unsafe(`DELETE FROM access_log WHERE org_id = $1`, [
        ORG,
      ]);
      await admin.client.unsafe(`DELETE FROM organization WHERE id = $1`, [
        ORG,
      ]);
    } else {
      console.warn(
        `[OP-092] ${n} Audit-Zeile(n) auf der Prüforganisation ${ORG}; ` +
          `audit_log ist append-only, die Organisation bleibt deshalb stehen, ` +
          `damit keine verwaiste Referenz entsteht.`,
      );
    }
    await admin.client.unsafe(`SET session_replication_role = 'origin'`);
    await admin.client.end({ timeout: 5 });
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  }, 60_000);

  it("verbindet als nicht privilegierte Rolle — sonst ist die Suite wertlos", async () => {
    const check = await checkRuntimeRoleIsolation();
    expect(
      check.appDatabaseUrlSet,
      "APP_DATABASE_URL ist nicht gesetzt. Der globale db-Proxy fällt dann auf " +
        "DATABASE_URL (Superuser grc) zurück, RLS greift nicht, und jede " +
        "Isolationszusicherung dieser Suite ist gegenstandslos — bei grünem Lauf. " +
        "Setzen: APP_DATABASE_URL=postgresql://grc_app:…",
    ).toBe(true);
    expect(
      check.isSuperuser,
      `Der Laufzeit-Pool verbindet als "${check.role}" mit rolsuper=true.`,
    ).toBe(false);
    expect(
      check.canBypassRls,
      `Der Laufzeit-Pool verbindet als "${check.role}" mit rolbypassrls=true.`,
    ).toBe(false);
  });

  // Die Gegenprobe zur Zusicherung oben, und der Grund, aus dem `beforeAll`
  // eine Zeile anlegt: „nicht privilegiert" allein bewiese noch nichts. Auf
  // einer leeren Tabelle ist „0 Zeilen" kein Ergebnis, sondern die Abwesenheit
  // von Daten — genau die Verwechslung, gegen die dieser Strang antritt. Die
  // Zeile existiert nachweislich (der Admin sieht sie), und der Laufzeit-Pool
  // sieht sie ohne Mandantenkontext trotzdem nicht.
  it("sieht ohne Mandantenkontext keine Zeilen, die es nachweislich gibt", async () => {
    const [seenByAdmin] = await admin.client.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM risk WHERE id = $1`,
      [RISK],
    );
    expect(seenByAdmin.n, "Die Prüfzeile muss existieren").toBe(1);

    const rows = (await db.execute(
      // Kein `set_config('app.current_org_id', …)`: ohne Kontext greift die
      // NULLIF-geschützte Policy und liefert die leere Menge.
      `SELECT count(*)::int AS n FROM risk WHERE id = '${RISK}'` as never,
    )) as unknown as { n: number }[] | { rows: { n: number }[] };
    const n = Number(
      (Array.isArray(rows) ? rows[0]?.n : rows.rows?.[0]?.n) ?? -1,
    );
    expect(
      n,
      "Der Laufzeit-Pool sieht eine Zeile ohne Mandantenkontext — RLS greift " +
        "auf dieser Verbindung nicht.",
    ).toBe(0);
  });
});
