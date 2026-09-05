import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAppDb, createTestDb, requireAt } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 / Welle 4c · OP-089] Die zwei Nutzungs-Sichten
 * dürfen nicht mandantenübergreifend materialisiert sein (Migration 0478).
 *
 * ---------------------------------------------------------------------------
 * Was hier geprüft wird und warum es ein Tor ist
 * ---------------------------------------------------------------------------
 * Migration 0393 hat `copilot_usage_stats` und `evidence_review_summary` den
 * Lesezugriff entzogen, weil eine Materialized View kein `security_invoker`
 * kennt. Der Lesepfad war damit zu, die Materialisierung blieb: die Zahlen
 * aller Mandanten lagen weiter in EINER Relation. Gemessen am 2026-09-03 auf
 * dem Stand vor 0478, als `grc_app` mit dem Kontext von Org A:
 *
 *     Basistabelle copilot_conversation     | 1 Zeile  | 1 Mandant
 *     MATERIALIZED VIEW copilot_usage_stats | 2 Zeilen | 2 Mandanten
 *
 * Der erste Test ist deshalb der eigentliche: er prüft nicht die zwei
 * bekannten Objekte, sondern die KLASSE — in `public` darf es überhaupt keine
 * Materialized View geben. Eine Prüfung auf die zwei Namen wäre am Tag grün,
 * an dem jemand eine dritte anlegt.
 *
 * Die übrigen Tests weisen nach, dass der Ersatz trägt: `security_invoker` am
 * Objekt, und — die einzige Aussage, die wirklich zählt — je Mandant genau
 * seine eigene Aggregation, ohne Kontext gar nichts.
 *
 * Voraussetzungen wie beim übrigen RLS-Systemtest: DATABASE_URL zeigt auf
 * eine migrierte Datenbank, die Rolle `grc_app` existiert.
 */

const admin = createTestDb();
const app = createAppDb();

const ORG_A = "a0890000-0000-4000-8000-000000000001";
const ORG_B = "a0890000-0000-4000-8000-000000000002";
const USER = "a0890000-0000-4000-8000-0000000000a1";

const VIEWS = ["copilot_usage_stats", "evidence_review_summary"] as const;

async function setOrg(orgId: string) {
  await app.client`SELECT set_config('app.current_org_id', ${orgId}, false),
                          set_config('app.current_user_id', ${USER}, false)`;
}

async function cleanup() {
  await admin.client`DELETE FROM evidence_review_gap
                      WHERE job_id IN (SELECT id FROM evidence_review_job
                                        WHERE org_id IN (${ORG_A}, ${ORG_B}))`;
  await admin.client`DELETE FROM evidence_review_job WHERE org_id IN (${ORG_A}, ${ORG_B})`;
  await admin.client`DELETE FROM copilot_feedback WHERE org_id IN (${ORG_A}, ${ORG_B})`;
  await admin.client`DELETE FROM copilot_message WHERE org_id IN (${ORG_A}, ${ORG_B})`;
  await admin.client`DELETE FROM copilot_conversation WHERE org_id IN (${ORG_A}, ${ORG_B})`;
}

beforeAll(async () => {
  await cleanup();
  // Zwei Organisationen und ein Nutzer. `ON CONFLICT DO NOTHING`, damit ein
  // abgebrochener Vorlauf den Test nicht an seiner Vorbedingung sterben
  // lässt — genau diese Fehlerform (OP-109) hat in diesem Audit schon einmal
  // einen Test grün aussehen lassen, der nichts geprüft hat.
  await admin.client`
    INSERT INTO organization (id, name, type, country)
    VALUES (${ORG_A}, 'OP-089 Org A', 'holding', 'DE'),
           (${ORG_B}, 'OP-089 Org B', 'holding', 'DE')
    ON CONFLICT (id) DO NOTHING`;
  await admin.client`
    INSERT INTO "user" (id, email, name)
    VALUES (${USER}, 'op089@arctos.test', 'OP-089')
    ON CONFLICT (id) DO NOTHING`;

  // Org A: ein Gespräch mit 100 Token; Org B: eines mit 900. Die Zahlen sind
  // unterschiedlich, damit ein Leck nicht nur an der Zeilenzahl, sondern auch
  // am Wert erkennbar ist.
  await admin.client`
    INSERT INTO copilot_conversation
      (org_id, user_id, title, message_count, total_tokens_used, last_message_at)
    VALUES (${ORG_A}, ${USER}, 'OP-089 A', 3, 100, now()),
           (${ORG_B}, ${USER}, 'OP-089 B', 5, 900, now())`;
  await admin.client`
    INSERT INTO evidence_review_job
      (org_id, name, scope, status, total_artifacts, compliant_artifacts,
       non_compliant_artifacts, gaps_identified, created_by)
    VALUES (${ORG_A}, 'OP-089 A', 'a', 'completed', 10, 8, 2, 2, ${USER}),
           (${ORG_B}, 'OP-089 B', 'b', 'completed', 20, 15, 5, 5, ${USER})`;
});

