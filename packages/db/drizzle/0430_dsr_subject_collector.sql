-- 0430_dsr_subject_collector.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-13 (Medium)
--
-- Befund: Art. 15 (Auskunft) und Art. 20 (Übertragbarkeit) sind im Produkt
-- reine Vorgangssteuerung. `dsr` speichert Antragsart, Status, Frist und
-- Bearbeiter; die acht Zustandsübergänge setzen den Status und schreiben
-- eine Aktivitätszeile. Es gibt keine Funktion, die zu einer natürlichen
-- Person über die 449 Tabellen mit Personenbezug hinweg zusammenträgt.
-- Die Compliance-Checkliste führt Art. 15 und Art. 20 trotzdem als "✅"
-- mit dem Beleg "+ Export-Format"; ein Export-Format existierte nicht.
--
-- Diese Migration baut den fehlenden Sammelmechanismus:
--
--   dsr_subject_index          Register der Fundstellen (Tabelle, Spalte)
--   dsr_collect_subject_data() Sammellauf über das Register -> JSONB
--
-- Das Register wird beim Anlegen AUS DEM KATALOG erzeugt, nicht von Hand
-- gepflegt: jede Tabelle mit einem Fremdschlüssel auf `user` und jede
-- Tabelle mit einer E-Mail- oder Namensspalte kommt hinein. Damit deckt es
-- denselben Bestand ab, den `/work/audit/evidence/S07-pii-inventar.csv`
-- ausweist, und eine später hinzukommende Tabelle wird durch erneutes
-- Ausführen von `dsr_subject_index_refresh()` erfasst.
--
-- ── Bewusste Ausnahme: die Hinweisgeber-Tabellen ─────────────────────
-- `wb_*` ist ausgenommen. Eine Auskunft nach Art. 15 darf nicht zum
-- Werkzeug werden, mit dem eine beschuldigte Person die Identität der
-- hinweisgebenden Person erfährt — Art. 15 Abs. 4 DSGVO (Rechte anderer
-- Personen) und HinSchG §8/§9 stehen dem entgegen. Auskünfte über
-- Meldungen laufen ausschliesslich über die Meldestelle. Das ist eine
-- technische Vorkehrung, keine rechtliche Würdigung des Einzelfalls; die
-- Entscheidung über eine Auskunft im Meldeverfahren gehört zur Meldestelle
-- und ggf. zu einer anwaltlichen Prüfung.

CREATE TABLE IF NOT EXISTS dsr_subject_index (
  id              bigserial PRIMARY KEY,
  table_name      text NOT NULL,
  user_fk_column  text,
  email_column    text,
  name_column     text,
  has_org_column  boolean NOT NULL DEFAULT true,
  category        text,
  in_portability  boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  note            text
);

CREATE UNIQUE INDEX IF NOT EXISTS dsr_subject_index_uniq
  ON dsr_subject_index (table_name);

COMMENT ON TABLE dsr_subject_index IS
  'S07-13: Register der Fundstellen personenbezogener Daten für Art. 15 / Art. 17 / Art. 20. Wird aus dem Datenbankkatalog erzeugt (dsr_subject_index_refresh), nicht von Hand gepflegt.';

ALTER TABLE dsr_subject_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_subject_index FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dsr_subject_index_read ON dsr_subject_index;
CREATE POLICY dsr_subject_index_read ON dsr_subject_index FOR SELECT USING (true);
DROP POLICY IF EXISTS dsr_subject_index_no_write ON dsr_subject_index;
CREATE POLICY dsr_subject_index_no_write ON dsr_subject_index FOR ALL
  USING (false) WITH CHECK (false);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT ON dsr_subject_index TO grc_app;
  END IF;
END $g$;

