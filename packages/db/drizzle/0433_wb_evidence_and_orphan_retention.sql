-- 0433_wb_evidence_and_orphan_retention.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-20 (High), S07-12 (Medium, Ergänzung)
--
-- Befund S07-20: `POST /api/v1/portal/mailbox/:token/evidence` berechnet
-- den SHA-256 über die hochgeladene Datei, baut einen `storage_path`
-- zusammen, verwirft den Puffer — und antwortet mit 201 samt Dateiname,
-- Größe und Hash. Gespeichert wird nichts. `wb_case_evidence.is_immutable`
-- steht auf `true` und der Hash bezieht sich auf einen Inhalt, den niemand
-- mehr hat. Die hinweisgebende Person erhält eine Empfangsbestätigung für
-- ein Beweismittel, das nicht existiert.
--
-- Der eigentliche Fix liegt in der Route (Datei gehört WP8). Hier steht
-- der Teil, der verhindert, dass derselbe Zustand jemals wieder unbemerkt
-- entsteht: eine Zeile darf sich nicht als unveränderliches Beweismittel
-- ausgeben, ohne einen belegten Speichervorgang.

ALTER TABLE wb_case_evidence
  ADD COLUMN IF NOT EXISTS stored_at        timestamptz,
  ADD COLUMN IF NOT EXISTS storage_backend  text;

COMMENT ON COLUMN wb_case_evidence.stored_at IS
  'S07-20: Zeitpunkt, zu dem der Dateiinhalt tatsächlich im Objektspeicher lag. NULL heißt: es gibt keine Datei zu dieser Zeile.';

DO $ck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wb_case_evidence_storage_ck'
  ) THEN
    -- NOT VALID: Bestandszeilen (die es laut Befund gar nicht geben kann,
    -- weil nie eine Datei gespeichert wurde) bleiben unangetastet; jede
    -- NEUE Zeile muss den Speichernachweis mitbringen.
    ALTER TABLE wb_case_evidence
      ADD CONSTRAINT wb_case_evidence_storage_ck
      CHECK (
        is_immutable IS NOT TRUE
        OR (storage_path IS NOT NULL AND sha256_hash IS NOT NULL AND stored_at IS NOT NULL)
      ) NOT VALID;
  END IF;
END
$ck$;

-- ── S07-12, Ergänzung: Meldungen ohne Fall ───────────────────────────
-- `whistleblowing_retention_purge()` aus 0429 räumt über abgeschlossene
-- Fälle ab. Eine Meldung, zu der nie ein Fall angelegt wurde (verworfen,
-- Doppelmeldung, Spam), hätte damit gar keinen Löschpfad — sie bliebe mit
-- `description`, `contact_email`, `ip_hash` und `category` unbefristet
-- liegen. `wb_report.token_expires_at` lässt nur den Zugangstoken
-- verfallen, nicht die Zeile.

CREATE OR REPLACE FUNCTION whistleblowing_orphan_report_purge(
  p_org_id         uuid,
  p_retention_days integer DEFAULT 1095,
  p_dry_run        boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_cutoff  timestamptz := now() - make_interval(days => p_retention_days);
  v_reports uuid[];
  v_rows    integer := 0;
  v_n       integer;
BEGIN
  SELECT COALESCE(array_agg(r.id), '{}') INTO v_reports
    FROM wb_report r
   WHERE (p_org_id IS NULL OR r.org_id = p_org_id)
     AND r.submitted_at < v_cutoff
     AND NOT EXISTS (SELECT 1 FROM wb_case c WHERE c.report_id = r.id);

  IF cardinality(v_reports) = 0 THEN
    RETURN 0;
  END IF;

  IF p_dry_run THEN
    INSERT INTO retention_run_log
      (org_id, data_category, table_name, retention_days, cutoff, rows_affected, dry_run, strategy)
    VALUES (p_org_id, 'whistleblowing', 'wb_report(orphan)', p_retention_days, v_cutoff,
            cardinality(v_reports), true, 'hard_delete');
    RETURN cardinality(v_reports);
  END IF;

  DELETE FROM wb_case_evidence WHERE report_id = ANY(v_reports);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_anonymous_mailbox WHERE report_id = ANY(v_reports);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  DELETE FROM wb_report WHERE id = ANY(v_reports);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;

  ALTER TABLE whistleblowing_audit_log DISABLE TRIGGER wb_audit_log_append_only_trg;
  BEGIN
    DELETE FROM whistleblowing_audit_log WHERE case_id = ANY(v_reports);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_rows := v_rows + v_n;
  EXCEPTION WHEN others THEN
    ALTER TABLE whistleblowing_audit_log ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg;
    RAISE;
  END;
  ALTER TABLE whistleblowing_audit_log ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg;

  INSERT INTO retention_run_log
    (org_id, data_category, table_name, retention_days, cutoff, rows_affected, dry_run, strategy)
  VALUES (p_org_id, 'whistleblowing', 'wb_report(orphan)', p_retention_days, v_cutoff,
          v_rows, false, 'hard_delete');

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION whistleblowing_orphan_report_purge(uuid, integer, boolean) IS
  'HinSchG § 11 Abs. 5 / S07-12: löscht Meldungen, zu denen nie ein Fall angelegt wurde. Ohne diesen Pfad hätten sie überhaupt keine Frist.';

REVOKE ALL ON FUNCTION whistleblowing_orphan_report_purge(uuid, integer, boolean) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION whistleblowing_orphan_report_purge(uuid, integer, boolean) TO grc_app;
  END IF;
END $g$;

-- ── Nebenbefund aus der Umsetzung von S07-19 ─────────────────────────
-- `wb_report.contact_email` ist `varchar(320)` — die Länge einer
-- KLARTEXT-E-Mail-Adresse. Gespeichert wird dort aber das AES-256-GCM-
-- Chiffrat, das bei einer 100-stelligen Adresse rund 356 Zeichen lang
-- wird. Die Rückmeldeadresse einer hinweisgebenden Person wäre also mit
-- einem 22001-Fehler abgewiesen worden — der Meldevorgang bricht ab,
-- nachdem die Person ihre Meldung bereits abgesetzt hat. Der Defekt ist
-- älter als die WP8-Änderungen; er fällt hier auf, weil das v2-Format das
-- Chiffrat um zwölf Zeichen verlängert.
ALTER TABLE wb_report ALTER COLUMN contact_email TYPE text;
