import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { createTestDb, createAppDb } from "../helpers";

/**
 * [STUFE2-E] Mandantentrennung und Layer-Daten der zehn neuen Tabellen.
 *
 * Belegt für **jede** Tabelle aus den Migrationen 0444–0452, gegen eine echte
 * Datenbank und als Rolle `grc_app` (kein Superuser, kein BYPASSRLS):
 *
 *   1. **Lesend verboten** — die Zeile des fremden Mandanten ist unsichtbar,
 *      obwohl sie existiert und obwohl nach ihrer Primärschlüssel-ID gefragt
 *      wird. Der Test fragt ausdrücklich per ID und nicht per `org_id`: eine
 *      org_id-gefilterte Abfrage könnte auch dann leer sein, wenn RLS gar
 *      nicht greift.
 *   2. **Schreibend verboten** — ein UPDATE und ein DELETE auf die fremde
 *      Zeile treffen null Zeilen; ein INSERT mit fremder `org_id` wird von der
 *      `WITH CHECK`-Klausel abgewiesen (nicht still umgeschrieben).
 *   3. **Die eigene Zeile ist sichtbar** — sonst wäre der Test wertlos: eine
 *      Tabelle, die niemandem etwas zeigt, besteht jeden Isolationstest.
 *
 * Dazu, im zweiten Block, der fachliche Beleg: die Abfragen, mit denen der
 * Overlay-Endpunkt die zehn bislang leeren Layer bedient, liefern gegen echte
 * Zeilen genau die Zahlen, die das Fixture hergibt.
 *
 * Eigene Seed-Daten in dieser Datei und nicht in `src/seed*.ts` bzw.
 * `sql/seed_demo_*.sql` — an denen arbeitet ein paralleler Strang.
 */

const suffix = Date.now();

let admin: ReturnType<typeof createTestDb>;
let app: ReturnType<typeof createAppDb>;

let orgA = "";
let orgB = "";
let userA = "";
let userB = "";

/** Je Tabelle: die Zeilen-ID in Mandant A und in Mandant B. */
const ids = new Map<string, { a: string; b: string }>();

/** Alles, was der Layer-Block braucht — nur für Mandant A. */
const fixture = {
  processA: "",
  step1: "",
  step2: "",
  roleEinkauf: "",
  roleBuchhaltung: "",
  orgUnit: "",
  vendor: "",
  dpia: "",
  ropaEntry: "",
  dataCategory: "",
  document: "",
  control: "",
  eventLog: "",
};

async function setContext(
  client: postgres.Sql,
  org: string,
  user: string,
): Promise<void> {
  await client`SELECT set_config('app.current_org_id', ${org}, false),
                      set_config('app.current_user_id', ${user}, false)`;
}

