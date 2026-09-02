import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, createAppDb } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-085] Sitzungs-Invalidierung beim Rollenentzug.
 *
 * Befund (WP2/S01-22, an WP3 uebergeben): "nach Entzug einer Mitgliedschaft
 * behaelt das JWT die Rolle bis zum naechsten Refresh, und RLS kennt nur den
 * GUC, nicht die Mitgliedschaft."
 *
 * Migration 0457 fuehrt `user.sessions_valid_from` ein — eine Epoche je
 * Nutzer — und die Kapsel `auth_invalidate_user_sessions(user, actor)`.
 * `apps/web/src/auth.ts` vergleicht sie im `session`-Callback mit `token.iat`.
 *
 * Was dieser Test misst, ist die DATENBANKHAELFTE: dass die Epoche gesetzt
 * wird, dass sie nach vorn springt, und — der Teil, der eine reine
 * UPDATE-Loesung scheitern lassen wuerde — dass sie sich auch dann noch setzen
 * laesst, wenn dem Betroffenen GERADE die letzte Mitgliedschaft entzogen
 * wurde. Und dass ein Administrator sie nicht ueber die Mandantengrenze hinweg
 * setzen kann.
 *
 * Die JWT-Haelfte (iat-Vergleich) liegt in `apps/web/src/auth.ts` und ist
 * hier bewusst nicht nachgebaut: ein Nachbau der Callback-Logik wuerde nur
 * sich selbst pruefen.
 */

const admin = createTestDb();
const app = createAppDb(process.env.APP_DATABASE_URL);
const suffix = Date.now();

let orgAId: string;
let orgBId: string;
let adminAId: string; // Administrator in Org A
let victimId: string; // Nutzer in Org A, dem die Rolle entzogen wird
let strangerId: string; // Nutzer ausschliesslich in Org B
let victimRoleId: string;

beforeAll(async () => {
  const [oA] = await admin.client<{ id: string }[]>`
    INSERT INTO organization (name) VALUES (${`OP085 A ${suffix}`}) RETURNING id`;
  const [oB] = await admin.client<{ id: string }[]>`
    INSERT INTO organization (name) VALUES (${`OP085 B ${suffix}`}) RETURNING id`;
  orgAId = oA.id;
  orgBId = oB.id;

  const mkUser = async (label: string) => {
    const [u] = await admin.client<{ id: string }[]>`
      INSERT INTO "user" (email, name, is_active)
      VALUES (${`op085.${label}.${suffix}@example.test`}, ${`OP085 ${label}`}, true)
      RETURNING id`;
    return u.id;
  };
  adminAId = await mkUser("admin");
  victimId = await mkUser("victim");
  strangerId = await mkUser("stranger");

  await admin.client`
    INSERT INTO user_organization_role (user_id, org_id, role)
    VALUES (${adminAId}, ${orgAId}, 'admin')`;
  const [vr] = await admin.client<{ id: string }[]>`
    INSERT INTO user_organization_role (user_id, org_id, role)
    VALUES (${victimId}, ${orgAId}, 'process_owner') RETURNING id`;
  victimRoleId = vr.id;
  await admin.client`
    INSERT INTO user_organization_role (user_id, org_id, role)
    VALUES (${strangerId}, ${orgBId}, 'admin')`;
});

