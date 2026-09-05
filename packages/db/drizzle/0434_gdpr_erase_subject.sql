-- 0434_gdpr_erase_subject.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-04 / S07-06 / S07-13 / S07-15 / S07-28
--
-- Der Zielkonflikt aus S07-28 in einer Funktion: ein Löschantrag nach
-- Art. 17 muss den Personenbezug über alle Schemas hinweg beenden UND die
-- Audit-Kette muss danach weiter verifizieren.
--
-- Die Aufteilung, die das möglich macht:
--
--   Fachdaten            werden anonymisiert oder gelöscht (der
--                        Personenbezug endet dort tatsächlich)
--   Audit-Trail          wird redigiert, nicht gelöscht: Zeile, Zeitpunkt,
--                        Aktion und Kettenposition bleiben, der Inhalt geht.
--                        Das Content-Commitment aus WP4 (v4) bleibt
--                        unberührt, deshalb rechnet die Kette weiter auf.
--   Pseudonyme           sind HMAC unter einem Schlüssel ausserhalb der
--                        Datenbank (0425). Wird er vernichtet, endet auch
--                        die Verknüpfbarkeit der Pseudonyme — das ist der
--                        Schritt, den ADR-011 rev.2 §103 voraussetzt und
--                        den es bis jetzt nicht gab.
--   Hinweisgeberdaten    sind ausgenommen (HinSchG §8/§9). Sie folgen der
--                        Frist aus §11 Abs. 5, nicht dem Löschantrag einer
--                        beliebigen Person.
--
-- Das ist eine technische Umsetzung, keine rechtliche Würdigung: ob im
-- Einzelfall eine Aufbewahrungspflicht (§ 147 AO, § 257 HGB) oder ein
-- Legal Hold der Löschung vorgeht, entscheidet die verantwortliche
-- Stelle. `p_respect_legal_hold` bildet den Vorrang technisch ab.

CREATE TABLE IF NOT EXISTS gdpr_erasure_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  dsr_id        uuid,
  subject_user_id uuid,
  subject_email_hash text,
  reason        text NOT NULL,
  executed_by   uuid,
  executed_at   timestamptz NOT NULL DEFAULT now(),
  dry_run       boolean NOT NULL DEFAULT false,
  report        jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS gdpr_erasure_log_org_idx ON gdpr_erasure_log (org_id, executed_at DESC);

COMMENT ON TABLE gdpr_erasure_log IS
  'Nachweis nach Art. 5(2)/Art. 19 DSGVO: welcher Löschantrag wann welche Tabellen und wie viele Zeilen erfasst hat. Die E-Mail-Adresse der betroffenen Person steht hier nur als HMAC — ein Löschnachweis darf nicht die letzte Kopie des Personenbezugs sein.';

ALTER TABLE gdpr_erasure_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_erasure_log FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gdpr_erasure_log_org ON gdpr_erasure_log;
CREATE POLICY gdpr_erasure_log_org ON gdpr_erasure_log FOR SELECT
  USING (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);
DROP POLICY IF EXISTS gdpr_erasure_log_no_write ON gdpr_erasure_log;
CREATE POLICY gdpr_erasure_log_no_write ON gdpr_erasure_log FOR ALL
  USING (false) WITH CHECK (false);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT ON gdpr_erasure_log TO grc_app;
  END IF;
END $g$;

