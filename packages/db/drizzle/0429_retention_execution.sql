-- 0429_retention_execution.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-07 (High), S07-12 (Medium), S07-24 (Low), S07-23 (Low)
--
-- Befund S07-07: der einzige Retention-Job über personenbezogene Daten
-- erzeugt Tickets (`deletion_request`) und löscht nichts. Es gibt keinen
-- Verbraucher, der aus einem Ticket eine Löschung ableitet. Zusätzlich
-- rechnet er die Frist gegen `retention_schedule.created_at` — das
-- Anlagedatum der REGEL — statt gegen das Alter der DATEN, und
-- `retention_schedule` enthält überhaupt keinen Bezug zu konkreten
-- Datensätzen: nur `data_category varchar(50)` und `affected_systems
-- jsonb` als Freitext. Eine Auswertung, WELCHE Zeilen die Frist
-- überschritten haben, war damit gar nicht möglich.
--
-- Das ist die Lücke, die diese Migration schließt: eine Bindung zwischen
-- der fachlichen Datenkategorie und den Tabellen, in denen die Daten
-- tatsächlich liegen — samt der Spalte, gegen die die Frist läuft.
--
--   retention_binding   Kategorie -> Tabelle, Fristspalte, Strategie
--   retention_run_log   was ein Lauf tatsächlich gelöscht hat (Nachweis)
--   retention_purge_table()  führt genau eine Bindung aus
--
-- ── Warum eine SECURITY-DEFINER-Funktion und kein DELETE im Worker ────
-- `access_log` und `data_export_log` tragen Append-only-Rules
-- (`... ON DELETE ... DO INSTEAD NOTHING`). Ein DELETE von außen ist dort
-- ein stiller No-op: der Job hätte "gelöscht: 0" gemeldet und niemand
-- hätte gemerkt, dass die Frist nie durchgesetzt wird — genau die Klasse
-- Placebo-Fix, die dieser Befund beschreibt. Die Funktion setzt die
-- Regeln deshalb für die Dauer IHRER Transaktion aus und stellt sie
-- danach wieder her. Sie ist der einzige Weg, auf dem eine Zeile aus
-- diesen Tabellen verschwinden kann, sie prüft die Altersbedingung
-- selbst, und sie schreibt jeden Lauf nach `retention_run_log`.
-- Ein generischer `app.*`-Schalter (wie das von WP2 entfernte
-- `app.bypass_rls`) wird bewusst NICHT eingeführt.

