import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAppDb, createTestDb } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-087] Dauerschutz der
 * RLS-Invarianten (Migration 0477).
 *
 * ---------------------------------------------------------------------------
 * Was hier geprueft wird und warum es ein Tor ist
 * ---------------------------------------------------------------------------
 * Der Waechter aus 0397 haengt an `ddl_command_end` mit fuenf CREATE-Tags. Er
 * deckt die Richtung ab, in der etwas ENTSTEHT. Die Gegenrichtung — RLS
 * abschalten, FORCE zuruecknehmen, die letzte Policy droppen — hatte kein
 * Ereignis. Was danach gesprochen haette, waren das Coverage-Tor und der
 * RLS-Systemtest: eine Meldung im naechsten CI-Lauf, kein Schutz im Moment
 * der Aenderung.
 *
 * Jeder Test hier setzt genau eine dieser drei Anweisungen ab und liest
 * danach den KATALOG, nicht das Protokoll. Ein Test, der nur nachsaehe, ob
 * eine Zeile geschrieben wurde, wuerde wieder nur die Meldung pruefen.
 *
 * Der letzte Test ist der wichtigste: das Muster
 * `DROP POLICY x; CREATE POLICY x;` in EINER Transaktion kommt 114-mal in 56
 * Migrationsdateien vor. Der naheliegende Ausbau — beim DROP sofort
 * reparieren — bricht es mit 42710. Deshalb prueft 0477 erst beim COMMIT.
 */

const adminDb = createTestDb();
const PROBE = "op087_probe";

/** Zustand einer Tabelle im Katalog — die einzige Quelle, der dieser Test glaubt. */
async function state(table: string) {
  const rows = await adminDb.client<
    { rls: boolean; forced: boolean; policies: string[] }[]
  >`
    SELECT c.relrowsecurity AS rls,
           c.relforcerowsecurity AS forced,
           coalesce(
             (SELECT array_agg(p.policyname ORDER BY p.policyname)
                FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname),
             '{}'::text[]
           ) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ${table}
  `;
  return rows[0];
}

async function log(table: string) {
  return adminDb.client<{ command_tag: string; outcome: string }[]>`
    SELECT command_tag, outcome
      FROM public.arctos_rls_guard_event
     WHERE table_name = ${table}
     ORDER BY id
  `;
}

beforeAll(async () => {
  await adminDb.client.unsafe(`DROP TABLE IF EXISTS public.${PROBE}`);
  await adminDb.client.unsafe(
    `DELETE FROM public.arctos_rls_guard_event WHERE table_name = '${PROBE}'`,
  );
  // Der Waechter aus 0397 gibt einer neuen Mandantentabelle RLS, FORCE und
  // eine Policy. Das ist hier Vorbedingung, nicht Pruefgegenstand — aber wenn
  // es nicht mehr stimmt, misst der ganze Rest gegen einen falschen Anfang.
  await adminDb.client.unsafe(
    `CREATE TABLE public.${PROBE} (id int PRIMARY KEY, org_id uuid)`,
  );
});

afterAll(async () => {
  await adminDb.client.unsafe(`DROP TABLE IF EXISTS public.${PROBE}`);
  // Die Beweiszeilen dieser Tabelle wieder entfernen: 0477 leert das
  // Protokoll bewusst nie, aber ein Test darf seine eigenen Spuren nicht als
  // Vorfaelle hinterlassen.
  await adminDb.client.unsafe(
    `DELETE FROM public.arctos_rls_guard_event WHERE table_name = '${PROBE}'`,
  );
  await adminDb.client.end();
});

