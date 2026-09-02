import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, createAppDb } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-083] Die `user`-Tabelle ohne Request-Kontext.
 *
 * Befund (WP2/S01-04, dort ausdruecklich als offene Restluecke stehen
 * gelassen): die `user`-Policy aus Migration 0392 trug eine dritte
 * Disjunktion — "oder die Verbindung traegt WEDER app.current_org_id NOCH
 * app.current_user_id". Sie stand dort, weil der Anmeldepfad `user` per
 * E-Mail lesen muss, bevor eine Identitaet feststeht.
 *
 * Der Preis war das gesamte Nutzerverzeichnis ALLER Mandanten auf jeder
 * kontextlosen Verbindung — also auf dem Basis-Pool, ueber den Login,
 * `admin-login` und die SCIM-Endpunkte liefen. Gemessen vor dem Fix:
 * 36 Zeilen mit Passwort-Hashes ohne Kontext, 1 Zeile mit Org-Kontext.
 *
 * Migration 0455 kapselt die Anmeldeabfrage in `auth_lookup_user_by_email`
 * (SECURITY DEFINER, eine Adresse rein, hoechstens eine Zeile raus), 0456
 * entfernt die Disjunktion.
 *
 * Dieser Test haelt beide Haelften fest. Die erste Erwartung ist die, die vor
 * 0456 FEHLGESCHLAGEN waere; die zweite sorgt dafuer, dass der Fix nicht
 * einfach die Anmeldung abschaltet — ohne sie waere "0 sichtbare Nutzer" auch
 * mit einer kaputten Datenbank erfuellt.
 *
 * Laeuft nur mit APP_DATABASE_URL auf `grc_app`. Unter `grc` oder `grc_worker`
 * ist RLS wirkungslos — der erste Testfall SCHLAEGT dann FEHL und nennt den
 * Grund. Bewusst kein Skip: ein uebersprungener Isolationstest liest sich im
 * Bericht wie ein bestandener (S11-02).
 */

const admin = createTestDb();
const app = createAppDb(process.env.APP_DATABASE_URL);
const suffix = Date.now();

let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
const emailA = `op083.a.${suffix}@example.test`;
const emailB = `op083.b.${suffix}@example.test`;

let isNonSuperuser = false;

