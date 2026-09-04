import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, createAppDb, requireRow, requireAt } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-086] `includeDescendants` im Audit-Log.
 *
 * Befund (WP2/S01-26, Status „teilweise"): die Route
 * `apps/web/src/app/api/v1/audit-log/route.ts` ermittelte ihre Org-Menge mit
 * einer rekursiven CTE ueber `organization`. Unter `grc_app` konnte die nie
 * ueber die eigene Zeile hinauskommen, weil `org_isolation_select` genau eine
 * Zeile zeigt — der Parameter nahm also eine 403 vor, verlangte eine
 * Rollenpruefung und aenderte danach nichts.
 *
 * Zwischenzeitlich hat Migration 0440 (E2E-Triage C-04, fuer den
 * Organisationswechsler) eine zweite, permissive SELECT-Policy ergaenzt, die
 * unter anderem `id IN (SELECT app_current_org_scope())` erlaubt. Damit
 * FUNKTIONIERT die CTE heute zufaellig — sie haengt aber an einer Policy, die
 * aus einem ganz anderen Grund existiert. Gemessen: mit der Policy in ihrer
 * heutigen Form liefert die CTE 3 Orgs, mit ihrer auf Mitgliedschaft
 * reduzierten Form 1, waehrend `app_current_org_scope()` in beiden Faellen 3
 * liefert.
 *
 * Die Route benutzt jetzt `app_current_org_scope()` — also GENAU die Menge, die
 * auch die SELECT-Policy von `audit_log` auswertet. Route und Datenbank
 * rechnen damit nicht mehr zwei Wahrheiten aus.
 *
 * Dieser Test misst die Wirkung, nicht die Schreibweise: sieht ein Elternteil
 * die Audit-Zeilen seines Kindes, und sieht es die eines unverwandten
 * Mandanten NICHT.
 */

const admin = createTestDb();
const app = createAppDb(process.env.APP_DATABASE_URL);
const suffix = Date.now();

let parentId: string;
let childId: string;
let grandchildId: string;
let strangerId: string;

async function mkOrg(name: string, parent?: string): Promise<string> {
  const o = requireRow(
    await admin.client<{ id: string }[]>`
    INSERT INTO organization (name, parent_org_id)
    VALUES (${`${name} ${suffix}`}, ${parent ?? null}) RETURNING id`,
    "o",
  );
  return o.id;
}

async function mkAuditRow(orgId: string) {
  // `entity_id` ist eine uuid — die Org selbst ist ein zulaessiger,
  // eindeutiger Wert und macht die Zeile zuordenbar.
  await admin.client`
    INSERT INTO audit_log (org_id, entity_type, entity_id, action)
    VALUES (${orgId}, 'op086_probe', ${orgId}, 'create')`;
}

beforeAll(async () => {
  parentId = await mkOrg("OP086 Konzern");
  childId = await mkOrg("OP086 Tochter", parentId);
  grandchildId = await mkOrg("OP086 Enkel", childId);
  strangerId = await mkOrg("OP086 Fremdmandant");

  await mkAuditRow(parentId);
  await mkAuditRow(childId);
  await mkAuditRow(grandchildId);
  await mkAuditRow(strangerId);
});

afterAll(async () => {
  await admin.client.unsafe(`SET session_replication_role = 'replica'`);
  const ids = [parentId, childId, grandchildId, strangerId]
    .map((i) => `'${i}'`)
    .join(",");
  await admin.client.unsafe(`DELETE FROM audit_log WHERE org_id IN (${ids})`);
  await admin.client.unsafe(`DELETE FROM organization WHERE id IN (${ids})`);
  await admin.client.unsafe(`SET session_replication_role = 'origin'`);
  await admin.client.end({ timeout: 5 });
  await app.client.end({ timeout: 5 });
});

async function scopeAs(orgId: string): Promise<string[]> {
  await app.client`SELECT set_config('app.current_org_id', ${orgId}, false)`;
  const rows = await app.client<{ id: string }[]>`
    SELECT id FROM public.app_current_org_scope() AS id`;
  return rows.map((r) => r.id).sort();
}

describe("OP-086 — Nachfahren-Sicht im Audit-Log", () => {
  it("app_current_org_scope() liefert die eigene Org PLUS alle Nachfahren", async () => {
    expect(await scopeAs(parentId)).toEqual(
      [parentId, childId, grandchildId].sort(),
    );
    // Von unten nach oben gilt sie NICHT — eine Tochter sieht ihre Mutter nicht.
    expect(await scopeAs(childId)).toEqual([childId, grandchildId].sort());
    expect(await scopeAs(strangerId)).toEqual([strangerId]);
  });

  it("die Menge, die die Route bildet, ist die Menge, die audit_log freigibt", async () => {
    // Genau die Abfrage der Route, gegen genau die Policy von audit_log.
    await app.client`SELECT set_config('app.current_org_id', ${parentId}, false)`;
    const rows = await app.client<{ org_id: string }[]>`
      SELECT DISTINCT org_id FROM audit_log
       WHERE entity_type = 'op086_probe'
         AND org_id IN (SELECT id FROM public.app_current_org_scope() AS id)`;
    expect(rows.map((r) => r.org_id).sort()).toEqual(
      [parentId, childId, grandchildId].sort(),
    );
  });

  it("ein unverwandter Mandant bleibt unsichtbar — auch mit includeDescendants", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${parentId}, false)`;
    const rows = await app.client`
      SELECT 1 FROM audit_log WHERE org_id = ${strangerId}`;
    expect(rows.length).toBe(0);
  });

  it("und umgekehrt: der Fremdmandant sieht die Konzern-Zeilen nicht", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${strangerId}, false)`;
    const rows = await app.client<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log
       WHERE entity_type = 'op086_probe'`;
    expect(requireAt(rows, 0, "rows").n).toBe(1); // nur die eigene
  });
});