CREATE OR REPLACE FUNCTION dsr_subject_index_refresh()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n integer;
BEGIN
  WITH user_fk AS (
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = '"user"'::regclass
       AND array_length(c.conkey, 1) = 1
       AND a.attname IN ('user_id', 'subject_user_id', 'reporter_user_id',
                         'signer_user_id', 'employee_id', 'ombudsperson_user_id')
  ),
  email_col AS (
    SELECT table_name AS tbl, min(column_name) AS col
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('email', 'contact_email', 'subject_email', 'user_email',
                           'external_email', 'supplier_email', 'recipient_email')
     GROUP BY table_name
  ),
  -- `name` ist in den meisten Tabellen der Name eines Risikos, einer
  -- Kontrolle oder eines Dashboards — nicht der einer Person. In den
  -- folgenden Tabellen ist er es aber, und dort muss er erfasst werden:
  -- ohne diese Liste bliebe `user.name` und `organization_contact.name`
  -- nach einer Art.-17-Löschung im Klartext stehen (beim Bau dieser
  -- Migration gemessen).
  person_name_override(tbl) AS (
    VALUES ('user'), ('organization_contact'), ('crisis_team_member'),
           ('crisis_contact_node'), ('auditor_profile'), ('marketplace_publisher')
  ),
  name_col AS (
    SELECT tbl, min(col) AS col FROM (
      SELECT table_name AS tbl, column_name AS col
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('subject_name', 'user_name', 'contact_name',
                             'external_name', 'voter_name', 'contact_person',
                             'auditor_name', 'recipient_name', 'dpo_name')
      UNION ALL
      SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN person_name_override o ON o.tbl = c.table_name
       WHERE c.table_schema = 'public' AND c.column_name = 'name'
    ) u GROUP BY tbl
  ),
  org_col AS (
    SELECT table_name AS tbl FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'org_id'
  ),
  base AS (
    SELECT tbl FROM user_fk
    UNION SELECT tbl FROM email_col
    UNION SELECT tbl FROM name_col
  )
  INSERT INTO dsr_subject_index
    (table_name, user_fk_column, email_column, name_column, has_org_column,
     category, in_portability, is_active, note)
  SELECT
    b.tbl,
    (SELECT col FROM user_fk   u WHERE u.tbl = b.tbl LIMIT 1),
    (SELECT col FROM email_col e WHERE e.tbl = b.tbl LIMIT 1),
    (SELECT col FROM name_col  n WHERE n.tbl = b.tbl LIMIT 1),
    EXISTS (SELECT 1 FROM org_col o WHERE o.tbl = b.tbl),
    CASE
      WHEN b.tbl LIKE 'academy%' OR b.tbl LIKE 'policy_%' THEN 'Schulung/Unterweisung'
      WHEN b.tbl IN ('access_log','audit_log','abac_access_log','portal_audit_trail',
                     'sovereignty_audit_log','data_export_log','scim_sync_log') THEN 'Protokolle'
      WHEN b.tbl IN ('session','mobile_session','portal_session','device_registration',
                     'offline_sync_state') THEN 'Sitzungen/Geraete'
      WHEN b.tbl IN ('user','user_organization_role','user_custom_role','platform_admin',
                     'account','invitation') THEN 'Stammdaten/Zugang'
      ELSE 'Fachdaten'
    END,
    -- Art. 20 umfasst nur Daten, die die Person selbst bereitgestellt hat.
    -- Protokolle und abgeleitete Bewertungen gehören nicht dazu.
    b.tbl NOT IN ('access_log','audit_log','abac_access_log','portal_audit_trail',
                  'sovereignty_audit_log','data_export_log','scim_sync_log'),
    -- HinSchG §8/§9 + Art. 15 Abs. 4: Meldeverfahren nicht über die
    -- allgemeine Auskunft.
    b.tbl NOT LIKE 'wb\_%',
    CASE WHEN b.tbl LIKE 'wb\_%'
         THEN 'HinSchG §8: Auskunft ausschliesslich ueber die Meldestelle' END
  FROM base b
  WHERE to_regclass('public.' || quote_ident(b.tbl)) IS NOT NULL
  ON CONFLICT (table_name) DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

SELECT dsr_subject_index_refresh();