CREATE OR REPLACE FUNCTION gdpr_erase_subject(
  p_org_id   uuid,
  p_user_id  uuid,
  p_email    text,
  p_name     text,
  p_reason   text DEFAULT 'gdpr_art_17',
  p_dsr_id   uuid DEFAULT NULL,
  p_dry_run  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r          record;
  v_sets     text[];
  v_parts    text[];
  v_where    text;
  v_sql      text;
  v_n        integer;
  v_report   jsonb := '[]'::jsonb;
  v_total    integer := 0;
  v_audit_n  integer := 0;
  v_placeholder text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'gdpr_erase_subject requires an organisation';
  END IF;
  IF p_user_id IS NULL AND p_email IS NULL AND p_name IS NULL THEN
    RAISE EXCEPTION 'gdpr_erase_subject requires at least one identifier';
  END IF;

  v_placeholder := '__erased__:' || pii_hmac(
    COALESCE(p_user_id::text, lower(COALESCE(p_email, p_name))), 'subject_erasure');

  -- ── 1. Fachdaten: Kontaktangaben in allen registrierten Tabellen ──
  FOR r IN
    SELECT * FROM dsr_subject_index
     WHERE is_active
       -- Protokolltabellen werden nicht überschrieben, sondern über die
       -- Retention gelöscht bzw. (audit_log) redigiert.
       AND table_name NOT IN ('audit_log', 'access_log', 'abac_access_log',
                              'portal_audit_trail', 'sovereignty_audit_log',
                              'data_export_log', 'gdpr_erasure_log')
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(r.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    v_sets  := ARRAY[]::text[];
    v_parts := ARRAY[]::text[];

    IF r.email_column IS NOT NULL THEN
      v_sets := v_sets || format('%I = %L', r.email_column, v_placeholder || '@invalid.local');
      IF p_email IS NOT NULL THEN
        v_parts := v_parts || format('lower(%I::text) = lower(%L)', r.email_column, p_email);
      END IF;
    END IF;
    IF r.name_column IS NOT NULL THEN
      v_sets := v_sets || format('%I = %L', r.name_column, v_placeholder);
      IF p_name IS NOT NULL THEN
        v_parts := v_parts || format('%I::text = %L', r.name_column, p_name);
      END IF;
    END IF;
    IF r.user_fk_column IS NOT NULL AND p_user_id IS NOT NULL THEN
      v_parts := v_parts || format('%I = %L::uuid', r.user_fk_column, p_user_id);
    END IF;
    IF r.table_name = 'user' AND p_user_id IS NOT NULL THEN
      v_parts := v_parts || format('id = %L::uuid', p_user_id);
    END IF;

    IF cardinality(v_sets) = 0 OR cardinality(v_parts) = 0 THEN
      CONTINUE;
    END IF;

    v_where := '(' || array_to_string(v_parts, ' OR ') || ')';
    IF r.has_org_column THEN
      v_where := v_where || format(' AND org_id = %L::uuid', p_org_id);
    END IF;

    BEGIN
      IF p_dry_run THEN
        EXECUTE format('SELECT count(*)::int FROM public.%I WHERE %s', r.table_name, v_where)
          INTO v_n;
      ELSE
        v_sql := format('UPDATE public.%I SET %s WHERE %s',
                        r.table_name, array_to_string(v_sets, ', '), v_where);
        EXECUTE v_sql;
        GET DIAGNOSTICS v_n = ROW_COUNT;
      END IF;
    EXCEPTION WHEN others THEN
      v_report := v_report || jsonb_build_object(
        'table', r.table_name, 'rows', 0, 'error', SQLERRM);
      CONTINUE;
    END;

    IF v_n > 0 THEN
      v_total := v_total + v_n;
      v_report := v_report || jsonb_build_object(
        'table', r.table_name, 'rows', v_n, 'action', 'anonymised');
    END IF;
  END LOOP;

  -- ── 2. Die user-Zeile selbst ──────────────────────────────────────
  IF p_user_id IS NOT NULL AND NOT p_dry_run THEN
    UPDATE "user"
       SET avatar_url    = NULL,
           password_hash = encode(gen_random_bytes(32), 'hex'),
           ical_token    = NULL,
           external_id   = NULL,
           is_active     = false,
           deleted_at    = COALESCE(deleted_at, now())
     WHERE id = p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      v_report := v_report || jsonb_build_object(
        'table', 'user', 'rows', v_n, 'action', 'deactivated+credentials_destroyed');
    END IF;
  END IF;

  -- ── 3. Sitzungen und Geräte: harte Löschung ───────────────────────
  IF p_user_id IS NOT NULL AND NOT p_dry_run THEN
    DELETE FROM session WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_report := v_report || jsonb_build_object('table', 'session', 'rows', v_n, 'action', 'deleted');
    DELETE FROM mobile_session WHERE user_id = p_user_id AND org_id = p_org_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_report := v_report || jsonb_build_object('table', 'mobile_session', 'rows', v_n, 'action', 'deleted');
  END IF;

  -- ── 4. Audit-Trail: redigieren, nicht löschen ─────────────────────
  IF NOT p_dry_run THEN
    v_audit_n := tombstone_audit_entries_for_subject(
      p_org_id, p_user_id, p_email, p_name, p_reason);
    v_report := v_report || jsonb_build_object(
      'table', 'audit_log', 'rows', v_audit_n, 'action', 'tombstoned');
  END IF;

  -- ── 5. Nachweis ───────────────────────────────────────────────────
  IF NOT p_dry_run THEN
    INSERT INTO gdpr_erasure_log
      (org_id, dsr_id, subject_user_id, subject_email_hash, reason, executed_by, dry_run, report)
    VALUES (
      p_org_id, p_dsr_id, p_user_id,
      CASE WHEN p_email IS NULL THEN NULL ELSE pii_hmac(lower(p_email), 'erasure_subject') END,
      p_reason,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid,
      false,
      jsonb_build_object('tables', v_report, 'fachdatenZeilen', v_total, 'auditZeilen', v_audit_n));
  END IF;

  RETURN jsonb_build_object(
    'dryRun',       p_dry_run,
    'orgId',        p_org_id,
    'reason',       p_reason,
    'businessRows', v_total,
    'auditRows',    v_audit_n,
    'tables',       v_report,
    'excluded',     jsonb_build_array(jsonb_build_object(
                      'tables', 'wb_*',
                      'reason', 'HinSchG §8/§11 Abs. 5 — eigene Frist, kein Loeschantrag Dritter')),
    'keyId',        pii_pseudonym_key_id()
  );
END;
$$;

COMMENT ON FUNCTION gdpr_erase_subject(uuid, uuid, text, text, text, uuid, boolean) IS
  'S07-04/-06/-13/-15/-28: Art.-17-Löschung über alle registrierten Schemas. Fachdaten werden anonymisiert, Sitzungen gelöscht, der Audit-Trail redigiert — die Kette verifiziert danach weiter, weil das Content-Commitment (WP4, v4) erhalten bleibt.';

REVOKE ALL ON FUNCTION gdpr_erase_subject(uuid, uuid, text, text, text, uuid, boolean) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION gdpr_erase_subject(uuid, uuid, text, text, text, uuid, boolean) TO grc_app;
  END IF;
END $g$;
