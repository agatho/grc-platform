-- Migration 0386: ON DELETE CASCADE auf Nachweisbeziehungen zu RESTRICT
--
-- Migration: 0386_evidence_fk_restrict
-- Breaking: yes-breaking
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-10]
-- 38 Fremdschlüssel auf Tabellen mit Audit-, Nachweis- oder Freigabecharakter
-- trugen `ON DELETE CASCADE`. Ein Nutzer mit Löschrecht auf `audit` entfernte
-- damit ohne weitere Prüfung sämtliche Arbeitspapiere, Review-Notizen,
-- Checklisten und Sign-offs dieser Prüfung. `process_sign_off` trägt eine
-- `chain_hash`-Spalte — eine Hash-Kette, die durch einen Cascade-Delete
-- lückenlos VERSCHWINDET statt zu brechen; die Manipulation ist danach nicht
-- mehr erkennbar. Für eine ISO-19011-/17021-konforme Nachweisführung ist das
-- ein Integritätsrisiko.
--
-- Diese Migration setzt die betroffenen Beziehungen auf `ON DELETE RESTRICT`.
-- Der Löschversuch scheitert dann sichtbar (23503) statt Nachweise still
-- mitzunehmen; der fachlich vorgesehene Weg ist der in der Codebasis ohnehin
-- dominante Soft-Delete über `deleted_at`.
--
-- BEWUSST NICHT umgestellt (Cascade bleibt): rein operative Protokolle und
-- Ableitungen ohne Nachweischarakter — connector_sync_log, webhook_delivery_log,
-- agent_execution_log, catalog_entry, risk_catalog_entry,
-- control_catalog_entry, technology_application_link, audit_plan_item,
-- audit_resource_allocation. Dort ist das Mitlöschen die gewollte Semantik.
--
-- Breaking: Ein bestehender Löschpfad, der bisher auf die Kaskade baute,
-- schlägt danach fehl. Vor dem Rollout `deploy/db-backup.sh --pre-breaking-0386`.

DO $$
DECLARE
  spec   TEXT[][] := ARRAY[
    ['audit_sign_off',              'audit_sign_off_audit_id_fkey'],
    ['audit_working_paper',         'audit_working_paper_audit_id_fkey'],
    ['audit_wp_folder',             'audit_wp_folder_audit_id_fkey'],
    ['audit_wp_review_note',        'audit_wp_review_note_working_paper_id_fkey'],
    ['audit_wp_review_note_reply',  'audit_wp_review_note_reply_review_note_id_fkey'],
    ['audit_activity',              'audit_activity_audit_id_audit_id_fk'],
    ['audit_checklist',             'audit_checklist_audit_id_audit_id_fk'],
    ['audit_checklist_item',        'audit_checklist_item_checklist_id_audit_checklist_id_fk'],
    ['audit_qa_checklist_item',     'audit_qa_checklist_item_qa_review_id_fkey'],
    ['process_sign_off',            'process_sign_off_process_id_fkey'],
    ['process_approval_step',       'process_approval_step_process_id_fkey'],
    ['vendor_sign_off',             'vendor_sign_off_vendor_id_fkey'],
    ['policy_acknowledgment',       'policy_acknowledgment_distribution_id_fkey'],
    ['acknowledgment',              'acknowledgment_document_id_document_id_fk'],
    ['document_approval_step',      'document_approval_step_document_id_fkey'],
    ['wb_case',                     'wb_case_report_id_wb_report_id_fk'],
    ['wb_case_evidence',            'wb_case_evidence_case_id_wb_case_id_fk'],
    ['wb_case_message',             'wb_case_message_case_id_wb_case_id_fk'],
    ['risk_evaluation_log',         'risk_evaluation_log_risk_id_fkey'],
    ['dd_evidence',                 'dd_evidence_session_id_dd_session_id_fk'],
    ['evidence_artifact',           'evidence_artifact_connector_id_fkey'],
    ['evidence_review_result',      'evidence_review_result_job_id_fkey'],
    ['evidence_review_gap',         'evidence_review_gap_job_id_fkey'],
    ['cert_evidence_package',       'cert_evidence_package_assessment_id_fkey'],
    ['cert_mock_audit',             'cert_mock_audit_assessment_id_fkey'],
    ['attestation_response',        'attestation_response_campaign_id_fkey'],
    ['approval_decision',           'approval_decision_request_id_fkey'],
    ['crisis_log',                  'crisis_log_crisis_scenario_id_crisis_scenario_id_fk'],
    ['bc_exercise_inject_log',      'bc_exercise_inject_log_exercise_id_fkey'],
    ['programme_approval_event',    'programme_approval_event_journey_id_fkey'],
    ['programme_approval_event',    'programme_approval_event_step_id_fkey']
  ];
  i        INT;
  tbl      TEXT;
  cname    TEXT;
  src_cols TEXT;
  ref_tbl  TEXT;
  ref_cols TEXT;
  upd      TEXT;
  changed  INT := 0;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    tbl   := spec[i][1];
    cname := spec[i][2];

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord),
           rt.relname,
           string_agg(quote_ident(ra.attname), ', ' ORDER BY k.ord),
           CASE c.confupdtype WHEN 'c' THEN ' ON UPDATE CASCADE'
                              WHEN 'n' THEN ' ON UPDATE SET NULL'
                              WHEN 'r' THEN ' ON UPDATE RESTRICT'
                              ELSE '' END
      INTO src_cols, ref_tbl, ref_cols, upd
    FROM pg_constraint c
    JOIN pg_class t   ON t.oid = c.conrelid
    JOIN pg_class rt  ON rt.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
    JOIN LATERAL unnest(c.conkey)  WITH ORDINALITY k(attnum, ord)  ON TRUE
    JOIN LATERAL unnest(c.confkey) WITH ORDINALITY rk(attnum, ord) ON rk.ord = k.ord
    JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum  = k.attnum
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = rk.attnum
    WHERE c.contype = 'f'
      AND c.confdeltype = 'c'          -- nur, solange es noch CASCADE ist
      AND t.relname = tbl
      AND c.conname = cname
    GROUP BY rt.relname, c.confupdtype;

    IF src_cols IS NULL THEN
      CONTINUE;  -- Constraint fehlt oder ist bereits umgestellt
    END IF;

    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, cname);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I (%s) ON DELETE RESTRICT%s',
      tbl, cname, src_cols, ref_tbl, ref_cols, upd);
    changed := changed + 1;
  END LOOP;

  RAISE NOTICE '0386: % evidence foreign keys switched from CASCADE to RESTRICT', changed;
END $$;