-- ── Sammellauf ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION dsr_collect_subject_data(
  p_org_id        uuid,
  p_user_id       uuid,
  p_email         text,
  p_name          text,
  p_portability   boolean DEFAULT false,
  p_row_limit     integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r        record;
  v_where  text;
  v_parts  text[];
  v_sql    text;
  v_rows   jsonb;
  v_count  integer;
  v_out    jsonb := '[]'::jsonb;
  v_total  integer := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'dsr_collect_subject_data requires an organisation';
  END IF;
  IF p_user_id IS NULL AND p_email IS NULL AND p_name IS NULL THEN
    RAISE EXCEPTION 'dsr_collect_subject_data requires at least one identifier';
  END IF;

  FOR r IN
    SELECT * FROM dsr_subject_index
     WHERE is_active
       AND (NOT p_portability OR in_portability)
     ORDER BY category, table_name
  LOOP
    IF to_regclass('public.' || quote_ident(r.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    v_parts := ARRAY[]::text[];
    IF r.user_fk_column IS NOT NULL AND p_user_id IS NOT NULL THEN
      v_parts := v_parts || format('%I = %L::uuid', r.user_fk_column, p_user_id);
    END IF;
    IF r.email_column IS NOT NULL AND p_email IS NOT NULL THEN
      v_parts := v_parts || format('lower(%I::text) = lower(%L)', r.email_column, p_email);
    END IF;
    IF r.name_column IS NOT NULL AND p_name IS NOT NULL THEN
      v_parts := v_parts || format('%I::text = %L', r.name_column, p_name);
    END IF;
    -- `user` selbst wird über die Primärschlüssel-Identität getroffen.
    IF r.table_name = 'user' AND p_user_id IS NOT NULL THEN
      v_parts := v_parts || format('id = %L::uuid', p_user_id);
    END IF;

    IF cardinality(v_parts) = 0 THEN
      CONTINUE;
    END IF;

    v_where := '(' || array_to_string(v_parts, ' OR ') || ')';
    IF r.has_org_column THEN
      v_where := v_where || format(' AND org_id = %L::uuid', p_org_id);
    END IF;

    BEGIN
      v_sql := format(
        'SELECT count(*)::int, COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t), ''[]''::jsonb) '
        'FROM (SELECT * FROM public.%I WHERE %s LIMIT %s) t',
        r.table_name, v_where, p_row_limit);
      EXECUTE v_sql INTO v_count, v_rows;
    EXCEPTION WHEN others THEN
      v_skipped := v_skipped || jsonb_build_object(
        'table', r.table_name, 'error', SQLERRM);
      CONTINUE;
    END;

    IF v_count > 0 THEN
      v_total := v_total + v_count;
      v_out := v_out || jsonb_build_object(
        'table',    r.table_name,
        'category', r.category,
        'rowCount', v_count,
        'truncated', v_count >= p_row_limit,
        -- Geheimnisse gehören auch in eine Auskunft nicht hinein.
        'rows',     audit_scrub_secrets_jsonb(v_rows)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'generatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'orgId',       p_org_id,
    'subject',     jsonb_build_object('userId', p_user_id, 'email', p_email, 'name', p_name),
    'scope',       CASE WHEN p_portability THEN 'art_20_portability' ELSE 'art_15_access' END,
    'totalRows',   v_total,
    'sources',     v_out,
    'skipped',     v_skipped,
    'excluded',    jsonb_build_array(jsonb_build_object(
                     'tables', 'wb_*',
                     'reason', 'HinSchG §8 / Art. 15 Abs. 4 DSGVO — Auskunft ueber Meldeverfahren ausschliesslich ueber die Meldestelle'))
  );
END;
$$;

COMMENT ON FUNCTION dsr_collect_subject_data(uuid, uuid, text, text, boolean, integer) IS
  'S07-13: sammelt zu einer natürlichen Person alle Fundstellen aus dsr_subject_index. p_portability=true liefert die Teilmenge nach Art. 20 (von der Person bereitgestellte Daten, ohne Protokolle).';

REVOKE ALL ON FUNCTION dsr_subject_index_refresh() FROM PUBLIC;
REVOKE ALL ON FUNCTION dsr_collect_subject_data(uuid, uuid, text, text, boolean, integer) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION dsr_collect_subject_data(uuid, uuid, text, text, boolean, integer) TO grc_app;
  END IF;
END $g$;

-- Ergebnisartefakt des Auskunftsverfahrens. `dsr` selbst hatte keinen
-- Bezug auf gefundene Datensätze und kein Ergebnisfeld (S07-13).
ALTER TABLE dsr
  ADD COLUMN IF NOT EXISTS collected_at        timestamptz,
  ADD COLUMN IF NOT EXISTS collected_by        uuid,
  ADD COLUMN IF NOT EXISTS collection_summary  jsonb,
  ADD COLUMN IF NOT EXISTS subject_user_id     uuid;

COMMENT ON COLUMN dsr.collection_summary IS
  'S07-13: Ergebnis des Sammellaufs (Tabellen, Zeilenzahlen, Zeitpunkt). Der Volltext wird bewusst NICHT gespeichert — er würde die Auskunft zu einer zweiten Kopie derselben Daten machen.';