afterAll(async () => {
  await cleanup();
  await admin.client.end();
  await app.client.end();
});

describe("OP-089 — keine mandantenübergreifende Materialisierung", () => {
  it("das Schema public enthält keine einzige Materialized View", async () => {
    const rows = await admin.client<{ relname: string }[]>`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'm'
       ORDER BY c.relname`;
    // Eine Materialized View wird beim REFRESH unter ihrem Eigentümer
    // gefüllt und kann keine RLS tragen; jede neue wäre wieder OP-089.
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it.each(VIEWS)(
    "%s ist eine gewöhnliche View mit security_invoker = true",
    async (view) => {
      const rows = await admin.client<
        { relkind: string; options: string[] | null }[]
      >`
        SELECT c.relkind::text AS relkind, c.reloptions AS options
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = ${view}`;
      expect(rows).toHaveLength(1);
      expect(requireAt(rows, 0, "rows").relkind).toBe("v");
      expect(requireAt(rows, 0, "rows").options ?? []).toContain(
        "security_invoker=true",
      );
    },
  );
});

describe("OP-089 — jede Organisation sieht ausschliesslich ihre eigene Aggregation", () => {
  it("copilot_usage_stats liefert je Kontext genau eine Zeile mit den eigenen Zahlen", async () => {
    await setOrg(ORG_A);
    const a = await app.client<{ org_id: string; total_tokens: string }[]>`
      SELECT org_id, total_tokens FROM copilot_usage_stats`;
    expect(a).toHaveLength(1);
    expect(requireAt(a, 0, "a").org_id).toBe(ORG_A);
    expect(Number(requireAt(a, 0, "a").total_tokens)).toBe(100);

    await setOrg(ORG_B);
    const b = await app.client<{ org_id: string; total_tokens: string }[]>`
      SELECT org_id, total_tokens FROM copilot_usage_stats`;
    expect(b).toHaveLength(1);
    expect(requireAt(b, 0, "b").org_id).toBe(ORG_B);
    expect(Number(requireAt(b, 0, "b").total_tokens)).toBe(900);
  });

  it("evidence_review_summary liefert je Kontext genau eine Zeile mit den eigenen Zahlen", async () => {
    await setOrg(ORG_A);
    const a = await app.client<
      { org_id: string; total_artifacts_reviewed: string }[]
    >`SELECT org_id, total_artifacts_reviewed FROM evidence_review_summary`;
    expect(a).toHaveLength(1);
    expect(requireAt(a, 0, "a").org_id).toBe(ORG_A);
    expect(Number(requireAt(a, 0, "a").total_artifacts_reviewed)).toBe(10);

    await setOrg(ORG_B);
    const b = await app.client<
      { org_id: string; total_artifacts_reviewed: string }[]
    >`SELECT org_id, total_artifacts_reviewed FROM evidence_review_summary`;
    expect(b).toHaveLength(1);
    expect(requireAt(b, 0, "b").org_id).toBe(ORG_B);
    expect(Number(requireAt(b, 0, "b").total_artifacts_reviewed)).toBe(20);
  });

  it("der Eigentümer sieht beide Organisationen — sonst wäre der Test oben wertlos", async () => {
    // Gegenprobe zur Vorbedingung: die Daten BEIDER Organisationen sind
    // wirklich vorhanden. Ohne sie wäre „eine Zeile je Kontext" auch dann
    // erfüllt, wenn schlicht nichts eingespielt worden wäre.
    const rows = await admin.client<{ org_id: string }[]>`
      SELECT org_id FROM copilot_usage_stats
       WHERE org_id IN (${ORG_A}, ${ORG_B}) ORDER BY org_id`;
    expect(rows.map((r) => r.org_id)).toEqual([ORG_A, ORG_B]);
  });

  it.each(VIEWS)("%s liefert ohne Org-Kontext keine Zeile", async (view) => {
    await app.client`SELECT set_config('app.current_org_id', '', false)`;
    const rows = await app.client.unsafe(
      `SELECT count(*)::int AS n FROM ${view}`,
    );
    expect(requireAt(rows as unknown as { n: number }[], 0, view).n).toBe(0);
  });
});
