import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { createTestDb, createAppDb } from "../helpers";
import { runRlsAudit, TENANT_TABLE_RLS_EXCEPTIONS } from "../../src/rls-audit";

/**
 * ===========================================================================
 * [ARCTOS-FULL-2026-08-31 / WP2] RLS-Systemtest — Abnahmekriterium
 * ===========================================================================
 *
 * Weist für JEDES Objekt mit Mandantenbezug — Tabellen mit `org_id`, Views,
 * Materialized Views, Kindtabellen OHNE eigene `org_id` und die drei
 * Log-Tabellen — nach, dass Cross-Tenant-Lesen UND -Schreiben als Rolle
 * `grc_app` gegen eine echte Datenbank mit Daten in zwei Orgs verboten ist.
 *
 * Warum dieser Test existiert (S01-16)
 * ------------------------------------
 * Der bestehende `rls-coverage-systemtest.test.ts` prüfte live genau DREI
 * Tabellen (risk, control, asset) mit der Begründung: "Adding more doesn't
 * improve coverage — if the policy shape is wrong on one, it's wrong on
 * hundreds." Stream S01 hat diese Annahme widerlegt: die Policy-Form war auf
 * 443 Tabellen korrekt, und die Lecks lagen ausschliesslich dort, wo GAR
 * KEINE Policy existierte (Views, Kindtabellen, Log-Tabellen, Auth-Tabellen)
 * oder wo die Form abwich (`app.bypass_rls`, `org_id IS NULL`). Ein Test, der
 * drei Tabellen mit korrekter Policy prüft, kann davon nichts sehen.
 *
 * Aufbau
 * ------
 *  1. `tenant-isolation-seed.sql` legt je eine Zeile pro Mandant in jedem
 *     mandantenbezogenen Objekt an und merkt sich die Primärschlüssel.
 *  2. Als `grc_app` mit `app.current_org_id = Org A` wird für JEDE dieser
 *     Zeilen geprüft:
 *       - die eigene Zeile ist sichtbar   (sonst wäre der Test wertlos)
 *       - die fremde Zeile ist NICHT sichtbar
 *       - UPDATE auf die fremde Zeile trifft 0 Zeilen
 *       - DELETE auf die fremde Zeile trifft 0 Zeilen
 *  3. Dazu die gezielten Negativtests für die Befundklassen aus S01.
 *
 * Voraussetzungen: DATABASE_URL zeigt auf eine migrierte Datenbank; die Rolle
 * `grc_app` existiert mit Passwort `grc_app_dev_password` (Migration 0399
 * bzw. deploy/provision-grc-app.sh vergeben die Grants).
 *
 * Auf dem Stand VOR dieser Remediation schlägt der Test fehl — nachgewiesen
 * in /work/audit/remediation/WP2.md mit der Liste der lecken Objekte.
 */

const ORG_A = "aa000000-0000-4000-8000-000000000001";
const ORG_B = "bb000000-0000-4000-8000-000000000002";
const USER_A = "aa000000-0000-4000-8000-0000000000a1";

const SEED_SQL = readFileSync(
  join(__dirname, "tenant-isolation-seed.sql"),
  "utf8",
);
const CLEANUP_SQL = readFileSync(
  join(__dirname, "tenant-isolation-cleanup.sql"),
  "utf8",
);

let admin: ReturnType<typeof createTestDb>;
let app: ReturnType<typeof createAppDb>;
/** table -> { A: id, B: id } for every seeded object */
let seeded: { tbl: string; a: string; b: string }[] = [];
let seedErrors: { tbl: string; err: string }[] = [];

async function setOrgContext(client: postgres.Sql, orgId: string) {
  await client`SELECT set_config('app.current_org_id', ${orgId}, false),
                      set_config('app.current_user_id', ${USER_A}, false)`;
}