CREATE TABLE IF NOT EXISTS retention_binding (
  id                    bigserial PRIMARY KEY,
  org_id                uuid REFERENCES organization(id),
  data_category         text NOT NULL,
  table_name            text NOT NULL,
  timestamp_column      text NOT NULL,
  filter_sql            text,
  strategy              text NOT NULL
                          CHECK (strategy IN ('hard_delete', 'soft_delete', 'anonymise')),
  default_retention_days integer NOT NULL CHECK (default_retention_days > 0),
  legal_basis           text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS retention_binding_uniq
  ON retention_binding (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        data_category, table_name);

COMMENT ON TABLE retention_binding IS
  'S07-07: Bindung zwischen der fachlichen Datenkategorie einer retention_schedule und den Tabellen, in denen die Daten liegen. org_id NULL = Vorgabe der Plattform; ein Mandant kann sie durch eine eigene Zeile übersteuern.';
COMMENT ON COLUMN retention_binding.filter_sql IS
  'Zusatzbedingung, die JEDE gelöschte Zeile erfüllen muss (z. B. legal_hold = false). Wird unverändert in die WHERE-Klausel übernommen — nur über Migrationen pflegen, nicht über eine API.';

CREATE TABLE IF NOT EXISTS retention_run_log (
  id            bigserial PRIMARY KEY,
  org_id        uuid,
  binding_id    bigint REFERENCES retention_binding(id),
  data_category text,
  table_name    text NOT NULL,
  retention_days integer NOT NULL,
  cutoff        timestamptz NOT NULL,
  rows_affected integer NOT NULL,
  dry_run       boolean NOT NULL DEFAULT false,
  strategy      text,
  error         text,
  ran_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retention_run_log_org_idx
  ON retention_run_log (org_id, ran_at DESC);

COMMENT ON TABLE retention_run_log IS
  'S07-07: Nachweis, dass eine Frist tatsächlich durchgesetzt wurde — Zeitpunkt, Stichtag, Zeilenzahl. Ohne diesen Nachweis ist "automatisierte Löschung" eine Behauptung.';

ALTER TABLE retention_binding  ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_binding  FORCE  ROW LEVEL SECURITY;
ALTER TABLE retention_run_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_run_log  FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_binding_read ON retention_binding;
CREATE POLICY retention_binding_read ON retention_binding FOR SELECT
  USING (org_id IS NULL
         OR org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);
DROP POLICY IF EXISTS retention_binding_no_write ON retention_binding;
CREATE POLICY retention_binding_no_write ON retention_binding FOR ALL
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS retention_run_log_read ON retention_run_log;
CREATE POLICY retention_run_log_read ON retention_run_log FOR SELECT
  USING (org_id IS NULL
         OR org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);
DROP POLICY IF EXISTS retention_run_log_no_write ON retention_run_log;
CREATE POLICY retention_run_log_no_write ON retention_run_log FOR ALL
  USING (false) WITH CHECK (false);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT ON retention_binding, retention_run_log TO grc_app;
  END IF;
END $g$;

-- ── Vorgaben der Plattform ───────────────────────────────────────────
-- Fristen sind fachliche Vorgaben, keine technische Wahrheit. Die Werte
-- unten sind der technische Standardwert; ein Mandant übersteuert sie über
-- eine eigene `retention_binding`-Zeile bzw. über die zugehörige
-- `retention_schedule`. Wo eine gesetzliche Frist eindeutig ist
-- (HinSchG §11 Abs. 5: drei Jahre nach Verfahrensabschluss), steht sie in
-- `legal_basis`.

INSERT INTO retention_binding
  (org_id, data_category, table_name, timestamp_column, filter_sql, strategy,
   default_retention_days, legal_basis)
VALUES
  -- S07-24: Zugriffs-, Sitzungs- und Telemetrieprotokolle
  (NULL, 'access_log',   'access_log',            'created_at', NULL, 'hard_delete',   90, 'Art. 5(1)(e) DSGVO — Betriebssicherheit, keine laengere Zweckbindung erkennbar'),
  (NULL, 'access_log',   'abac_access_log',       'created_at', NULL, 'hard_delete',  180, 'Art. 5(1)(e) DSGVO'),
  (NULL, 'access_log',   'portal_audit_trail',    'created_at', NULL, 'hard_delete',  365, 'Art. 5(1)(e) DSGVO'),
  (NULL, 'access_log',   'sovereignty_audit_log', 'created_at', NULL, 'hard_delete',  365, 'Art. 5(1)(e) DSGVO'),
  (NULL, 'session',      'session',               'expires',    NULL, 'hard_delete',   30, 'Art. 5(1)(e) DSGVO — abgelaufene Sitzungen'),
  (NULL, 'session',      'mobile_session',        'created_at', NULL, 'hard_delete',   90, 'Art. 5(1)(e) DSGVO'),
  (NULL, 'session',      'portal_session',        'created_at', NULL, 'hard_delete',  180, 'Art. 5(1)(e) DSGVO'),
  (NULL, 'export_log',   'data_export_log',       'created_at', NULL, 'hard_delete', 1095, 'Art. 5(2) DSGVO — Rechenschaft; 3 Jahre'),
  -- S07-23: Beschaeftigten-Leistungsdaten aus dem Schulungsmodul
  (NULL, 'training',     'academy_quiz_attempt',  'created_at', NULL, 'hard_delete', 1095, '§ 26 BDSG / § 87 Abs. 1 Nr. 6 BetrVG — Nachweis der Unterweisung, danach zweckerfuellt'),
  (NULL, 'training',     'policy_quiz_response',  'answered_at',NULL, 'hard_delete', 1095, '§ 26 BDSG'),
  -- Benachrichtigungen: enthalten Freitext mit Personenbezug
  (NULL, 'notification', 'notification',          'created_at', NULL, 'hard_delete',  365, 'Art. 5(1)(e) DSGVO')
ON CONFLICT DO NOTHING;

-- ── Ausführung genau einer Bindung ───────────────────────────────────

CREATE OR REPLACE FUNCTION retention_purge_table(
  p_binding_id     bigint,
  p_org_id         uuid,
  p_retention_days integer DEFAULT NULL,
  p_dry_run        boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  b            retention_binding%ROWTYPE;
  v_days       integer;
  v_cutoff     timestamptz;
  v_sql        text;
  v_where      text;
  v_count      integer := 0;
  v_has_org    boolean;
  r            record;
BEGIN
  SELECT * INTO b FROM retention_binding WHERE id = p_binding_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention binding % not found or inactive', p_binding_id;
  END IF;

  IF to_regclass('public.' || quote_ident(b.table_name)) IS NULL THEN
    RAISE EXCEPTION 'retention binding % points at missing table %', p_binding_id, b.table_name;
  END IF;

  v_days   := COALESCE(p_retention_days, b.default_retention_days);
  IF v_days <= 0 THEN
    RAISE EXCEPTION 'retention period must be positive (binding %)', p_binding_id;
  END IF;
  v_cutoff := now() - make_interval(days => v_days);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = b.table_name
       AND column_name = 'org_id'
  ) INTO v_has_org;

  v_where := format('%I < %L', b.timestamp_column, v_cutoff);
  IF v_has_org AND p_org_id IS NOT NULL THEN
    v_where := v_where || format(' AND org_id = %L::uuid', p_org_id);
  END IF;
  IF b.filter_sql IS NOT NULL AND length(trim(b.filter_sql)) > 0 THEN
    v_where := v_where || ' AND (' || b.filter_sql || ')';
  END IF;

  IF p_dry_run THEN
    EXECUTE format('SELECT count(*)::int FROM public.%I WHERE %s', b.table_name, v_where)
      INTO v_count;
  ELSE
    -- Append-only-Rules für die Dauer DIESER Transaktion aussetzen. Ohne
    -- das ist ein DELETE auf access_log / data_export_log ein stiller
    -- No-op und der Job meldet fälschlich Erfolg.
    FOR r IN
      SELECT r2.rulename
        FROM pg_rules r2
       WHERE r2.schemaname = 'public'
         AND r2.tablename = b.table_name
         AND r2.rulename LIKE '%\_no\_delete'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DISABLE RULE %I', b.table_name, r.rulename);
    END LOOP;

    BEGIN
      IF b.strategy = 'hard_delete' THEN
        v_sql := format('DELETE FROM public.%I WHERE %s', b.table_name, v_where);
      ELSIF b.strategy = 'soft_delete' THEN
        v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE %s AND deleted_at IS NULL',
                        b.table_name, v_where);
      ELSE
        RAISE EXCEPTION 'strategy % is not executed by this function (binding %)',
          b.strategy, p_binding_id;
      END IF;

      EXECUTE v_sql;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    EXCEPTION WHEN others THEN
      FOR r IN
        SELECT r2.rulename FROM pg_rules r2
         WHERE r2.schemaname = 'public' AND r2.tablename = b.table_name
           AND r2.rulename LIKE '%\_no\_delete'
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE RULE %I', b.table_name, r.rulename);
      END LOOP;
      RAISE;
    END;

    FOR r IN
      SELECT r2.rulename FROM pg_rules r2
       WHERE r2.schemaname = 'public' AND r2.tablename = b.table_name
         AND r2.rulename LIKE '%\_no\_delete'
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE RULE %I', b.table_name, r.rulename);
    END LOOP;
  END IF;

  INSERT INTO retention_run_log
    (org_id, binding_id, data_category, table_name, retention_days, cutoff,
     rows_affected, dry_run, strategy)
  VALUES
    (p_org_id, b.id, b.data_category, b.table_name, v_days, v_cutoff,
     v_count, p_dry_run, b.strategy);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION retention_purge_table(bigint, uuid, integer, boolean) IS
  'S07-07/-24: führt genau eine Retention-Bindung aus und protokolliert den Lauf. Einziger Pfad, auf dem eine Zeile aus den Append-only-Logtabellen verschwinden kann; die Altersbedingung wird hier und nicht vom Aufrufer bestimmt.';

REVOKE ALL ON FUNCTION retention_purge_table(bigint, uuid, integer, boolean) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION retention_purge_table(bigint, uuid, integer, boolean) TO grc_app;
  END IF;
END $g$;

-- ── HinSchG § 11 Abs. 5 (S07-12) ─────────────────────────────────────
-- Drei Jahre nach Abschluss des Verfahrens ist die Dokumentation zu
-- löschen. Das ist keine einzelne Tabelle, sondern ein Fall mit elf
-- abhängigen Tabellen und Fremdschlüsseln; deshalb eine eigene Funktion
-- statt einer Bindung. Die Frist läuft gegen wb_case.closed_at.
--
-- Ausdrücklich mit gelöscht wird die Kopie im vertraulichen
-- `whistleblowing_audit_log` — sonst überlebt der Fall die Löschung in
-- genau dem Log, das ihn am detailliertesten beschreibt. Das ist der
-- bewusste Vorrang der gesetzlichen Löschpflicht vor der
-- Append-only-Eigenschaft des Fachlogs; die Kette bleibt für alle
-- übrigen Fälle intakt, weil sie je `case_id` geführt wird.

CREATE OR REPLACE FUNCTION whistleblowing_retention_purge(
  p_org_id         uuid,
  p_retention_days integer DEFAULT 1095,
  p_dry_run        boolean DEFAULT false
)
RETURNS TABLE (cases_purged integer, rows_purged integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => p_retention_days);
  v_cases  uuid[];
  v_reports uuid[];
  v_invs   uuid[];
  v_pcs    uuid[];
  v_rows   integer := 0;
  v_n      integer;
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO v_cases
    FROM wb_case
   WHERE (p_org_id IS NULL OR org_id = p_org_id)
     AND closed_at IS NOT NULL
     AND closed_at < v_cutoff;

  IF cardinality(v_cases) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(report_id), '{}') INTO v_reports
    FROM wb_case WHERE id = ANY(v_cases) AND report_id IS NOT NULL;
  SELECT COALESCE(array_agg(id), '{}') INTO v_invs
    FROM wb_investigation WHERE case_id = ANY(v_cases);
  SELECT COALESCE(array_agg(id), '{}') INTO v_pcs
    FROM wb_protection_case WHERE case_id = ANY(v_cases);

  IF p_dry_run THEN
    SELECT count(*)::int INTO v_rows FROM wb_case WHERE id = ANY(v_cases);
    INSERT INTO retention_run_log
      (org_id, data_category, table_name, retention_days, cutoff, rows_affected, dry_run, strategy)
    VALUES (p_org_id, 'whistleblowing', 'wb_case', p_retention_days, v_cutoff,
            v_rows, true, 'hard_delete');
    RETURN QUERY SELECT cardinality(v_cases), v_rows;
    RETURN;
  END IF;

  -- Kinder zuerst; Reihenfolge folgt den Fremdschlüsseln.
  DELETE FROM wb_protection_event WHERE protection_case_id = ANY(v_pcs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_protection_case WHERE id = ANY(v_pcs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_evidence WHERE investigation_id = ANY(v_invs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_interview WHERE investigation_id = ANY(v_invs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_investigation_log WHERE investigation_id = ANY(v_invs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_investigation WHERE id = ANY(v_invs);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_ombudsperson_activity   WHERE case_id = ANY(v_cases);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_ombudsperson_assignment WHERE case_id = ANY(v_cases);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_case_message  WHERE case_id = ANY(v_cases);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_case_evidence WHERE case_id = ANY(v_cases);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_case WHERE id = ANY(v_cases);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_anonymous_mailbox WHERE report_id = ANY(v_reports);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_report WHERE id = ANY(v_reports);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  -- Die Fallhistorie im vertraulichen Log geht mit. Sie ist die
  -- vollständigste Kopie der Dokumentation, deren Löschung §11 Abs. 5
  -- gerade verlangt.
  ALTER TABLE whistleblowing_audit_log DISABLE TRIGGER wb_audit_log_append_only_trg;
  BEGIN
    DELETE FROM whistleblowing_audit_log
     WHERE case_id = ANY(v_cases) OR case_id = ANY(v_reports);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  EXCEPTION WHEN others THEN
    ALTER TABLE whistleblowing_audit_log ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg;
    RAISE;
  END;
  ALTER TABLE whistleblowing_audit_log ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg;

  INSERT INTO retention_run_log
    (org_id, data_category, table_name, retention_days, cutoff, rows_affected, dry_run, strategy)
  VALUES (p_org_id, 'whistleblowing', 'wb_case', p_retention_days, v_cutoff,
          v_rows, false, 'hard_delete');

  RETURN QUERY SELECT cardinality(v_cases), v_rows;
END;
$$;

COMMENT ON FUNCTION whistleblowing_retention_purge(uuid, integer, boolean) IS
  'HinSchG § 11 Abs. 5 / S07-12: löscht die Dokumentation abgeschlossener Meldeverfahren nach Ablauf der Frist, einschliesslich der Kopie im vertraulichen Fachlog. Vorher gab es dafür weder Funktion noch Job noch Fristfeld.';

REVOKE ALL ON FUNCTION whistleblowing_retention_purge(uuid, integer, boolean) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION whistleblowing_retention_purge(uuid, integer, boolean) TO grc_app;
  END IF;
END $g$;
