import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { requireRow, requireAt } from "../helpers";

/**
 * ARCTOS-FULL-2026-08-31 · WP8 · S07-01, S07-02, S07-03, S07-04, S07-05,
 * S07-06, S07-07, S07-08, S07-09, S07-12, S07-13, S07-24, S07-25, S07-28.
 *
 * Jeder Test hier fährt einen Angriff oder eine Prüfung, die der
 * Auditbericht reproduziert hat, und fällt gegen den Stand VOR dieser
 * Remediation um. Die Bezugsstellen stehen jeweils am Test.
 *
 * Voraussetzung: eine echte Datenbank mit den Migrationen bis 0434.
 *   DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/<db> \
 *     npx vitest run --config vitest.integration.config.ts \
 *     tests/integration/gdpr-privacy.test.ts
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

let sql: postgres.Sql;
let orgId: string;
/** Eigener Mandant je Lauf — `audit_log` hat einen FK auf `organization`
 *  und ist append-only, die Organisation kann danach also nicht mehr
 *  gelöscht werden. Ein zufälliger Code hält parallele und wiederholte
 *  Läufe auseinander. */
const ORG_CODE = `W8${Math.floor(Math.random() * 90000 + 10000)}`;
const SUFFIX = ORG_CODE.toLowerCase();

const SUBJECT_EMAIL = () => `erika.${SUFFIX}@wp8-test.example`;
const SUBJECT_NAME = "Erika Musterfrau WP8";
const LEGACY_PW = "$2b$12$WP8TESTHASHABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

beforeAll(async () => {
  sql = postgres(DATABASE_URL, {
    max: 1,
    onnotice: () => {},
    connection: { TimeZone: "UTC" },
  });

  const org = requireRow(
    await sql<{ id: string }[]>`
    INSERT INTO organization (name, org_code)
    VALUES ('WP8 Integration AG', ${ORG_CODE})
    RETURNING id
  `,
    "org",
  );
  orgId = org.id;

  await sql`SELECT set_config('app.current_org_id', ${orgId}, false)`;
  await sql`SELECT set_config('app.current_user_email', 'dpo@wp8-test.example', false)`;
  await sql`SELECT set_config('app.current_user_name', 'Dora Datenschutz', false)`;
});