beforeAll(async () => {
  const [role] = await app.client<
    { rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  isNonSuperuser = !!role && !role.rolsuper && !role.rolbypassrls;

  const [orgA] = await admin.client<{ id: string }[]>`
    INSERT INTO organization (name) VALUES (${`OP083 A ${suffix}`}) RETURNING id`;
  const [orgB] = await admin.client<{ id: string }[]>`
    INSERT INTO organization (name) VALUES (${`OP083 B ${suffix}`}) RETURNING id`;
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [uA] = await admin.client<{ id: string }[]>`
    INSERT INTO "user" (email, name, password_hash, is_active)
    VALUES (${emailA}, 'OP083 A', '$2b$10$notarealhashnotarealhashnotarealha', true)
    RETURNING id`;
  const [uB] = await admin.client<{ id: string }[]>`
    INSERT INTO "user" (email, name, password_hash, is_active)
    VALUES (${emailB}, 'OP083 B', '$2b$10$notarealhashnotarealhashnotarealha', true)
    RETURNING id`;
  userAId = uA.id;
  userBId = uB.id;

  await admin.client`
    INSERT INTO user_organization_role (user_id, org_id, role)
    VALUES (${userAId}, ${orgAId}, 'admin'), (${userBId}, ${orgBId}, 'admin')`;
});

afterAll(async () => {
  // Aufraeumen als Superuser mit abgeschalteten Triggern/Rules — dasselbe
  // Muster wie auth-bootstrap-rls.test.ts. Ohne das haelt die Append-only-
  // Regel auf `audit_log` die Fremdschluessel auf die Test-Orgs fest.
  await admin.client.unsafe(`SET session_replication_role = 'replica'`);
  await admin.client.unsafe(
    `DELETE FROM user_organization_role WHERE user_id IN ('${userAId}', '${userBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM access_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM "user" WHERE id IN ('${userAId}', '${userBId}')`,
  );
  await admin.client.unsafe(
    `DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}')`,
  );
  await admin.client.unsafe(`SET session_replication_role = 'origin'`);
  await admin.client.end({ timeout: 5 });
  await app.client.end({ timeout: 5 });
});

/** Beide GUCs leeren — der Zustand des Basis-Pools. */
async function clearContext() {
  await app.client`SELECT set_config('app.current_org_id', '', false),
                          set_config('app.current_user_id', '', false)`;
}

describe("OP-083 — `user` ohne Request-Kontext", () => {
  it("Voraussetzung: die Testverbindung ist nicht privilegiert", () => {
    if (!isNonSuperuser) {
      throw new Error(
        "APP_DATABASE_URL zeigt nicht auf eine unprivilegierte Rolle — " +
          "unter grc/grc_worker ist RLS wirkungslos und dieser Test misst nichts. " +
          "APP_DATABASE_URL=postgresql://grc_app:…",
      );
    }
    expect(isNonSuperuser).toBe(true);
  });

  it("REPRODUKTION: ohne jeden Kontext ist KEINE user-Zeile sichtbar", async () => {
    await clearContext();
    const rows = await app.client<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "user"`;
    // Vor 0456 stand hier die Gesamtzahl aller Nutzer aller Mandanten.
    expect(rows[0].n).toBe(0);
  });

  it("ohne Kontext ist auch kein Passwort-Hash lesbar", async () => {
    await clearContext();
    const rows = await app.client`
      SELECT email FROM "user" WHERE email IN (${emailA}, ${emailB})`;
    expect(rows.length).toBe(0);
  });

  it("die Anmeldekapsel liefert die Zeile trotzdem — sonst waere der Fix ein Ausschalter", async () => {
    await clearContext();
    const rows = await app.client<{ id: string; email: string }[]>`
      SELECT id, email FROM public.auth_lookup_user_by_email(${emailA})`;
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(userAId);
  });

  it("die Kapsel ist kein Verzeichnis: unbekannte Adresse -> 0 Zeilen, kein Praefix-Zugriff", async () => {
    await clearContext();
    const miss = await app.client`
      SELECT * FROM public.auth_lookup_user_by_email(${`nicht.da.${suffix}@example.test`})`;
    expect(miss.length).toBe(0);
    // Es gibt keine Listenform und kein LIKE — wer die Adresse nicht kennt,
    // bekommt nichts. Der Praefix der Testadressen fuehrt zu keinem Treffer.
    const prefix = await app.client`
      SELECT * FROM public.auth_lookup_user_by_email(${`op083.a.${suffix}`})`;
    expect(prefix.length).toBe(0);
  });

  it("mit Org-Kontext: nur Mitglieder der eigenen Org, nicht die des Nachbarn", async () => {
    await app.client`SELECT set_config('app.current_org_id', ${orgAId}, false),
                            set_config('app.current_user_id', '', false)`;
    const own = await app.client<{ email: string }[]>`
      SELECT email FROM "user" WHERE email IN (${emailA}, ${emailB})`;
    expect(own.map((r) => r.email)).toEqual([emailA]);
  });

  it("mit Nutzer-Kontext: die eigene Zeile bleibt sichtbar, eine fremde nicht", async () => {
    await app.client`SELECT set_config('app.current_org_id', '', false),
                            set_config('app.current_user_id', ${userAId}, false)`;
    const own = await app.client<{ email: string }[]>`
      SELECT email FROM "user" WHERE email IN (${emailA}, ${emailB})`;
    expect(own.map((r) => r.email)).toEqual([emailA]);
  });

  it("keine `user`-Policy stellt mehr auf die ABWESENHEIT eines Kontexts ab", async () => {
    const rows = await admin.client<{ policyname: string; expr: string }[]>`
      SELECT policyname,
             coalesce(qual,'') || ' ' || coalesce(with_check,'') AS expr
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'user'`;
    // Am NORMALISIERTEN Ausdruck gemessen, den `pg_policies` zurueckgibt:
    // PostgreSQL klammert `A IS NULL AND B IS NULL` beim Speichern zu
    // `((A) IS NULL) AND ((B) IS NULL)` um. Ein erster Entwurf suchte nach
    // "IS NULL AND" und blieb deshalb gruen, obwohl die alte Policy wieder
    // stand (gegengeprueft). Gesucht wird die Signatur "GUC-NULLIF mit NULL
    // verglichen" — sie ueberlebt jede Umklammerung.
    const CONTEXTLESS =
      /current_setting\('app\.current_(org|user)_id'::text, true\), ''::text\) IS NULL/;
    const offending = rows.filter((r) => CONTEXTLESS.test(r.expr));
    expect(offending.map((r) => r.policyname)).toEqual([]);
  });

  it("die drei Kapseln sind PUBLIC entzogen und nur grc_app erteilt (S01-13)", async () => {
    const rows = await admin.client<{ proname: string; acl: string }[]>`
      SELECT p.proname, coalesce(array_to_string(p.proacl, ','), '') AS acl
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('auth_lookup_user_by_email',
                           'auth_sso_touch_login',
                           'auth_sso_provision_user')`;
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.acl).not.toMatch(/(^|,)=X\//); // kein EXECUTE fuer PUBLIC
      expect(r.acl).toMatch(/grc_app=X\//);
    }
  });
});