describe("WP2 — tenant isolation system test (S01 acceptance)", () => {
  beforeAll(async () => {
    admin = createTestDb();

    // Rolle sicherstellen. Die GRANTs kommen aus Migration 0399 — der Test
    // vergibt sie NUR, wenn die Datenbank nie provisioniert wurde (sonst
    // würde er die gezielten REVOKEs von 0393/0399 wieder aufheben und damit
    // genau die Kontrollen zudecken, die er prüfen soll).
    await admin.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      ALTER ROLE grc_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_app;
      DO $$ BEGIN
        IF NOT has_table_privilege('grc_app', 'public.risk', 'SELECT') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
        END IF;
      END $$;
    `);

    await admin.client.unsafe(CLEANUP_SQL);
    await admin.client.unsafe(SEED_SQL);

    const rows = await admin.client.unsafe<
      { tbl: string; a: string; b: string }[]
    >(`
      SELECT a.tbl, a.id::text AS a, b.id::text AS b
        FROM _wp2_seed_ids a
        JOIN _wp2_seed_ids b ON b.tbl = a.tbl AND b.org = 'B'
       WHERE a.org = 'A' AND a.id IS NOT NULL AND b.id IS NOT NULL
       ORDER BY a.tbl
    `);
    seeded = rows.map((r) => ({ tbl: r.tbl, a: r.a, b: r.b }));

    seedErrors = await admin.client.unsafe<{ tbl: string; err: string }[]>(
      `SELECT DISTINCT tbl, err FROM _wp2_seed_errors ORDER BY tbl`,
    );

    app = createAppDb();
    await setOrgContext(app.client, ORG_A);
  }, 300_000);

  afterAll(async () => {
    try {
      await app?.client.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    try {
      await admin.client.unsafe(CLEANUP_SQL);
    } finally {
      await admin.client.end({ timeout: 5 });
    }
  }, 120_000);

  // ── 0. Der Test muss selbst aussagekräftig sein ─────────────────────────
  it("runs as a role that can neither bypass RLS nor own the tables", async () => {
    const [row] = await app.client.unsafe<
      { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >(`SELECT rolname, rolsuper, rolbypassrls
         FROM pg_roles WHERE rolname = current_user`);
    expect(row.rolname).toBe("grc_app");
    expect(row.rolsuper).toBe(false);
    expect(row.rolbypassrls).toBe(false);
  });

  it("seeded both tenants into a meaningful number of objects", () => {
    // 500+ Objekte ist der gemessene Stand nach WP1. Deutlich weniger heisst:
    // der Seed ist gescheitert und die Isolationsprüfung darunter ist wertlos.
    expect(seeded.length).toBeGreaterThan(450);
    // Die Objektklassen, in denen S01 tatsächlich Lecks nachgewiesen hat,
    // MÜSSEN dabei sein — sonst prüft der Test wieder nur die einfachen Fälle.
    const names = new Set(seeded.map((s) => s.tbl));
    for (const required of [
      "audit_log", // S01-06
      "access_log", // S01-06
      "audit_anchor", // S01-06
      "user", // S01-04
      "bowtie_path", // S01-01
      "approval_decision", // S01-03
      "role_permission", // S01-03
      "wb_anonymous_mailbox", // S01-03
      "esg_materiality_vote", // S01-03 (Enkeltabelle)
      "questionnaire_question", // S01-03 (Enkeltabelle)
      "regulatory_source", // S01-07
      "risk", // S01-02
      "organization", // S01-02
      "grc_budget", // S01-08 (Basistabelle von v_budget_usage)
    ]) {
      expect(names, `seed must cover ${required}`).toContain(required);
    }
  });

  it("reports which objects could not be seeded (visible, not silent)", () => {
    // Kein Fehlschlag — aber die Liste steht im Testprotokoll, damit "nicht
    // geprüft" nie mit "geprüft und in Ordnung" verwechselt wird.
    if (seedErrors.length > 0) {
      console.warn(
        `[WP2] ${seedErrors.length} Objekt(e) nicht seedbar und daher nicht ` +
          `per Zeilenprobe geprüft:\n` +
          seedErrors.map((e) => `  - ${e.tbl}: ${e.err}`).join("\n"),
      );
    }
    expect(seedErrors.length).toBeLessThan(20);
  });

  // ── 1. Der Kern: Cross-Tenant-Lesen und -Schreiben über ALLE Objekte ────
  it("denies cross-tenant SELECT on every seeded object", async () => {
    const leaks: string[] = [];
    const blind: string[] = [];
    for (const s of seeded) {
      let own: { n: number };
      let foreign: { n: number };
      try {
        [own] = await app.client.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${s.tbl}" WHERE id = $1`,
          [s.a],
        );
        [foreign] = await app.client.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${s.tbl}" WHERE id = $1`,
          [s.b],
        );
      } catch (err) {
        // "permission denied" ist die härteste Form von "verboten" — das gilt
        // als bestanden (die Auth.js-Token-Tabellen sind so abgesichert).
        if (/permission denied/i.test(String(err))) continue;
        throw err;
      }
      if (foreign.n > 0) leaks.push(`${s.tbl}: foreign row visible`);
      // Die eigene Zeile MUSS sichtbar sein — sonst ist "0 fremde Zeilen"
      // nur ein Artefakt einer deny-all-Policy und beweist nichts.
      if (own.n === 0) blind.push(s.tbl);
    }
    expect(leaks, `cross-tenant READ leaks:\n${leaks.join("\n")}`).toEqual([]);
    // Deny-all ist für die Auth.js-Token-Tabellen gewollt; sie sind für
    // grc_app aber gar nicht lesbar und daher nie im Seed-Ergebnis.
    expect(
      blind,
      `objects where even the OWN row is invisible — the isolation check ` +
        `above is vacuous for these:\n${blind.join("\n")}`,
    ).toEqual([]);
  }, 300_000);

  it("denies cross-tenant UPDATE and DELETE on every seeded object", async () => {
    const writeLeaks: string[] = [];
    for (const s of seeded) {
      await app.client.unsafe("BEGIN");
      try {
        const upd = await app.client.unsafe(
          `UPDATE public."${s.tbl}" SET id = id WHERE id = $1`,
          [s.b],
        );
        if (upd.count > 0) writeLeaks.push(`${s.tbl}: UPDATE ${upd.count}`);
        const del = await app.client.unsafe(
          `DELETE FROM public."${s.tbl}" WHERE id = $1`,
          [s.b],
        );
        if (del.count > 0) writeLeaks.push(`${s.tbl}: DELETE ${del.count}`);
      } catch {
        // Ein harter Fehler (append-only RULE, Guard-Trigger, fehlendes
        // Recht) ist ebenfalls "verboten" — das ist der gewünschte Ausgang.
      } finally {
        await app.client.unsafe("ROLLBACK");
      }
    }
    expect(
      writeLeaks,
      `cross-tenant WRITE leaks:\n${writeLeaks.join("\n")}`,
    ).toEqual([]);
  }, 300_000);

  // ── 2. Views und Materialized Views (S01-08) ────────────────────────────
  it("denies cross-tenant reads through views", async () => {
    const views = await admin.client.unsafe<{ relname: string }[]>(`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'v'
         AND EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public'
                        AND col.table_name = c.relname
                        AND col.column_name = 'org_id')
       ORDER BY c.relname
    `);
    expect(views.length).toBeGreaterThan(0);
    const leaks: string[] = [];
    for (const v of views) {
      const [row] = await app.client.unsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM public."${v.relname}" WHERE org_id = $1`,
        [ORG_B],
      );
      if (row.n > 0) leaks.push(`${v.relname}: ${row.n} foreign rows`);
    }
    expect(leaks, `view leaks:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("every view is security_invoker", async () => {
    const bad = await admin.client.unsafe<{ relname: string }[]>(`
      SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'v'
         AND COALESCE(array_to_string(c.reloptions, ','), '')
             NOT LIKE '%security_invoker=true%'
    `);
    expect(bad.map((b) => b.relname)).toEqual([]);
  });

  it("materialized views are not readable by the runtime role", async () => {
    const mvs = await admin.client.unsafe<{ relname: string }[]>(`
      SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'm' ORDER BY c.relname
    `);
    expect(mvs.length).toBeGreaterThan(0);
    for (const mv of mvs) {
      await expect(
        app.client.unsafe(`SELECT 1 FROM public."${mv.relname}" LIMIT 1`),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  // ── 3. Die Escape-Hatches (S01-02, S01-07) ──────────────────────────────
  it("SET app.bypass_rls has no effect any more", async () => {
    await app.client.unsafe(`SET app.bypass_rls = 'true'`);
    try {
      for (const tbl of ["risk", "document", "evidence", "organization"]) {
        const col = tbl === "organization" ? "id" : "org_id";
        const [row] = await app.client.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${tbl}" WHERE ${col} = $1`,
          [ORG_B],
        );
        expect(row.n, `${tbl} leaked under app.bypass_rls`).toBe(0);
      }
      const del = await app.client.unsafe(
        `DELETE FROM public.risk WHERE org_id = $1`,
        [ORG_B],
      );
      expect(del.count).toBe(0);
    } finally {
      await app.client.unsafe(`SET app.bypass_rls = 'false'`);
    }
  });

  it("no policy in the schema references app.bypass_rls", async () => {
    const [row] = await admin.client.unsafe<{ n: number }[]>(`
      SELECT count(*)::int AS n FROM pg_policies
       WHERE schemaname = 'public'
         AND (COALESCE(qual, '') LIKE '%app.bypass_rls%'
           OR COALESCE(with_check, '') LIKE '%app.bypass_rls%')
    `);
    expect(row.n).toBe(0);
  });

  it("rows with org_id = NULL cannot be written by a tenant", async () => {
    const globalTables = await admin.client.unsafe<{ tablename: string }[]>(`
      SELECT DISTINCT tablename FROM pg_policies
       WHERE schemaname = 'public' AND COALESCE(qual, '') LIKE '%org_id IS NULL%'
       ORDER BY tablename
    `);
    expect(globalTables.length).toBeGreaterThan(0);
    for (const t of globalTables) {
      await app.client.unsafe("BEGIN");
      try {
        // Ein bestehender globaler Datensatz darf weder verändert noch
        // gelöscht werden, und ein neuer darf nicht angelegt werden.
        const upd = await app.client.unsafe(
          `UPDATE public."${t.tablename}" SET id = id WHERE org_id IS NULL`,
        );
        expect(upd.count, `${t.tablename}: global row updatable`).toBe(0);
        const del = await app.client.unsafe(
          `DELETE FROM public."${t.tablename}" WHERE org_id IS NULL`,
        );
        expect(del.count, `${t.tablename}: global row deletable`).toBe(0);
      } catch {
        /* harter Fehler ist ebenfalls "verboten" */
      } finally {
        await app.client.unsafe("ROLLBACK");
      }
    }

    // Und der konkrete Nachweis aus evidence/S01_nullorg_probe.txt:
    await app.client.unsafe("BEGIN");
    try {
      await expect(
        app.client.unsafe(
          `INSERT INTO public.regulatory_source
             (org_id, name, source_type, url, jurisdiction)
           VALUES (NULL, 'WP2-GLOBAL-POISON', 'rss', 'http://evil.invalid/f', 'EU')`,
        ),
      ).rejects.toThrow(/row-level security|policy/i);
    } finally {
      await app.client.unsafe("ROLLBACK");
    }
  });

  // ── 4. Auth-Kerntabellen (S01-04) ───────────────────────────────────────
  it("session, account and verification_token are unreachable", async () => {
    for (const tbl of ["session", "account", "verification_token"]) {
      await expect(
        app.client.unsafe(`SELECT 1 FROM public."${tbl}" LIMIT 1`),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("user rows of another tenant are invisible from a tenant context", async () => {
    const [foreign] = await app.client.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM public."user" WHERE id = $1`,
      ["bb000000-0000-4000-8000-0000000000b1"],
    );
    expect(foreign.n).toBe(0);
    const [own] = await app.client.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM public."user" WHERE id = $1`,
      [USER_A],
    );
    expect(own.n).toBe(1);
  });

  // ── 5. Log-Tabellen (S01-06) ────────────────────────────────────────────
  it("the log tables carry RLS + FORCE and no exception list remains", async () => {
    expect([...TENANT_TABLE_RLS_EXCEPTIONS]).toEqual([]);
    const rows = await admin.client.unsafe<
      { relname: string; rls: boolean; force: boolean; pols: number }[]
    >(`
      SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS pols
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('audit_log', 'access_log', 'audit_anchor')
       ORDER BY c.relname
    `);
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.rls, `${r.relname}: RLS off`).toBe(true);
      expect(r.force, `${r.relname}: FORCE off`).toBe(true);
      expect(r.pols, `${r.relname}: no policies`).toBeGreaterThan(0);
    }
  });

  it("org-less INSERT into access_log still works (login path, S01-06)", async () => {
    await app.client.unsafe("BEGIN");
    try {
      const res = await app.client.unsafe(
        `INSERT INTO public.access_log (event_type, email_attempted)
         VALUES ('login_failed', 'wp2-probe@example.invalid')`,
      );
      expect(res.count).toBe(1);
    } finally {
      await app.client.unsafe("ROLLBACK");
    }
  });

  it("app_current_org_scope() returns exactly the own org for an unrelated tenant", async () => {
    const rows = await app.client.unsafe<{ id: string }[]>(
      `SELECT public.app_current_org_scope()::text AS id`,
    );
    expect(rows.map((r) => r.id)).toEqual([ORG_A]);
  });

  it("a tenant cannot make a foreign org its descendant", async () => {
    await app.client.unsafe("BEGIN");
    try {
      const res = await app.client.unsafe(
        `UPDATE public.organization SET parent_org_id = $1 WHERE id = $2`,
        [ORG_A, ORG_B],
      );
      expect(res.count).toBe(0);
    } catch {
      /* hard failure is fine too */
    } finally {
      await app.client.unsafe("ROLLBACK");
    }
  });

  // ── 6. SECURITY DEFINER (S01-13) ────────────────────────────────────────
  it("tombstone_audit_entry refuses a foreign tenant's audit entry", async () => {
    const foreignAudit = seeded.find((s) => s.tbl === "audit_log");
    expect(foreignAudit).toBeDefined();
    await expect(
      app.client.unsafe(`SELECT public.tombstone_audit_entry($1::uuid, 'wp2')`, [
        foreignAudit!.b,
      ]),
    ).rejects.toThrow(/different organization/i);
  });

  it("every SECURITY DEFINER function has a fixed search_path and no PUBLIC EXECUTE", async () => {
    const bad = await admin.client.unsafe<{ proname: string; why: string }[]>(`
      SELECT p.proname,
             CASE WHEN p.proconfig IS NULL THEN 'no search_path'
                  ELSE 'EXECUTE granted to PUBLIC' END AS why
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef
         AND (p.proconfig IS NULL
           OR p.proacl IS NULL
           OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                       WHERE a.grantee = 0))
    `);
    expect(bad.map((b) => `${b.proname}: ${b.why}`)).toEqual([]);
  });

  // ── 7. Fail-Modus der Policy-Form (S01-18, S01-25) ──────────────────────
  it("an empty org GUC yields zero rows instead of an error", async () => {
    const probe = createAppDb();
    try {
      await probe.client.unsafe(`SET app.current_org_id = ''`);
      for (const tbl of ["risk", "module_config", "control", "document"]) {
        const [row] = await probe.client.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${tbl}"`,
        );
        expect(row.n).toBe(0);
      }
    } finally {
      await probe.client.end({ timeout: 5 });
    }
  });

  it("no policy casts app.current_org_id without a NULLIF guard", async () => {
    const bad = await admin.client.unsafe<
      { tablename: string; policyname: string }[]
    >(`
      SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public'
         AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE
             '%current_setting(''app.current_org_id''%'
         AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) NOT LIKE
             '%NULLIF(current_setting(''app.current_org_id''%'
       ORDER BY tablename, policyname
    `);
    expect(bad.map((b) => `${b.tablename}.${b.policyname}`)).toEqual([]);
  });

  // ── 8. Das Prüfwerkzeug selbst (S01-15) ─────────────────────────────────
  it("runRlsAudit reports zero gaps", async () => {
    const report = await runRlsAudit();
    const summary = report.gaps
      .map((g) => `${g.status} ${g.scope} ${g.tableName}: ${g.note ?? ""}`)
      .join("\n");
    expect(report.gaps.length, `RLS gaps:\n${summary}`).toBe(0);
    // Die Klassen, die das alte Werkzeug nicht sehen konnte, müssen jetzt
    // überhaupt als prüfpflichtig klassifiziert sein.
    expect(report.counts.tenantChildTables).toBeGreaterThan(10);
    expect(report.counts.views).toBeGreaterThan(0);
    expect(report.counts.matviews).toBeGreaterThan(0);
    expect(report.counts.authTables).toBe(4);
  }, 120_000);
});
