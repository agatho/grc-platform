// notify-org-context.test.ts — [ARCTOS-FULL-2026-08-31 · OP-169]
//
// Der Befund: `insertNotification` schrieb ohne Organisationskontext. Unter
// der Policy `notification_org_isolation`
// (`org_id = current_setting('app.current_org_id')`) ist dieser INSERT nicht
// erlaubt; gemessen als
// `new row violates row-level security policy for table "notification"`,
// sobald die Verbindung ueber die produktionsnahe Rolle `grc_app` laeuft.
// 41 der 44 Cron-Jobs setzen keinen Kontext — sie schrieben bisher nur
// deshalb erfolgreich, weil die Worker-Rolle BYPASSRLS traegt.
//
// WARUM DIESER TEST OHNE DATENBANK LAEUFT: Der Datenbanktest
// `job-runtime.db.test.ts` deckt denselben Fall ab — aber nur, wenn die
// Umgebung `APP_DATABASE_URL` setzt. Genau daran ist der Befund vorher
// vorbeigelaufen. Ein Tor, das nur unter einer ungenannten Bedingung
// ausloest, ist kein Tor. Dieser Test haelt die Zusicherung deshalb
// bedingungslos: er prueft am Aufrufmuster nach, DASS der Kontext gesetzt
// wird, und braucht dafuer weder Rolle noch Server.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Aufzeichnung der Datenbankaufrufe ─────────────────────────────────
type Recorded = { kind: "execute"; text: string } | { kind: "insert" };

const recorded: Recorded[] = [];
let transactionOpened = 0;

function makeInsertChain() {
  return {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            recorded.push({ kind: "insert" });
            return [{ id: "written" }];
          },
        }),
      }),
    }),
  };
}

const tx = {
  ...makeInsertChain(),
  execute: async (q: unknown) => {
    // Drizzles `sql`-Vorlage traegt die Bruchstuecke in `queryChunks`; fuer
    // die Zusicherung genuegt die serialisierte Form.
    recorded.push({ kind: "execute", text: JSON.stringify(q) });
    return [];
  },
};

const db = {
  ...makeInsertChain(),
  transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
    transactionOpened++;
    return fn(tx);
  },
};

vi.mock("@grc/db", () => ({
  db,
  notification: {
    orgId: { name: "org_id" },
    dedupeKey: { name: "dedupe_key" },
    id: { name: "id" },
  },
}));

vi.mock("@grc/email", () => ({
  isEmailTemplateKey: () => true,
}));

vi.mock("../../src/lib/job-runtime", () => ({
  reportJobError: () => {},
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";

async function insertNotification() {
  return (await import("../../src/lib/notify")).insertNotification;
}

beforeEach(() => {
  recorded.length = 0;
  transactionOpened = 0;
});

describe("insertNotification setzt den Organisationskontext (OP-169)", () => {
  it("oeffnet eine Transaktion und setzt app.current_org_id vor dem INSERT", async () => {
    const insert = await insertNotification();

    const written = await insert(
      {
        userId: USER,
        orgId: ORG,
        type: "deadline_approaching",
        title: "Kontextprobe",
        channel: "in_app",
      } as never,
      { job: "test" },
    );

    expect(written).toBe(true);
    expect(transactionOpened).toBe(1);

    // Reihenfolge ist die Zusicherung: erst der Kontext, dann der Schreibvorgang.
    expect(recorded.map((r) => r.kind)).toEqual(["execute", "insert"]);

    const setzen = recorded[0];
    expect(setzen.kind).toBe("execute");
    if (setzen.kind !== "execute") throw new Error("unerwartet");
    expect(setzen.text).toContain("app.current_org_id");
    expect(setzen.text).toContain(ORG);
  });

  it("laesst eine uebergebene Transaktion unangetastet — dort haelt der Aufrufer den Kontext", async () => {
    const insert = await insertNotification();

    const fremdeTx = makeInsertChain();

    const written = await insert(
      {
        userId: USER,
        orgId: ORG,
        type: "escalation",
        title: "Kontextprobe mit eigener Transaktion",
        channel: "in_app",
      } as never,
      { job: "test", tx: fremdeTx as never },
    );

    expect(written).toBe(true);
    // Kein eigener Transaktionsrahmen, kein set_config: ein `SET LOCAL` von
    // hier aus wuerde den Kontext des Aufrufers fuer den Rest SEINER
    // Transaktion ueberschreiben.
    expect(transactionOpened).toBe(0);
    // Geschrieben wird sehr wohl — nur eben auf der Transaktion des
    // Aufrufers und ohne ein `set_config` von hier aus.
    expect(recorded.map((r) => r.kind)).toEqual(["insert"]);
  });

  it("ohne org_id wird kein Kontext geraten", async () => {
    const insert = await insertNotification();

    await insert(
      {
        userId: USER,
        type: "escalation",
        title: "Ohne Organisation",
        channel: "in_app",
      } as never,
      { job: "test" },
    );

    expect(transactionOpened).toBe(0);
    expect(recorded.filter((r) => r.kind === "execute")).toEqual([]);
  });
});