/** Legt je Mandant eine vollständige Zeilenfamilie an. */
async function seedTenant(
  client: postgres.Sql,
  org: string,
  tag: string,
  collect: boolean,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const one = async (
    sqlText: string,
    ...params: unknown[]
  ): Promise<string> => {
    const rows = await client.unsafe<{ id: string }[]>(
      sqlText,
      params as never,
    );
    return rows[0].id;
  };

  const process = await one(
    `INSERT INTO process (org_id, name, status) VALUES ($1, $2, 'draft') RETURNING id`,
    org,
    `STUFE2E ${tag} ${suffix}`,
  );
  out.process = process;

  const step1 = await one(
    `INSERT INTO process_step (process_id, org_id, bpmn_element_id, name, step_type, sequence_order, line_of_defense)
     VALUES ($1, $2, 'Task_1', 'Bestellung erfassen', 'task', 1, 'first') RETURNING id`,
    process,
    org,
  );
  const step2 = await one(
    `INSERT INTO process_step (process_id, org_id, bpmn_element_id, name, step_type, sequence_order, line_of_defense)
     VALUES ($1, $2, 'Task_2', 'Rechnung freigeben', 'task', 2, 'first') RETURNING id`,
    process,
    org,
  );
  out.step1 = step1;
  out.step2 = step2;

  const roleEinkauf = await one(
    `INSERT INTO custom_role (org_id, name) VALUES ($1, $2) RETURNING id`,
    org,
    `Einkauf ${tag} ${suffix}`,
  );
  const roleBuchhaltung = await one(
    `INSERT INTO custom_role (org_id, name) VALUES ($1, $2) RETURNING id`,
    org,
    `Buchhaltung ${tag} ${suffix}`,
  );
  out.roleEinkauf = roleEinkauf;
  out.roleBuchhaltung = roleBuchhaltung;

  const orgUnit = await one(
    `INSERT INTO eam_org_unit (org_id, name) VALUES ($1, $2) RETURNING id`,
    org,
    `Zentraleinkauf ${tag} ${suffix}`,
  );
  const vendor = await one(
    `INSERT INTO vendor (org_id, name, category, tier, status)
     VALUES ($1, $2, 'cloud_provider', 'critical', 'active') RETURNING id`,
    org,
    `CloudCo ${tag} ${suffix}`,
  );
  out.orgUnit = orgUnit;
  out.vendor = vendor;

  // --- 0444 process_lane -------------------------------------------------
  const lane = await one(
    `INSERT INTO process_lane
       (org_id, process_id, bpmn_element_id, name, kind, custom_role_id, org_unit_id, sequence_order)
     VALUES ($1, $2, 'Lane_1', 'Einkauf', 'lane', $3, $4, 1) RETURNING id`,
    org,
    process,
    roleEinkauf,
    orgUnit,
  );
  const pool = await one(
    `INSERT INTO process_lane
       (org_id, process_id, bpmn_element_id, name, kind, vendor_id, is_external, third_country, sequence_order)
     VALUES ($1, $2, 'Pool_Ext', 'Dienstleister', 'pool', $3, true, 'US', 2) RETURNING id`,
    org,
    process,
    vendor,
  );
  out.process_lane = lane;
  out.pool = pool;

  // --- 0446 sod_rule -----------------------------------------------------
  // Selbstpaarung: dieselbe Rolle verantwortet beide unverträglichen
  // Aufgaben. Genau der Fall, den STUFE2-A2-GRC.md §7.3 erlaubt haben will.
  out.sod_rule = await one(
    `INSERT INTO sod_rule (org_id, role_a_id, role_b_id, severity, rationale, framework_ref)
     VALUES ($1, $2, $2, 'critical', 'Bestellen und Freigeben in einer Hand.', 'IDW PS 261')
     RETURNING id`,
    org,
    roleEinkauf,
  );

  // --- 0447 process_step_raci --------------------------------------------
  out.process_step_raci = await one(
    `INSERT INTO process_step_raci (org_id, process_step_id, role_id, raci_role, source)
     VALUES ($1, $2, $3, 'A', 'manual') RETURNING id`,
    org,
    step1,
    roleEinkauf,
  );
  await client.unsafe(
    `INSERT INTO process_step_raci (org_id, process_step_id, role_id, raci_role, source)
     VALUES ($1, $2, $3, 'C', 'manual'), ($1, $2, $4, 'I', 'manual')`,
    [org, step1, roleBuchhaltung, roleEinkauf] as never,
  );

  // --- 0448 process_step_ropa / _data_category / _recipient --------------
  const dpia = await one(
    `INSERT INTO dpia (org_id, title, status) VALUES ($1, $2, 'approved') RETURNING id`,
    org,
    `DPIA ${tag} ${suffix}`,
  );
  out.dpia = dpia;
  out.process_step_ropa = await one(
    `INSERT INTO process_step_ropa
       (org_id, process_step_id, is_processing_activity, purpose, legal_basis,
        retention_months, retention_basis, requires_dpia, dpia_id,
        transfer_third_country, transfer_country, transfer_safeguard)
     VALUES ($1, $2, true, 'Vertragsabwicklung', 'contract', 6, '§ 147 AO',
             true, $3, true, 'US', 'SCC 2021/914') RETURNING id`,
    org,
    step1,
    dpia,
  );

  const ropaEntry = await one(
    `INSERT INTO ropa_entry (org_id, title, purpose, legal_basis, status)
     VALUES ($1, $2, 'Beschaffung', 'contract', 'draft') RETURNING id`,
    org,
    `VVT ${tag} ${suffix}`,
  );
  const dataCategory = await one(
    `INSERT INTO ropa_data_category (org_id, ropa_entry_id, category)
     VALUES ($1, $2, 'Gesundheitsdaten') RETURNING id`,
    org,
    ropaEntry,
  );
  out.ropaEntry = ropaEntry;
  out.dataCategory = dataCategory;
  out.process_step_data_category = await one(
    `INSERT INTO process_step_data_category
       (org_id, process_step_id, ropa_data_category_id, is_special_category)
     VALUES ($1, $2, $3, true) RETURNING id`,
    org,
    step1,
    dataCategory,
  );
  out.process_step_recipient = await one(
    `INSERT INTO process_step_recipient (org_id, process_step_id, recipient_id, kind)
     VALUES ($1, $2, $3, 'vendor') RETURNING id`,
    org,
    step1,
    vendor,
  );

  // --- 0449 process_step_bia ---------------------------------------------
  out.process_step_bia = await one(
    `INSERT INTO process_step_bia
       (org_id, process_step_id, criticality, mtpd_minutes, rto_minutes, rpo_minutes)
     VALUES ($1, $2, 'very_high', 105, 60, 15) RETURNING id`,
    org,
    step1,
  );
  await client.unsafe(
    `INSERT INTO process_step_bia
       (org_id, process_step_id, criticality, mtpd_minutes, rto_minutes, rpo_minutes,
        workaround, workaround_max_duration_minutes)
     VALUES ($1, $2, 'high', 480, 240, 60, 'Papierformular', 120)`,
    [org, step2] as never,
  );

  // --- 0450 process_step_document ----------------------------------------
  const document = await one(
    `INSERT INTO document (org_id, title, category, status)
     VALUES ($1, $2, 'policy', 'published') RETURNING id`,
    org,
    `AA-01 ${tag} ${suffix}`,
  );
  out.document = document;
  out.process_step_document = await one(
    `INSERT INTO process_step_document (org_id, process_step_id, document_id, relation_type)
     VALUES ($1, $2, $3, 'sop') RETURNING id`,
    org,
    step1,
    document,
  );

  // --- 0451 process_event_activity_map ------------------------------------
  const eventLog = await one(
    `INSERT INTO process_event_log (org_id, process_id, import_name, format_source, status)
     VALUES ($1, $2, $3, 'csv', 'completed') RETURNING id`,
    org,
    process,
    `Import ${tag} ${suffix}`,
  );
  out.eventLog = eventLog;
  await client.unsafe(
    `INSERT INTO process_event (event_log_id, org_id, case_id, activity, timestamp) VALUES
       ($1, $2, 'C1', 'Bestellung erfassen', now()),
       ($1, $2, 'C1', 'Bestellung erfassen', now()),
       ($1, $2, 'C2', 'Bestellung erfassen', now()),
       ($1, $2, 'C1', 'Sonderfreigabe', now())`,
    [eventLog, org] as never,
  );
  out.process_event_activity_map = await one(
    `INSERT INTO process_event_activity_map
       (org_id, event_log_id, activity_name, process_step_id, match_kind, confidence)
     VALUES ($1, $2, 'Bestellung erfassen', $3, 'exact', 1.0) RETURNING id`,
    org,
    eventLog,
    step1,
  );
  await client.unsafe(
    `INSERT INTO process_conformance_result
       (event_log_id, org_id, process_id, conformance_score, total_traces, conformant_traces, computed_at)
     VALUES ($1, $2, $3, 0.5, 2, 1, now())`,
    [eventLog, org, process] as never,
  );

  // --- 0452 user_diagram_preference ---------------------------------------
  const userId = collect ? userA : userB;
  out.user_diagram_preference = await one(
    `INSERT INTO user_diagram_preference (org_id, user_id, scope, active_view)
     VALUES ($1, $2, 'default', 'compliance') RETURNING id`,
    org,
    userId,
  );

  // --- 0453 control.is_key / owner_role_id / evidence_due_at --------------
  const control = await one(
    `INSERT INTO control (org_id, title, control_type, status, is_key, owner_role_id, evidence_due_at)
     VALUES ($1, $2, 'preventive', 'effective', true, $3, now() + interval '30 days')
     RETURNING id`,
    org,
    `Vier-Augen-Freigabe ${tag} ${suffix}`,
    roleEinkauf,
  );
  out.control = control;
  await client.unsafe(
    `INSERT INTO process_step_control (org_id, process_step_id, control_id)
     VALUES ($1, $2, $3)`,
    [org, step1, control] as never,
  );

  return out;
}