afterAll(async () => {
  await admin.client.unsafe(`SET session_replication_role = 'replica'`);
  await admin.client.unsafe(
    `DELETE FROM user_organization_role WHERE user_id IN ('${adminAId}', '${victimId}', '${strangerId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM access_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM "user" WHERE id IN ('${adminAId}', '${victimId}', '${strangerId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(`SET session_replication_role = 'origin'`);
  await admin.client.end({ timeout: 5 });
  await app.client.end({ timeout: 5 });
});

async function epochOf(userId: string): Promise<Date | null> {
  const [row] = await admin.client<{ v: string | Date | null }[]>`
    SELECT sessions_valid_from AS v FROM "user" WHERE id = ${userId}`;
  if (!row?.v) return null;
  return row.v instanceof Date ? row.v : new Date(row.v);
}

describe("OP-085 — Sitzungs-Epoche", () => {
  it("ist zu Beginn leer — eine frische Anmeldung wird nicht ohne Grund beendet", async () => {
    expect(await epochOf(victimId)).toBeNull();
  });

  it("ein Administrator derselben Org kann die Sitzung beenden", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${orgAId}, false),
                            set_config('app.current_user_id', ${adminAId}, false)`;
    const before = Date.now();
    await app.client`
      SELECT public.auth_invalidate_user_sessions(${victimId}::uuid, ${adminAId}::uuid)`;
    const epoch = await epochOf(victimId);
    expect(epoch).not.toBeNull();
    // Kein Zukunftswert und kein Wert aus der Vergangenheit: now().
    expect(epoch!.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect(epoch!.getTime()).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  it("KERNFALL: sie laesst sich auch NACH dem Entzug der letzten Rolle noch setzen", async () => {
    // Genau hier waere ein UPDATE aus der Route heraus gescheitert:
    // `user_tenant_update` erlaubt dem Administrator die fremde Zeile nur ueber
    // die Mitgliedschaft, und die ist jetzt weg. Die Reihenfolge der Route
    // (erst entziehen, dann invalidieren) ist die fachlich richtige — der Fix
    // muss also mit ihr umgehen koennen.
    await admin.client`
      UPDATE user_organization_role SET deleted_at = now() WHERE id = ${victimRoleId}`;

    await app.client`SELECT set_config('app.current_org_id', ${orgAId}, false),
                            set_config('app.current_user_id', ${adminAId}, false)`;

    // BEOBACHTUNG, gemessen und bewusst NICHT als Erwartung formuliert:
    // ein direktes UPDATE trifft hier HEUTE noch eine Zeile, weil das
    // Mitgliedschaftspraedikat der `user`-Policy (0392, unveraendert durch
    // 0456) `user_organization_role.deleted_at` nicht filtert:
    //
    //   EXISTS (SELECT 1 FROM user_organization_role r
    //            WHERE r.user_id = "user".id AND r.org_id = <org-GUC>)
    //
    // Eine beendete Mitgliedschaft macht den Nutzer fuer die Org also weiter
    // sichtbar UND aenderbar. Fuer SELECT ist das vertretbar (die Org muss die
    // Namen frueherer Akteure in ihren Audit-Eintraegen aufloesen koennen);
    // fuer UPDATE ist es fragwuerdig. Das ist eine eigene Entscheidung mit
    // Folgen fuer die Oberflaeche und gehoert nicht in diese Welle — sie ist
    // im Protokoll als Weitergabe vermerkt.
    //
    // Fuer OP-085 ist wichtig: die Kapsel haengt NICHT an dieser Lockerung.
    // Wird das Praedikat spaeter verschaerft, bleibt sie richtig.
    const previous = await epochOf(victimId);
    await new Promise((r) => setTimeout(r, 25));
    await app.client`
      SELECT public.auth_invalidate_user_sessions(${victimId}::uuid, ${adminAId}::uuid)`;
    const now = await epochOf(victimId);
    expect(now!.getTime()).toBeGreaterThan(previous!.getTime());
  });

  it("ueber die Mandantengrenze hinweg geht sie NICHT", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${orgBId}, false),
                            set_config('app.current_user_id', ${strangerId}, false)`;
    await expect(
      app.client`SELECT public.auth_invalidate_user_sessions(${victimId}::uuid, ${strangerId}::uuid)`,
    ).rejects.toThrow(/keine gemeinsame Organisation/);
  });

  it("die eigene Sitzung darf jeder beenden (Passwortwechsel, 'ueberall abmelden')", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${orgBId}, false),
                            set_config('app.current_user_id', ${strangerId}, false)`;
    await app.client`
      SELECT public.auth_invalidate_user_sessions(${strangerId}::uuid, ${strangerId}::uuid)`;
    expect(await epochOf(strangerId)).not.toBeNull();
  });

  it("die Kapsel ist PUBLIC entzogen und nur grc_app erteilt (S01-13)", async () => {
    const [row] = await admin.client<{ acl: string }[]>`
      SELECT coalesce(array_to_string(p.proacl, ','), '') AS acl
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'auth_invalidate_user_sessions'`;
    expect(row.acl).not.toMatch(/(^|,)=X\//);
    expect(row.acl).toMatch(/grc_app=X\//);
  });
});