afterAll(async () => {
  if (!sql) return;
  try {
    await sql`SELECT set_config('app.current_org_id', ${orgId}, false)`;
    await sql.unsafe(
      `ALTER TABLE whistleblowing_audit_log DISABLE TRIGGER wb_audit_log_append_only_trg`,
    );
    await sql`DELETE FROM whistleblowing_audit_log WHERE org_id = ${orgId}::uuid`;
    await sql.unsafe(
      `ALTER TABLE whistleblowing_audit_log ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg`,
    );
    await sql`DELETE FROM wb_case_message      WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM wb_case_evidence     WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM wb_investigation_log WHERE investigation_id IN (
                SELECT id FROM wb_investigation WHERE org_id = ${orgId}::uuid)`;
    await sql`DELETE FROM wb_investigation     WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM wb_protection_case   WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM wb_case              WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM wb_anonymous_mailbox WHERE report_id IN (
                SELECT id FROM wb_report WHERE org_id = ${orgId}::uuid)`;
    await sql`DELETE FROM wb_report            WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM gdpr_erasure_log     WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM retention_run_log    WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM dsr                  WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM stakeholder          WHERE org_id = ${orgId}::uuid`;
    await sql.unsafe(
      `ALTER TABLE access_log DISABLE RULE access_log_no_delete`,
    );
    await sql`DELETE FROM access_log WHERE org_id = ${orgId}::uuid`;
    await sql.unsafe(`ALTER TABLE access_log ENABLE RULE access_log_no_delete`);
    await sql`DELETE FROM search_index WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM copilot_rag_source WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM risk WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM export_approval WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM user_organization_role WHERE org_id = ${orgId}::uuid`;
    await sql`DELETE FROM "user" WHERE email LIKE ${"%." + SUFFIX + "@wp8-test.example"}`;
    // Die Organisation selbst bleibt stehen: `audit_log` hat einen
    // Fremdschlüssel darauf und ist append-only (genau die Eigenschaft,
    // die dieses Paket absichert). Jeder Lauf legt deshalb einen eigenen
    // Mandanten mit zufälligem org_code an.
  } catch {
    // Aufräumen ist best effort; ein Rest stört den nächsten Lauf nicht,
    // weil jeder Lauf seine eigene Organisation anlegt.
  }
  await sql.end();
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-01 — HinSchG-Vertraulichkeit im org-weiten audit_log", () => {
  let reportId: string;
  let caseId: string;
  const MAILBOX_TOKEN = `MAILBOXTOKEN_SECRET_${SUFFIX}_abcdefghij0123456789`;

  beforeAll(async () => {
    const r = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO wb_report (org_id, report_token, token_expires_at, category,
                             description, contact_email, ip_hash)
      VALUES (${orgId}, ${"REPORTTOKEN_" + SUFFIX + "_0123456789abcdefghij"},
              now() + interval '180 days', 'health_safety',
              'ENCRYPTED==', 'ENCRYPTED==',
              encode(digest('10.20.30.44','sha256'),'hex'))
      RETURNING id`,
      "r",
    );
    reportId = r.id;

    await sql`
      INSERT INTO wb_anonymous_mailbox (report_id, token, expires_at)
      VALUES (${reportId}, ${MAILBOX_TOKEN}, now() + interval '180 days')`;

    const c = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO wb_case (org_id, report_id, case_number,
                           acknowledge_deadline, response_deadline)
      VALUES (${orgId}, ${reportId}, ${"WB-" + SUFFIX + "-0001"},
              now() + interval '7 days', now() + interval '90 days')
      RETURNING id`,
      "c",
    );
    caseId = c.id;

    await sql`
      INSERT INTO wb_protection_case (org_id, case_id, reporter_reference,
                                      protection_start_date)
      VALUES (${orgId}, ${caseId}, ${SUBJECT_NAME}, now())`;

    const inv = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO wb_investigation (org_id, case_id, phase)
      VALUES (${orgId}, ${caseId}, 'triage') RETURNING id`,
      "inv",
    );

    await sql`
      INSERT INTO wb_investigation_log (investigation_id, activity_type, description)
      VALUES (${inv.id}, 'note', 'Beschuldigter WP8-Testfall, Vorwurf Untreue')`;
  });

  it("no whistleblowing entity writes into the org-wide audit_log at all", async () => {
    // Der Befund: der generische `audit_trigger()` lag ZUSÄTZLICH zum
    // dedizierten Trigger auf allen 13 wb-Tabellen und schrieb die
    // komplette Zeile nach `audit_log.changes` — lesbar für admin,
    // auditor und dpo, also genau die Rollen, die
    // `whistleblowing/cases/route.ts` unter Verweis auf HinSchG §8
    // ausschliesst.
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log
       WHERE org_id = ${orgId}::uuid AND entity_type LIKE 'wb\\_%'`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("the generic audit_trigger is gone from every wb_* table", async () => {
    const rows = await sql<{ relname: string }[]>`
      SELECT c.relname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_proc  p ON p.oid = t.tgfoid
       WHERE NOT t.tgisinternal
         AND c.relname LIKE 'wb\\_%'
         AND p.proname = 'audit_trigger'`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("the mailbox token appears in no audit_log row", async () => {
    // Der Kern des Critical: mit diesem Token ist
    // GET /api/v1/portal/mailbox/<token> (unauthentifiziert) und damit
    // der gesamte Meldekanal übernehmbar.
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log a
       WHERE a::text LIKE ${"%" + MAILBOX_TOKEN + "%"}`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("neither the Art. 9 category nor the reporter reference leaks", async () => {
    const row = requireRow(
      await sql<{ cat: number; who: number }[]>`
      SELECT count(*) FILTER (WHERE a::text LIKE '%health_safety%')::int AS cat,
             count(*) FILTER (WHERE a::text LIKE ${"%" + SUBJECT_NAME + "%"})::int AS who
        FROM audit_log a WHERE a.org_id = ${orgId}::uuid`,
      "row",
    );
    expect(row.cat).toBe(0);
    expect(row.who).toBe(0);
  });

  it("the confidential log did record the events", async () => {
    // Gegenprobe: die Vertraulichkeit darf nicht dadurch entstehen, dass
    // gar nichts mehr protokolliert wird.
    const rows = await sql<{ entity_type: string }[]>`
      SELECT DISTINCT entity_type FROM whistleblowing_audit_log
       WHERE org_id = ${orgId}::uuid ORDER BY entity_type`;
    const types = rows.map((r) => r.entity_type);
    expect(types).toContain("wb_report");
    expect(types).toContain("wb_anonymous_mailbox");
    expect(types).toContain("wb_protection_case");
    expect(types).toContain("wb_investigation_log");
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-08 — actor_hash lässt sich nicht über die Fallmenge zurückrechnen", () => {
  it("is not sha256(user_id || '|' || case_id)", async () => {
    // Reproduktion des Berichts: die Kandidatenmenge sind die UUIDs aus
    // `user` (10^2..10^4 je Mandant), der Salt `case_id` steht in
    // derselben Zeile. Der Angriff braucht genau |user| × |Zeilen| Hashes.
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM whistleblowing_audit_log l
        LEFT JOIN "user" u ON true
       WHERE l.org_id = ${orgId}::uuid
         AND l.actor_hash = encode(
               digest(COALESCE(u.id::text,'system') || '|' || l.case_id::text, 'sha256'),
               'hex')`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("is not sha256('system' || '|' || case_id) either", async () => {
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM whistleblowing_audit_log l
       WHERE l.org_id = ${orgId}::uuid
         AND l.actor_hash = encode(digest('system|' || l.case_id::text, 'sha256'), 'hex')`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("records which key produced the pseudonym", async () => {
    const rows = await sql<{ actor_key_id: string | null }[]>`
      SELECT DISTINCT actor_key_id FROM whistleblowing_audit_log
       WHERE org_id = ${orgId}::uuid`;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.actor_key_id).toBeTruthy();
      expect(r.actor_key_id).not.toBe("destroyed");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-09 — Mandantengrenze und Rollenschnitt im vertraulichen Log", () => {
  it("whistleblowing_audit_log carries an org_id on every new row", async () => {
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM whistleblowing_audit_log
       WHERE org_id IS NULL
         AND created_at > now() - interval '1 hour'`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("the read policy no longer lists admin (ADR-011 rev.2 §82-83)", async () => {
    const row = requireRow(
      await sql<{ qual: string }[]>`
      SELECT pg_get_expr(polqual, polrelid) AS qual
        FROM pg_policy
       WHERE polrelid = 'whistleblowing_audit_log'::regclass
         AND polname = 'wb_audit_log_officer_read'`,
      "row",
    );
    expect(row.qual).toContain("whistleblowing_officer");
    expect(row.qual).toContain("ombudsperson");
    expect(row.qual).not.toContain("'admin'");
    expect(row.qual).toContain("app.current_org_id");
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-06 — redact_pii_jsonb erfasst Verschachtelung, Arrays und alle Typen", () => {
  it("redacts a nested email that the old top-level-only version never reached", async () => {
    const row = requireRow(
      await sql<{ out: Record<string, unknown> }[]>`
      SELECT redact_pii_jsonb(
        '{"notification_preferences":{"alt_email":"privat@gmx.de"},
          "contacts":[{"contact_email":"a@b.de"}],
          "password_hash":"$2b$12$x",
          "description":"Freitext mit Namen"}'::jsonb,
        'salt', 'user') AS out`,
      "row",
    );
    const out = row.out as {
      notification_preferences: { alt_email: string };
      contacts: { contact_email: string }[];
      password_hash: string;
      description: string;
    };
    expect(out.notification_preferences.alt_email).toMatch(/^__tombstoned__:/);
    expect(requireAt(out.contacts, 0, "contacts").contact_email).toMatch(
      /^__tombstoned__:/,
    );
    expect(out.password_hash).toBe("__redacted__");
    expect(out.description).toBe("__redacted__");
  });

  it("covers a key that nobody registered, via the name heuristic", async () => {
    const row = requireRow(
      await sql<{ out: Record<string, string> }[]>`
      SELECT redact_pii_jsonb('{"escalation_contact_email":"x@y.z"}'::jsonb, 's') AS out`,
      "row",
    );
    expect(row.out.escalation_contact_email).toMatch(/^__tombstoned__:/);
  });

  it("registers the whole PII inventory, not 26 keys", async () => {
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pii_redaction_rule`,
      "n",
    );
    // Das Inventar weist 96 direkt identifizierende und 418 Freitext-
    // Spalten aus; nach Zusammenfassung gleichnamiger Spalten bleiben
    // über 160 Schlüsselnamen. 26 waren es vorher.
    expect(n).toBeGreaterThan(150);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-03/-04/-05 — Tombstone: Schlüssel, entity_title, Authentifikatoren", () => {
  let auditId: string;

  beforeAll(async () => {
    await sql`
      INSERT INTO "user" (email, name, password_hash, avatar_url, notification_preferences)
      VALUES (${SUBJECT_EMAIL()}, ${SUBJECT_NAME}, ${LEGACY_PW},
              'https://cdn/wp8/erika.png',
              jsonb_build_object('alt_email', ${`privat.${SUFFIX}@wp8-test.example`}::text))`;
    const row = requireRow(
      await sql<{ id: string }[]>`
      SELECT id FROM audit_log
       WHERE entity_type = 'user' AND entity_title = ${SUBJECT_NAME}
       ORDER BY chain_seq DESC LIMIT 1`,
      "row",
    );
    auditId = row.id;
  });

  it("scrubs credentials on write (WP4 S03-14, measured here)", async () => {
    const row = requireRow(
      await sql<{ pw: string | null }[]>`
      SELECT changes->'new'->>'password_hash' AS pw
        FROM audit_log WHERE id = ${auditId}`,
      "row",
    );
    expect(row.pw).toBe("__redacted__");
  });

  it("redacts entity_title, which was previously unreachable by design", async () => {
    // Der Befund: `entity_title` trug den Klarnamen, war von der
    // Redaktion ausgenommen UND per Guard dauerhaft unveränderbar. Der
    // Reproduktionslauf des Auditors endete mit
    //   ERROR: audit_log is append-only — column entity_title cannot be updated
    await sql`SELECT tombstone_audit_entry(${auditId}::uuid, 'gdpr_art_17')`;
    const row = requireRow(
      await sql<
        {
          entity_title: string;
          user_agent: string | null;
          session_id: string | null;
          avatar: string | null;
          nested: string | null;
        }[]
      >`
      SELECT entity_title, user_agent, session_id,
             changes->'new'->>'avatar_url' AS avatar,
             changes->'new'->'notification_preferences'->>'alt_email' AS nested
        FROM audit_log WHERE id = ${auditId}`,
      "row",
    );
    expect(row.entity_title).toMatch(/^__tombstoned__:/);
    expect(row.entity_title).not.toContain(SUBJECT_NAME);
    expect(row.user_agent).toBeNull();
    expect(row.session_id).toBeNull();
    expect(row.avatar).toMatch(/^__tombstoned__:/);
    expect(row.nested).toMatch(/^__tombstoned__:/);
  });

  it("the tombstone hash is not sha256(value || '|' || entry_hash)", async () => {
    // Genau die Rückrechnung aus evidence/S07-repro-tombstone-reversal:
    // Kandidatenliste (der Inhalt von `user`) gegen den Hash, mit dem
    // `entry_hash` aus derselben Zeile als Salt.
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM audit_log a
       WHERE a.id = ${auditId}
         AND a.entity_title = '__tombstoned__:' ||
             encode(digest(${SUBJECT_NAME} || '|' || a.entry_hash, 'sha256'), 'hex')`,
      "n",
    );
    expect(n).toBe(0);
  });

  it("a plain UPDATE is still refused (WP4's guard invariant holds)", async () => {
    await expect(
      sql`UPDATE audit_log SET user_email = 'x@y.z' WHERE id = ${auditId}`,
    ).rejects.toThrow(/append-only|tombstone/i);
  });

  it("hash_version and content_commitment stay out of the allowlist (S03-02)", async () => {
    await expect(
      sql`UPDATE audit_log
             SET hash_version = 1,
                 pii_tombstoned_at = now() + interval '1 second'
           WHERE id = ${auditId}`,
    ).rejects.toThrow(/append-only/i);
  });

  it("a second erasure on the same row is possible (two data subjects)", async () => {
    // Vorher: `RAISE EXCEPTION 'already tombstoned'` — ein Audit-Eintrag,
    // der zwei Personen betrifft, konnte für die zweite nie redigiert
    // werden.
    await expect(
      sql`SELECT tombstone_audit_entry(${auditId}::uuid, 'gdpr_art_17')`,
    ).resolves.toBeDefined();
  });

  it("the chain still verifies after all of that", async () => {
    const row = requireRow(
      await sql<{ report: { healthy: boolean } }[]>`
      SELECT audit_chain_verify('org:' || ${orgId}) AS report`,
      "row",
    );
    expect(row.report.healthy).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-13 + S07-28 — Art. 17 über alle Schemas, Kette bleibt heil", () => {
  let userId: string;

  beforeAll(async () => {
    const u = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`erase.me.${SUFFIX}@wp8-test.example`}, 'Erase Me WP8', ${LEGACY_PW})
      RETURNING id`,
      "u",
    );
    userId = u.id;
    await sql`
      INSERT INTO user_organization_role (user_id, org_id, role)
      VALUES (${userId}, ${orgId}, 'viewer')`;
    await sql`
      INSERT INTO dsr (org_id, request_type, deadline, subject_name, subject_email)
      VALUES (${orgId}, 'erasure', now() + interval '30 days',
              'Erase Me WP8', ${`erase.me.${SUFFIX}@wp8-test.example`})`;
    await sql`
      INSERT INTO access_log (org_id, user_id, event_type, ip_address, user_agent)
      VALUES (${orgId}, ${userId}, 'login_success', '203.0.113.5', 'Mozilla/5.0')`;
  });

  it("collects the subject's data across schemas (Art. 15)", async () => {
    const row = requireRow(
      await sql<{ report: { totalRows: number; sources: unknown[] } }[]>`
      SELECT dsr_collect_subject_data(
        ${orgId}::uuid, ${userId}::uuid,
        ${`erase.me.${SUFFIX}@wp8-test.example`}, 'Erase Me WP8') AS report`,
      "row",
    );
    expect(row.report.totalRows).toBeGreaterThan(0);
    expect(row.report.sources.length).toBeGreaterThan(1);
  });

  it("excludes the whistleblowing tables from the access request", async () => {
    // Art. 15 Abs. 4 DSGVO / HinSchG §8: die Auskunft darf nicht das
    // Werkzeug sein, mit dem eine beschuldigte Person die hinweisgebende
    // Person identifiziert.
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM dsr_subject_index
       WHERE table_name LIKE 'wb\\_%' AND is_active`;
    expect(rows).toEqual([]);
  });

  it("erases the subject across all schemas and keeps the chain healthy", async () => {
    const row = requireRow(
      await sql<
        {
          report: { businessRows: number; auditRows: number };
        }[]
      >`
      SELECT gdpr_erase_subject(
        ${orgId}::uuid, ${userId}::uuid,
        ${`erase.me.${SUFFIX}@wp8-test.example`}, 'Erase Me WP8', 'gdpr_art_17') AS report`,
      "row",
    );
    expect(row.report.businessRows).toBeGreaterThan(0);
    expect(row.report.auditRows).toBeGreaterThan(0);

    const left = requireRow(
      await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM "user" WHERE email = ${`erase.me.${SUFFIX}@wp8-test.example`})
      + (SELECT count(*) FROM dsr WHERE org_id = ${orgId}::uuid
                                   AND subject_email = ${`erase.me.${SUFFIX}@wp8-test.example`})
      + (SELECT count(*) FROM audit_log WHERE org_id = ${orgId}::uuid
                                   AND audit_log::text ILIKE ${`%erase.me.${SUFFIX}@wp8-test.example%`})
      )::int AS n`,
      "left",
    );
    expect(left.n).toBe(0);

    const chain = requireRow(
      await sql<{ report: { healthy: boolean } }[]>`
      SELECT audit_chain_verify('org:' || ${orgId}) AS report`,
      "chain",
    );
    expect(chain.report.healthy).toBe(true);
  });

  it("destroys the subject's credentials rather than keeping a usable hash", async () => {
    const row = requireRow(
      await sql<{ same: boolean; active: boolean }[]>`
      SELECT (password_hash = ${LEGACY_PW}) AS same, is_active AS active
        FROM "user" WHERE id = ${userId}`,
      "row",
    );
    expect(row.same).toBe(false);
    expect(row.active).toBe(false);
  });

  it("leaves an accountability record that is not itself a PII copy", async () => {
    const row = requireRow(
      await sql<{ hashed: boolean; plain: number }[]>`
      SELECT (subject_email_hash IS NOT NULL) AS hashed,
             (CASE WHEN g::text ILIKE ${`%erase.me.${SUFFIX}@wp8-test.example%`} THEN 1 ELSE 0 END) AS plain
        FROM gdpr_erasure_log g
       WHERE org_id = ${orgId}::uuid
       ORDER BY executed_at DESC LIMIT 1`,
      "row",
    );
    expect(row.hashed).toBe(true);
    expect(row.plain).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-07 / S07-24 — Retention löscht tatsächlich, und zwar fristbezogen", () => {
  let bindingId: string;

  beforeAll(async () => {
    const b = requireRow(
      await sql<{ id: string }[]>`
      SELECT id::text AS id FROM retention_binding
       WHERE table_name = 'access_log' AND org_id IS NULL`,
      "b",
    );
    bindingId = b.id;

    await sql`
      INSERT INTO access_log (org_id, event_type, ip_address, email_attempted, created_at)
      VALUES (${orgId}, 'login_failed', '203.0.113.9', ${`alt.${SUFFIX}@wp8-test.example`},
              now() - interval '200 days'),
             (${orgId}, 'login_failed', '203.0.113.9', ${`neu.${SUFFIX}@wp8-test.example`},
              now() - interval '2 days')`;
  });

  it("a plain DELETE on access_log is still a no-op (append-only holds)", async () => {
    await sql`DELETE FROM access_log WHERE org_id = ${orgId}::uuid`;
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM access_log WHERE org_id = ${orgId}::uuid`,
      "n",
    );
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it("the retention run deletes only what is past its deadline", async () => {
    // Der Befund: der einzige Retention-Job erzeugte Tickets und rechnete
    // die Frist gegen das Anlagedatum der REGEL statt gegen das Alter der
    // DATEN.
    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT retention_purge_table(${bindingId}::bigint, ${orgId}::uuid, NULL, false) AS n`,
      "n",
    );
    expect(Number(n)).toBe(1);

    const row = requireRow(
      await sql<{ overdue: number; oldest: number }[]>`
      SELECT count(*) FILTER (WHERE created_at < now() - interval '90 days')::int AS overdue,
             max(EXTRACT(day FROM now() - created_at))::int AS oldest
        FROM access_log WHERE org_id = ${orgId}::uuid`,
      "row",
    );
    // Fristbezogen: nichts jenseits der Frist bleibt übrig, alles
    // innerhalb der Frist bleibt stehen.
    expect(row.overdue).toBe(0);
    expect(row.oldest).toBeLessThan(90);
  });

  it("re-arms the append-only rule afterwards", async () => {
    const before = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM access_log WHERE org_id = ${orgId}::uuid`,
      "before",
    );
    await sql`DELETE FROM access_log WHERE org_id = ${orgId}::uuid`;
    const after = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM access_log WHERE org_id = ${orgId}::uuid`,
      "after",
    );
    expect(after.n).toBe(before.n);
    expect(after.n).toBeGreaterThan(0);
  });

  it("evidences the run in retention_run_log", async () => {
    const row = requireRow(
      await sql<{ rows_affected: number; retention_days: number }[]>`
      SELECT rows_affected, retention_days FROM retention_run_log
       WHERE org_id = ${orgId}::uuid AND table_name = 'access_log' AND NOT dry_run
       ORDER BY ran_at DESC LIMIT 1`,
      "row",
    );
    expect(row.rows_affected).toBe(1);
    expect(row.retention_days).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-12 — HinSchG §11 Abs. 5: drei Jahre nach Verfahrensabschluss", () => {
  it("purges a case that was closed more than three years ago", async () => {
    const r = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO wb_report (org_id, report_token, token_expires_at, category, description)
      VALUES (${orgId}, ${"OLDTOKEN_" + SUFFIX + "_0123456789abcdefghij"},
              now() - interval '1 day', 'fraud', 'ENC==')
      RETURNING id`,
      "r",
    );
    const c = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO wb_case (org_id, report_id, case_number, status,
                           acknowledge_deadline, response_deadline, closed_at)
      VALUES (${orgId}, ${r.id}, ${"WB-" + SUFFIX + "-OLD"}, 'closed',
              now() - interval '4 years', now() - interval '4 years',
              now() - interval '4 years')
      RETURNING id`,
      "c",
    );
    await sql`
      INSERT INTO wb_case_message (case_id, org_id, direction, content, author_type)
      VALUES (${c.id}, ${orgId}, 'inbound', 'ENC==', 'whistleblower')`;

    const res = requireRow(
      await sql<{ cases_purged: number; rows_purged: number }[]>`
      SELECT * FROM whistleblowing_retention_purge(${orgId}::uuid, 1095, false)`,
      "res",
    );
    expect(Number(res.cases_purged)).toBeGreaterThanOrEqual(1);

    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM wb_case WHERE id = ${c.id}`,
      "n",
    );
    expect(n).toBe(0);

    // Auch die Kopie im vertraulichen Fachlog ist weg — sonst überlebt
    // der Fall die gesetzliche Löschung in genau dem Log, das ihn am
    // detailliertesten beschreibt.
    const { m } = requireRow(
      await sql<{ m: number }[]>`
      SELECT count(*)::int AS m FROM whistleblowing_audit_log WHERE case_id = ${c.id}`,
      "m",
    );
    expect(m).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-02 — ip_hash (Referenz auf die Anwendungsschicht)", () => {
  it("the unsalted SHA-256 of an IP is trivially reversible over a /24", () => {
    // Dieser Test dokumentiert, WARUM `hashIp()` geändert wurde. Der
    // Nachweis, dass die neue Implementierung dem standhält, liegt in
    // packages/shared/tests/wb-crypto.test.ts (sie ist Anwendungscode).
    const target = createHash("sha256").update("10.20.30.44").digest("hex");
    let found: string | null = null;
    for (let i = 0; i < 256; i++) {
      const cand = `10.20.30.${i}`;
      if (createHash("sha256").update(cand).digest("hex") === target) {
        found = cand;
        break;
      }
    }
    expect(found).toBe("10.20.30.44");
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-25 — search_index und copilot_rag_source folgen dem Soft-Delete", () => {
  it("removes a soft-deleted risk from the search index", async () => {
    const r = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO risk (org_id, title, description, status, risk_category, risk_source)
      VALUES (${orgId}, 'WP8 Testrisiko', 'Beschreibung mit Namen', 'identified',
              'operational', 'erm')
      RETURNING id`,
      "r",
    );
    const before = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM search_index
       WHERE entity_type = 'risk' AND entity_id = ${r.id}`,
      "before",
    );
    expect(before.n).toBe(1);

    await sql`UPDATE risk SET deleted_at = now() WHERE id = ${r.id}`;

    const after = requireRow(
      await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM search_index
       WHERE entity_type = 'risk' AND entity_id = ${r.id}`,
      "after",
    );
    expect(after.n).toBe(0);
  });

  it("copilot_rag_prune removes entries whose source is gone", async () => {
    const r = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO risk (org_id, title, description, status, risk_category, risk_source)
      VALUES (${orgId}, 'WP8 RAG-Risiko', 'Text', 'identified', 'operational', 'erm')
      RETURNING id`,
      "r",
    );
    await sql`
      INSERT INTO copilot_rag_source (org_id, source_type, entity_id, title, content)
      VALUES (${orgId}, 'risk', ${r.id}, 'WP8 RAG-Risiko', 'Text')`;
    await sql`UPDATE risk SET deleted_at = now() WHERE id = ${r.id}`;

    const { n } = requireRow(
      await sql<{ n: number }[]>`
      SELECT copilot_rag_prune(${orgId}::uuid) AS n`,
      "n",
    );
    expect(Number(n)).toBeGreaterThanOrEqual(1);

    const { m } = requireRow(
      await sql<{ m: number }[]>`
      SELECT count(*)::int AS m FROM copilot_rag_source WHERE entity_id = ${r.id}`,
      "m",
    );
    expect(m).toBe(0);
  });

  it("copilot_rag_source has the unique key its upsert always assumed", async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'copilot_rag_source' AND indexname = 'crs_unique_source'`;
    expect(rows.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe("S07-14 — Vier-Augen-Prinzip beim Massenexport", () => {
  it("refuses an approval granted by the requester themselves", async () => {
    const u1 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`requester.${SUFFIX}@wp8-test.example`}, 'Requester', ${LEGACY_PW}) RETURNING id`,
      "u1",
    );
    // Der CHECK-Constraint, nicht die Anwendungslogik, hält das Prinzip.
    await expect(
      sql`INSERT INTO export_approval
            (org_id, requested_by, entity_types, reason, status, approved_by, approved_at)
          VALUES (${orgId}, ${u1.id}, ARRAY['ropa_entry'], 'test', 'approved',
                  ${u1.id}, now())`,
    ).rejects.toThrow(/four_eyes|check constraint/i);
  });

  it("consumes a valid approval exactly once", async () => {
    const u1 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`req2.${SUFFIX}@wp8-test.example`}, 'Req2', ${LEGACY_PW}) RETURNING id`,
      "u1",
    );
    const u2 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`appr2.${SUFFIX}@wp8-test.example`}, 'Appr2', ${LEGACY_PW}) RETURNING id`,
      "u2",
    );
    const a = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO export_approval
        (org_id, requested_by, entity_types, reason, status, approved_by, approved_at)
      VALUES (${orgId}, ${u1.id}, ARRAY['ropa_entry','incident'], 'audit', 'approved',
              ${u2.id}, now())
      RETURNING id`,
      "a",
    );

    const first = requireRow(
      await sql<{ ok: boolean }[]>`
      SELECT export_approval_consume(${a.id}::uuid, ${orgId}::uuid, ${u1.id}::uuid,
                                     ARRAY['ropa_entry']::text[]) AS ok`,
      "first",
    );
    expect(first.ok).toBe(true);

    const second = requireRow(
      await sql<{ ok: boolean }[]>`
      SELECT export_approval_consume(${a.id}::uuid, ${orgId}::uuid, ${u1.id}::uuid,
                                     ARRAY['ropa_entry']::text[]) AS ok`,
      "second",
    );
    expect(second.ok).toBe(false);
  });

  it("refuses an approval that does not cover the requested entity types", async () => {
    const u1 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`req3.${SUFFIX}@wp8-test.example`}, 'Req3', ${LEGACY_PW}) RETURNING id`,
      "u1",
    );
    const u2 = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`appr3.${SUFFIX}@wp8-test.example`}, 'Appr3', ${LEGACY_PW}) RETURNING id`,
      "u2",
    );
    const a = requireRow(
      await sql<{ id: string }[]>`
      INSERT INTO export_approval
        (org_id, requested_by, entity_types, reason, status, approved_by, approved_at)
      VALUES (${orgId}, ${u1.id}, ARRAY['risk'], 'audit', 'approved', ${u2.id}, now())
      RETURNING id`,
      "a",
    );
    const d = requireRow(
      await sql<{ ok: boolean }[]>`
      SELECT export_approval_consume(${a.id}::uuid, ${orgId}::uuid, ${u1.id}::uuid,
                                     ARRAY['ropa_entry']::text[]) AS ok`,
      "d",
    );
    expect(d.ok).toBe(false);
  });
});