describe("OP-087 — Dauerschutz statt Meldung nach der Tat", () => {
  it("die Waechter stehen auf ENABLE ALWAYS", async () => {
    const evt = await adminDb.client<{ evtname: string; evtenabled: string }[]>`
      SELECT evtname, evtenabled::text AS evtenabled
        FROM pg_event_trigger
       WHERE evtname LIKE 'arctos_rls_guard%'
       ORDER BY evtname
    `;
    expect(evt.map((e) => e.evtname)).toEqual([
      "arctos_rls_guard_alter_trg",
      "arctos_rls_guard_drop_policy_trg",
      "arctos_rls_guard_trg",
    ]);
    // 'A' = ALWAYS. Auf der Voreinstellung ('O' = origin) schaltet ein
    // `SET session_replication_role = 'replica'` den Schutz ab — und genau
    // das ist im Betrieb dieses Repositories ein gebrauchtes Mittel.
    expect(evt.map((e) => e.evtenabled)).toEqual(["A", "A", "A"]);

    const con = await adminDb.client<
      { tgenabled: string; tgdeferrable: boolean }[]
    >`
      SELECT tgenabled::text AS tgenabled, tgdeferrable
        FROM pg_trigger WHERE tgname = 'arctos_rls_guard_settle_trg'
    `;
    expect(con[0]?.tgenabled).toBe("A");
    expect(con[0]?.tgdeferrable).toBe(true);
  });

  it("die neue Mandantentabelle startet geschuetzt (Vorbedingung)", async () => {
    const s = await state(PROBE);
    expect(s.rls).toBe(true);
    expect(s.forced).toBe(true);
    expect(s.policies.length).toBeGreaterThan(0);
  });

  it("ALTER TABLE … DISABLE ROW LEVEL SECURITY wird zurueckgenommen", async () => {
    await adminDb.client.unsafe(
      `ALTER TABLE public.${PROBE} DISABLE ROW LEVEL SECURITY`,
    );
    const s = await state(PROBE);
    expect(s.rls).toBe(true);
    const entries = await log(PROBE);
    expect(entries.at(-1)).toMatchObject({
      command_tag: "ALTER TABLE",
      outcome: "repaired",
    });
  });

  it("ALTER TABLE … NO FORCE ROW LEVEL SECURITY wird zurueckgenommen", async () => {
    await adminDb.client.unsafe(
      `ALTER TABLE public.${PROBE} NO FORCE ROW LEVEL SECURITY`,
    );
    const s = await state(PROBE);
    expect(s.forced).toBe(true);
  });

  it("DROP POLICY der letzten Policy stellt die Mandantentrennung wieder her", async () => {
    const before = await state(PROBE);
    for (const p of before.policies) {
      await adminDb.client.unsafe(`DROP POLICY "${p}" ON public.${PROBE}`);
    }
    const s = await state(PROBE);
    expect(s.rls).toBe(true);
    expect(s.forced).toBe(true);
    expect(s.policies).toContain(`${PROBE}_org_isolation`);
    const entries = await log(PROBE);
    expect(entries.some((e) => e.command_tag === "DROP POLICY")).toBe(true);
  });

  it("die wiederhergestellte Policy traegt das Normalform-Praedikat aus 0397", async () => {
    const rows = await adminDb.client<{ qual: string }[]>`
      SELECT qual FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ${PROBE}
         AND policyname = ${`${PROBE}_org_isolation`}
    `;
    // Nicht „irgendeine Policy", sondern die Org-Bindung. Eine Policy
    // `USING (true)` waere formal auch eine Policy.
    expect(rows[0]?.qual).toContain("app.current_org_id");
    expect(rows[0]?.qual).toContain("org_id");
  });

  it("das legitime DROP+CREATE derselben Policy in EINER Transaktion laeuft durch", async () => {
    // Genau das Muster aus 114 Stellen in 56 Migrationsdateien. Repariert der
    // Waechter beim DROP statt beim COMMIT, scheitert das CREATE mit 42710.
    const name = `${PROBE}_org_isolation`;
    await adminDb.client.begin(async (tx) => {
      await tx.unsafe(`DROP POLICY "${name}" ON public.${PROBE}`);
      await tx.unsafe(
        `CREATE POLICY "${name}" ON public.${PROBE} FOR ALL ` +
          `USING (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)`,
      );
    });
    const s = await state(PROBE);
    // Genau EINE Policy — haette der Waechter eine zweite angelegt, staenden
    // hier zwei.
    expect(s.policies).toEqual([name]);
    const entries = await log(PROBE);
    expect(entries.at(-1)?.outcome).toBe("settled");
  });

  it("greift auch unter session_replication_role = 'replica'", async () => {
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    try {
      await adminDb.client.unsafe(
        `ALTER TABLE public.${PROBE} DISABLE ROW LEVEL SECURITY`,
      );
      const s = await state(PROBE);
      expect(s.rls).toBe(true);
    } finally {
      await adminDb.client.unsafe(`RESET session_replication_role`);
    }
  });

  it("eine bewusste Ausnahme ist moeglich, aber benannt und protokolliert", async () => {
    await adminDb.client.begin(async (tx) => {
      await tx.unsafe(
        `SET LOCAL arctos.rls_guard_allow_unprotected = '${PROBE}'`,
      );
      await tx.unsafe(`ALTER TABLE public.${PROBE} DISABLE ROW LEVEL SECURITY`);
    });
    expect((await state(PROBE)).rls).toBe(false);
    const entries = await log(PROBE);
    expect(entries.at(-1)?.outcome).toBe("exempted");
    // wieder schliessen, damit der Rest der Datei nicht auf einer offenen
    // Tabelle misst
    await adminDb.client.unsafe(
      `ALTER TABLE public.${PROBE} ENABLE ROW LEVEL SECURITY`,
    );
    expect((await state(PROBE)).rls).toBe(true);
  });

  it("keine Mandantentabelle der Datenbank steht ungeschuetzt", async () => {
    const rows = await adminDb.client<{ relname: string; grund: string }[]>`
      SELECT c.relname, public.arctos_rls_unprotected(c.relname) AS grund
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND public.arctos_rls_unprotected(c.relname) IS NOT NULL
       ORDER BY c.relname
    `;
    expect(rows).toEqual([]);
  });

  it("die Anwendungsrolle kommt an das Waechterprotokoll nicht heran", async () => {
    // Gemessen, nicht aus der Rechteliste gelesen. Der Unterschied ist der
    // Befund: ein `REVOKE` auf dieser Tabelle haelt NICHT. Zehn Dateien unter
    // tests/rls und __tests__/rls-route-chain, dazu scripts/setup.sh und
    // deploy/provision-grc-app.sh, setzen
    // `GRANT … ON ALL TABLES IN SCHEMA public TO grc_app` — pauschal, ueber
    // jede Tabelle, die es gerade gibt. Nach einem Lauf der RLS-Suite stand
    // `grc_app=arwd` wieder auf der Tabelle. Haltbar ist deshalb nur die
    // Deny-Policy aus 0477, und genau die wird hier geprueft: als Rolle
    // `grc_app` verbunden, nicht als Eigentuemer.
    // Erst das GRANT, das die Realitaet ohnehin vergibt — sonst misst dieser
    // Test die Rechtevergabe statt der Policy und ist von der Reihenfolge der
    // uebrigen Suiten abhaengig (gemessen: allein gruen, im Verbund rot, weil
    // ein anderer Test vorher `GRANT … ON ALL TABLES` gesetzt hatte).
    await adminDb.client.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON public.arctos_rls_guard_event TO grc_app`,
    );
    const app = createAppDb();
    try {
      const visible = await app.client`
        SELECT count(*)::int AS n FROM public.arctos_rls_guard_event
      `;
      expect(visible[0]?.n).toBe(0);

      // Ein INSERT waere der scharfe Weg: er wuerde den aufgeschobenen
      // SECURITY-DEFINER-Trigger fuer eine frei gewaehlte Tabelle ausloesen.
      await expect(
        app.client`
          INSERT INTO public.arctos_rls_guard_event (table_name, command_tag)
          VALUES ('risk', 'ALTER TABLE')
        `,
      ).rejects.toThrow();

      // Und die Beweiszeilen bleiben unloeschbar — der Eigentuemer sieht sie
      // weiterhin, die Anwendungsrolle loescht nichts.
      const before = await adminDb.client`
        SELECT count(*)::int AS n FROM public.arctos_rls_guard_event
      `;
      await app.client`DELETE FROM public.arctos_rls_guard_event`;
      const after = await adminDb.client`
        SELECT count(*)::int AS n FROM public.arctos_rls_guard_event
      `;
      expect(after[0]?.n).toBe(before[0]?.n);
    } finally {
      await app.client.end();
    }
  });
});