/** Die zehn Tabellen, für die der Isolationsblock läuft. */
const TABLES = [
  "process_lane",
  "sod_rule",
  "process_step_raci",
  "process_step_ropa",
  "process_step_data_category",
  "process_step_recipient",
  "process_step_bia",
  "process_step_document",
  "process_event_activity_map",
  "user_diagram_preference",
] as const;

describe("STUFE2-E — Mandantentrennung und Layer-Daten der neuen Tabellen", () => {
  beforeAll(async () => {
    admin = createTestDb();

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

    const [a] = await admin.client<{ id: string }[]>`
      INSERT INTO organization (name, type, country)
      VALUES (${`STUFE2E A ${suffix}`}, 'subsidiary', 'DEU') RETURNING id`;
    const [b] = await admin.client<{ id: string }[]>`
      INSERT INTO organization (name, type, country)
      VALUES (${`STUFE2E B ${suffix}`}, 'subsidiary', 'AUT') RETURNING id`;
    orgA = a.id;
    orgB = b.id;

    const [ua] = await admin.client<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`stufe2e-a-${suffix}@test.dev`}, 'S2E A', 'x') RETURNING id`;
    const [ub] = await admin.client<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${`stufe2e-b-${suffix}@test.dev`}, 'S2E B', 'x') RETURNING id`;
    userA = ua.id;
    userB = ub.id;

    await admin.client`
      INSERT INTO user_organization_role (user_id, org_id, role)
      VALUES (${userA}, ${orgA}, 'admin'), (${userB}, ${orgB}, 'admin')`;

    const seedA = await seedTenant(admin.client, orgA, "A", true);
    const seedB = await seedTenant(admin.client, orgB, "B", false);

    for (const table of TABLES) {
      ids.set(table, { a: seedA[table], b: seedB[table] });
    }
    fixture.processA = seedA.process;
    fixture.step1 = seedA.step1;
    fixture.step2 = seedA.step2;
    fixture.roleEinkauf = seedA.roleEinkauf;
    fixture.roleBuchhaltung = seedA.roleBuchhaltung;
    fixture.orgUnit = seedA.orgUnit;
    fixture.vendor = seedA.vendor;
    fixture.dpia = seedA.dpia;
    fixture.ropaEntry = seedA.ropaEntry;
    fixture.dataCategory = seedA.dataCategory;
    fixture.document = seedA.document;
    fixture.control = seedA.control;
    fixture.eventLog = seedA.eventLog;
    void seedB;

    app = createAppDb();
    await setContext(app.client, orgA, userA);
  }, 120_000);

  afterAll(async () => {
    try {
      await app.client`SELECT set_config('app.current_org_id', '', false)`;
      await app.client.end();
    } catch {
      /* ignore */
    }
    await admin.client.unsafe(`SET session_replication_role = 'replica'`);
    await admin.client.unsafe(
      `DO $$
       DECLARE t text;
       BEGIN
         FOR t IN
           SELECT DISTINCT c.table_name
             FROM information_schema.columns c
             JOIN information_schema.tables m
               ON m.table_schema = c.table_schema AND m.table_name = c.table_name
              AND m.table_type = 'BASE TABLE'
            WHERE c.table_schema = 'public' AND c.column_name = 'org_id'
              AND c.table_name <> 'organization'
         LOOP
           EXECUTE format('DELETE FROM %I WHERE org_id IN ($1, $2)', t)
             USING '${orgA}'::uuid, '${orgB}'::uuid;
         END LOOP;
       END $$;`,
    );
    await admin.client.unsafe(`
      DELETE FROM audit_log WHERE user_id IN ('${userA}', '${userB}');
      DELETE FROM "user" WHERE id IN ('${userA}', '${userB}');
      DELETE FROM organization WHERE id IN ('${orgA}', '${orgB}');
    `);
    await admin.client.unsafe(`SET session_replication_role = 'origin'`);
    await admin.client.end();
  }, 120_000);

  /* ---------------------------------------------------------------- *
   * 1. Mandantentrennung, je Tabelle, lesend und schreibend
   * ---------------------------------------------------------------- */

  describe.each(TABLES)("%s", (table) => {
    it("zeigt die eigene Zeile", async () => {
      const own = ids.get(table)?.a;
      expect(own, `kein Seed fuer ${table} in Mandant A`).toBeTruthy();
      const rows = await app.client.unsafe<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE id = $1`,
        [own] as never,
      );
      expect(rows).toHaveLength(1);
    });

    it("zeigt die Zeile des fremden Mandanten nicht — auch nicht per ID", async () => {
      const foreign = ids.get(table)?.b;
      expect(foreign, `kein Seed fuer ${table} in Mandant B`).toBeTruthy();
      const rows = await app.client.unsafe<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE id = $1`,
        [foreign] as never,
      );
      expect(rows).toHaveLength(0);
      // Und der Gegenbeweis: als Superuser ist sie sehr wohl da. Ohne ihn
      // bewiese der Test nur, dass die Zeile nicht existiert.
      const asAdmin = await admin.client.unsafe<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE id = $1`,
        [foreign] as never,
      );
      expect(asAdmin).toHaveLength(1);
    });

    it("laesst die fremde Zeile nicht aendern", async () => {
      const foreign = ids.get(table)!.b;
      const result = await app.client.unsafe(
        `UPDATE ${table} SET org_id = org_id WHERE id = $1`,
        [foreign] as never,
      );
      expect(result.count).toBe(0);
    });

    it("laesst die fremde Zeile nicht loeschen", async () => {
      const foreign = ids.get(table)!.b;
      const result = await app.client.unsafe(
        `DELETE FROM ${table} WHERE id = $1`,
        [foreign] as never,
      );
      expect(result.count).toBe(0);
      const stillThere = await admin.client.unsafe<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE id = $1`,
        [foreign] as never,
      );
      expect(stillThere).toHaveLength(1);
    });

    it("weist ein INSERT mit fremder org_id ab (WITH CHECK)", async () => {
      // Kopiert die eigene Zeile und tauscht nur die org_id. Die Policy muss
      // das zurueckweisen, statt die Zeile still dem fremden Mandanten
      // zuzuschlagen — der Unterschied zwischen einer Isolations- und einer
      // Filterregel.
      await expect(
        app.client.unsafe(
          `INSERT INTO ${table}
             SELECT (jsonb_populate_record(NULL::${table},
                     to_jsonb(t) || jsonb_build_object('id', gen_random_uuid()::text,
                                                       'org_id', $2::text))).*
               FROM ${table} t WHERE t.id = $1`,
          [ids.get(table)!.a, orgB] as never,
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    });
  });

  /* ---------------------------------------------------------------- *
   * 2. Die Layer, mit echten Zeilen
   * ---------------------------------------------------------------- */

  describe("die Abfragen des Overlay-Endpunkts liefern die Fixture-Zahlen", () => {
    it("lane (F17) / trust-boundary (F5): Träger, Drittland, Rolle", async () => {
      const rows = await app.client.unsafe<
        {
          bpmnElementId: string;
          orgUnitName: string | null;
          vendorName: string | null;
          vendorRiskClass: string | null;
          isExternal: boolean;
          thirdCountry: string | null;
        }[]
      >(
        `SELECT pl.bpmn_element_id AS "bpmnElementId",
                ou.name AS "orgUnitName",
                v.name AS "vendorName",
                v.tier::text AS "vendorRiskClass",
                pl.is_external AS "isExternal",
                pl.third_country AS "thirdCountry"
           FROM process_lane pl
           LEFT JOIN eam_org_unit ou ON ou.id = pl.org_unit_id AND ou.org_id = $1
           LEFT JOIN vendor v ON v.id = pl.vendor_id AND v.org_id = $1
                             AND v.deleted_at IS NULL
          WHERE pl.org_id = $1 AND pl.process_id = $2
          ORDER BY pl.sequence_order`,
        [orgA, fixture.processA] as never,
      );
      expect(rows.map((row) => row.bpmnElementId)).toEqual([
        "Lane_1",
        "Pool_Ext",
      ]);
      expect(rows[0].orgUnitName).toContain("Zentraleinkauf");
      expect(rows[1].vendorName).toContain("CloudCo");
      expect(rows[1].vendorRiskClass).toBe("critical");
      expect(rows[1].isExternal).toBe(true);
      expect(rows[1].thirdCountry).toBe("US");
    });

    it("sod (F3): die Selbstpaarung ist erlaubt und wird gefunden", async () => {
      const rows = await app.client.unsafe<
        { roleAId: string; roleBId: string; severity: string }[]
      >(
        `SELECT role_a_id AS "roleAId", role_b_id AS "roleBId", severity
           FROM sod_rule WHERE org_id = $1 AND is_active ORDER BY id`,
        [orgA] as never,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].roleAId).toBe(rows[0].roleBId);
      expect(rows[0].severity).toBe("critical");
    });

    it("sod: das ungeordnete Paar ist eindeutig — (B,A) neben (A,B) scheitert", async () => {
      await expect(
        admin.client.unsafe(
          `INSERT INTO sod_rule (org_id, role_a_id, role_b_id) VALUES ($1, $2, $3)`,
          [orgA, fixture.roleBuchhaltung, fixture.roleEinkauf] as never,
        ),
      ).resolves.toBeDefined();
      await expect(
        admin.client.unsafe(
          `INSERT INTO sod_rule (org_id, role_a_id, role_b_id) VALUES ($1, $2, $3)`,
          [orgA, fixture.roleEinkauf, fixture.roleBuchhaltung] as never,
        ),
      ).rejects.toThrow(/sod_rule_pair_uniq|duplicate key/i);
      await admin.client.unsafe(
        `DELETE FROM sod_rule WHERE org_id = $1 AND role_a_id <> role_b_id`,
        [orgA] as never,
      );
    });

    it("raci: C und I haben jetzt eine Heimat", async () => {
      const rows = await app.client.unsafe<{ raciRole: string }[]>(
        `SELECT raci_role AS "raciRole" FROM process_step_raci
          WHERE org_id = $1 AND process_step_id = $2 ORDER BY raci_role`,
        [orgA, fixture.step1] as never,
      );
      // varchar(1), nicht char(1): der Wert kommt ohne Auffuellzeichen
      // zurueck und braucht kein trim() (Begruendung in Migration 0447).
      expect(rows.map((row) => row.raciRole)).toEqual(["A", "C", "I"]);
    });

    it("privacy / dpia / retention: ROPA samt Kategorie und Empfänger", async () => {
      const [ropa] = await app.client.unsafe<
        {
          isProcessingActivity: boolean;
          retentionMonths: number;
          requiresDpia: boolean;
          dpiaStatus: string | null;
          transferCountry: string | null;
        }[]
      >(
        `SELECT r.is_processing_activity AS "isProcessingActivity",
                r.retention_months AS "retentionMonths",
                r.requires_dpia AS "requiresDpia",
                d.status::text AS "dpiaStatus",
                r.transfer_country AS "transferCountry"
           FROM process_step_ropa r
           LEFT JOIN dpia d ON d.id = r.dpia_id AND d.org_id = $1
                           AND d.deleted_at IS NULL
          WHERE r.org_id = $1 AND r.process_step_id = $2`,
        [orgA, fixture.step1] as never,
      );
      expect(ropa.isProcessingActivity).toBe(true);
      expect(ropa.retentionMonths).toBe(6);
      expect(ropa.requiresDpia).toBe(true);
      expect(ropa.dpiaStatus).toBe("approved");
      expect(ropa.transferCountry).toBe("US");

      const categories = await app.client.unsafe<
        { title: string; isSpecialCategory: boolean }[]
      >(
        `SELECT rdc.category AS "title", psdc.is_special_category AS "isSpecialCategory"
           FROM process_step_data_category psdc
           JOIN ropa_data_category rdc ON rdc.id = psdc.ropa_data_category_id
          WHERE psdc.org_id = $1 AND psdc.process_step_id = $2`,
        [orgA, fixture.step1] as never,
      );
      expect(categories).toEqual([
        { title: "Gesundheitsdaten", isSpecialCategory: true },
      ]);

      const recipients = await app.client.unsafe<{ title: string | null }[]>(
        `SELECT COALESCE(v.name, ou.name) AS "title"
           FROM process_step_recipient psr
           LEFT JOIN vendor v ON psr.kind = 'vendor' AND v.id = psr.recipient_id
                             AND v.org_id = $1 AND v.deleted_at IS NULL
           LEFT JOIN eam_org_unit ou ON psr.kind = 'org_unit' AND ou.id = psr.recipient_id
                                    AND ou.org_id = $1
          WHERE psr.org_id = $1 AND psr.process_step_id = $2`,
        [orgA, fixture.step1] as never,
      );
      expect(recipients[0].title).toContain("CloudCo");
    });

    it("bcm / outage: MTPD in Minuten, Reißpunkt als Minimum über die Schritte", async () => {
      const rows = await app.client.unsafe<
        {
          criticality: string;
          mtpdMinutes: number;
          workaroundMaxDurationMinutes: number | null;
        }[]
      >(
        `SELECT criticality, mtpd_minutes AS "mtpdMinutes",
                workaround_max_duration_minutes AS "workaroundMaxDurationMinutes"
           FROM process_step_bia WHERE org_id = $1 ORDER BY mtpd_minutes`,
        [orgA] as never,
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].criticality).toBe("very_high");
      // Der Reißpunkt des Prozesses ist das kleinste MTPD seiner Schritte —
      // gerechnet, nicht geschätzt. `bia_process_impact` kennt nur Stunden
      // und hätte 105 Minuten gar nicht darstellen können.
      expect(rows[0].mtpdMinutes).toBe(105);
      expect(rows[1].workaroundMaxDurationMinutes).toBe(120);
    });

    it("document: die Anweisung hängt am Schritt, nicht am Prozess", async () => {
      const rows = await app.client.unsafe<{ title: string }[]>(
        `SELECT d.title FROM process_step_document psd
           JOIN document d ON d.id = psd.document_id AND d.deleted_at IS NULL
          WHERE psd.org_id = $1 AND psd.process_step_id = $2`,
        [orgA, fixture.step1] as never,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain("AA-01");
      // Und am zweiten Schritt hängt sie nicht — genau das ist der Unterschied
      // zu `process_document(process_id)`.
      const other = await app.client.unsafe<{ title: string }[]>(
        `SELECT d.title FROM process_step_document psd
           JOIN document d ON d.id = psd.document_id
          WHERE psd.org_id = $1 AND psd.process_step_id = $2`,
        [orgA, fixture.step2] as never,
      );
      expect(other).toHaveLength(0);
    });

    it("conformance (F7): Abdeckungsquote 0,75 und ein Rework-Fall", async () => {
      const [summary] = await app.client.unsafe<
        {
          coverageRatio: number | null;
          unmappedActivities: string[];
          totalTraces: number | null;
          conformantTraces: number | null;
        }[]
      >(
        `WITH log AS (
           SELECT id FROM process_event_log
            WHERE org_id = $1 AND process_id = $2
            ORDER BY imported_at DESC, id DESC LIMIT 1),
         totals AS (
           SELECT COUNT(*)::int AS events, COUNT(DISTINCT e.case_id)::int AS traces
             FROM process_event e JOIN log ON log.id = e.event_log_id
            WHERE e.org_id = $1),
         matched AS (
           SELECT COUNT(*)::int AS events FROM process_event e
             JOIN log ON log.id = e.event_log_id
             JOIN process_event_activity_map m ON m.event_log_id = e.event_log_id
              AND m.activity_name = e.activity AND m.process_step_id IS NOT NULL
            WHERE e.org_id = $1 AND m.org_id = $1),
         unmapped AS (
           SELECT ARRAY_AGG(DISTINCT e.activity) AS names FROM process_event e
             JOIN log ON log.id = e.event_log_id
             LEFT JOIN process_event_activity_map m ON m.event_log_id = e.event_log_id
              AND m.activity_name = e.activity AND m.process_step_id IS NOT NULL
            WHERE e.org_id = $1 AND m.id IS NULL)
         SELECT CASE WHEN totals.events > 0
                     THEN matched.events::float8 / totals.events END AS "coverageRatio",
                COALESCE(unmapped.names, ARRAY[]::varchar[]) AS "unmappedActivities",
                NULLIF(totals.traces, 0) AS "totalTraces",
                (SELECT r.conformant_traces FROM process_conformance_result r
                   JOIN log ON log.id = r.event_log_id
                  WHERE r.org_id = $1 ORDER BY r.computed_at DESC LIMIT 1)
                  AS "conformantTraces"
           FROM totals, matched, unmapped`,
        [orgA, fixture.processA] as never,
      );
      // 4 Ereignisse, 3 davon zugeordnet.
      expect(summary.coverageRatio).toBeCloseTo(0.75, 6);
      expect(summary.unmappedActivities).toEqual(["Sonderfreigabe"]);
      expect(summary.totalTraces).toBe(2);
      expect(summary.conformantTraces).toBe(1);

      const perStep = await app.client.unsafe<
        { matchKind: string; observedCases: number; reworkLoops: number }[]
      >(
        `WITH log AS (
           SELECT id FROM process_event_log WHERE org_id = $1 AND process_id = $2
            ORDER BY imported_at DESC, id DESC LIMIT 1),
         mapped AS (
           SELECT m.activity_name, m.process_step_id, m.match_kind
             FROM process_event_activity_map m JOIN log ON log.id = m.event_log_id
            WHERE m.org_id = $1 AND m.process_step_id IS NOT NULL),
         per_case AS (
           SELECT mp.process_step_id AS step_id, e.case_id, COUNT(*)::int AS occurrences
             FROM process_event e JOIN log ON log.id = e.event_log_id
             JOIN mapped mp ON mp.activity_name = e.activity
            WHERE e.org_id = $1 GROUP BY mp.process_step_id, e.case_id),
         agg AS (
           SELECT step_id, COUNT(*)::int AS cases,
                  COUNT(*) FILTER (WHERE occurrences > 1)::int AS rework
             FROM per_case GROUP BY step_id)
         SELECT (ARRAY_AGG(m.match_kind))[1] AS "matchKind",
                COALESCE(MAX(a.cases), 0)::int AS "observedCases",
                COALESCE(MAX(a.rework), 0)::int AS "reworkLoops"
           FROM mapped m LEFT JOIN agg a ON a.step_id = m.process_step_id
          GROUP BY m.process_step_id`,
        [orgA, fixture.processA] as never,
      );
      expect(perStep).toHaveLength(1);
      expect(perStep[0].matchKind).toBe("exact");
      expect(perStep[0].observedCases).toBe(2);
      // C1 führt „Bestellung erfassen" zweimal aus — genau ein Rework-Fall.
      expect(perStep[0].reworkLoops).toBe(1);
    });

    it("controls[].isKey und .ownerRole kommen aus der Datenbank", async () => {
      const [row] = await app.client.unsafe<
        { isKey: boolean; ownerRoleId: string; evidenceDueAt: string | null }[]
      >(
        `SELECT c.is_key AS "isKey", c.owner_role_id AS "ownerRoleId",
                c.evidence_due_at AS "evidenceDueAt"
           FROM process_step_control psc
           JOIN control c ON c.id = psc.control_id AND c.deleted_at IS NULL
          WHERE psc.org_id = $1 AND psc.process_step_id = $2`,
        [orgA, fixture.step1] as never,
      );
      expect(row.isKey).toBe(true);
      expect(row.ownerRoleId).toBe(fixture.roleEinkauf);
      expect(row.evidenceDueAt).not.toBeNull();
    });

    it("step_key ist gesetzt und je Prozess eindeutig", async () => {
      const rows = await app.client.unsafe<{ stepKey: string }[]>(
        `SELECT step_key::text AS "stepKey" FROM process_step
          WHERE org_id = $1 AND process_id = $2`,
        [orgA, fixture.processA] as never,
      );
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.stepKey)).size).toBe(2);
      for (const row of rows) expect(row.stepKey).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  /* ---------------------------------------------------------------- *
   * 3. Die Loeschregeln, an denen S09-10 haengt
   * ---------------------------------------------------------------- */

  describe("Loeschregeln (S09-10)", () => {
    it("ein Dokument mit Schrittverknuepfung laesst sich nicht hart loeschen", async () => {
      await expect(
        admin.client.unsafe(`DELETE FROM document WHERE id = $1`, [
          fixture.document,
        ] as never),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });

    it("eine Rolle mit SoD-Regel laesst sich nicht loeschen", async () => {
      await expect(
        admin.client.unsafe(`DELETE FROM custom_role WHERE id = $1`, [
          fixture.roleEinkauf,
        ] as never),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });

    it("ein geloeschter Schritt macht die Aktivitaet unzugeordnet, statt die Zeile mitzunehmen", async () => {
      // ON DELETE SET NULL: die Zuordnung bleibt stehen und sagt die Wahrheit
      // („nicht zugeordnet"), statt still zu verschwinden.
      const [row] = await admin.client.unsafe<{ id: string }[]>(
        `INSERT INTO process_step (process_id, org_id, bpmn_element_id, name, step_type, sequence_order)
         VALUES ($1, $2, 'Task_Tmp', 'Temporaer', 'task', 9) RETURNING id`,
        [fixture.processA, orgA] as never,
      );
      const [map] = await admin.client.unsafe<{ id: string }[]>(
        `INSERT INTO process_event_activity_map
           (org_id, event_log_id, activity_name, process_step_id, match_kind)
         VALUES ($1, $2, 'Temporaer', $3, 'manual') RETURNING id`,
        [orgA, fixture.eventLog, row.id] as never,
      );
      await admin.client.unsafe(`DELETE FROM process_step WHERE id = $1`, [
        row.id,
      ] as never);
      const [after] = await admin.client.unsafe<
        { processStepId: string | null }[]
      >(
        `SELECT process_step_id AS "processStepId"
           FROM process_event_activity_map WHERE id = $1`,
        [map.id] as never,
      );
      expect(after).toBeDefined();
      expect(after.processStepId).toBeNull();
    });
  });
});
