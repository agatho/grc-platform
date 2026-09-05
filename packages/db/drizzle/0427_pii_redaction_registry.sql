-- 0427_pii_redaction_registry.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-06 (High), S07-23 (Low)
--
-- Befund: `redact_pii_jsonb()` — das einzige Werkzeug, mit dem ARCTOS einen
-- Löschantrag nach Art. 17 im unveränderlichen Audit-Trail erfüllt —
--
--   * betrachtet nur die OBERSTE JSON-Ebene (keine Rekursion),
--   * nur Werte vom Typ `string` (Zahlen, Booleans, Objekte, Arrays bleiben),
--   * und nur 26 fest im Funktionsrumpf verdrahtete Schlüsselnamen.
--
-- Gemessen am maschinellen PII-Inventar (7.361 Spalten, 449 von 527 Tabellen
-- mit Personenbezug) sind das 26 von 96 direkt identifizierenden und 0 von
-- 418 Freitextspalten. Der Auditor hat es an `changes.new.password_hash`,
-- `changes.new.avatar_url` und `dsr.subject_email` reproduziert: nach dem
-- Tombstone standen sie unverändert im Log.
--
-- Fix in drei Teilen:
--
--  1. Die Schlüsselliste wandert aus dem Funktionsrumpf in eine
--     Konfigurationstabelle `pii_redaction_rule`, initial befüllt aus
--     `/work/audit/evidence/S07-pii-inventar.csv`. Eine neue Spalte
--     aufzunehmen ist damit ein INSERT, kein PL/pgSQL-Eingriff — dasselbe
--     Muster, das WP4 mit `audit_sensitive_column` etabliert hat.
--  2. `redact_pii_jsonb()` wird rekursiv, behandelt Arrays und alle
--     JSON-Typen und kennt drei Modi:
--       pseudonymise  Wert -> '__tombstoned__:' || HMAC (0425, Schlüssel
--                     außerhalb der DB; vorher: sha256(wert||entry_hash),
--                     mit dem Salt in derselben Zeile — S07-03)
--       drop          Wert -> '__redacted__'  (Freitext und Authentifikatoren:
--                     ein Pseudonym hat dort keinen Nutzen)
--       keep          ausdrückliche Ausnahme (Strukturschlüssel)
--  3. Für Schlüssel ohne Regel entscheidet `pii_key_class()` heuristisch
--     nach Namensmuster. Damit ist eine künftige Spalte NICHT
--     standardmäßig ungeschützt — das war der systematische Teil des
--     Befundes.
--
-- Bewusst NICHT redigiert werden Fremdschlüssel auf `user` (die 544
-- "pseudonym identifizierenden" Spalten des Inventars). Sie tragen den
-- Personenbezug nur mittelbar; er endet mit der Anonymisierung der
-- `user`-Zeile selbst (siehe 0434). Sie hier zu leeren würde die
-- Nachvollziehbarkeit des Audit-Trails zerstören, ohne den Personenbezug
-- zu beenden.

CREATE TABLE IF NOT EXISTS pii_redaction_rule (
  id          bigserial PRIMARY KEY,
  entity_type text,
  key_name    text NOT NULL,
  mode        text NOT NULL CHECK (mode IN ('pseudonymise', 'drop', 'keep')),
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pii_redaction_rule_uniq
  ON pii_redaction_rule (COALESCE(entity_type, '*'), key_name);

COMMENT ON TABLE pii_redaction_rule IS
  'S07-06: Schlüsselnamen, die redact_pii_jsonb() bei einer Art.-17-Redaktion behandelt. entity_type NULL = gilt für alle Entitätstypen. Erweitern per INSERT.';

ALTER TABLE pii_redaction_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_redaction_rule FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pii_redaction_rule_read ON pii_redaction_rule;
CREATE POLICY pii_redaction_rule_read ON pii_redaction_rule FOR SELECT USING (true);
DROP POLICY IF EXISTS pii_redaction_rule_no_write ON pii_redaction_rule;
CREATE POLICY pii_redaction_rule_no_write ON pii_redaction_rule
  FOR ALL USING (false) WITH CHECK (false);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT ON pii_redaction_rule TO grc_app;
  END IF;
END $g$;

-- Strukturschlüssel: ausdrückliche Ausnahmen, damit die Heuristik unten
-- den Audit-Eintrag nicht unlesbar macht.
INSERT INTO pii_redaction_rule (entity_type, key_name, mode, source) VALUES
  (NULL, 'id',          'keep', 'Strukturschluessel'),
  (NULL, 'org_id',      'keep', 'Strukturschluessel'),
  (NULL, 'created_at',  'keep', 'Strukturschluessel'),
  (NULL, 'updated_at',  'keep', 'Strukturschluessel'),
  (NULL, 'deleted_at',  'keep', 'Strukturschluessel'),
  (NULL, 'status',      'keep', 'Strukturschluessel'),
  (NULL, 'entity_type', 'keep', 'Strukturschluessel'),
  (NULL, 'file_name',   'drop', 'S07-20:Dateiname aus Hinweisgeberkontext')
ON CONFLICT (COALESCE(entity_type, '*'), key_name) DO NOTHING;

INSERT INTO pii_redaction_rule (entity_type, key_name, mode, source) VALUES
  (NULL, 'access_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'device_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'ical_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'id_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'oidc_client_secret', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'password', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'password_hash', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'refresh_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'report_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'session_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'share_token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'token', 'drop', 'S07-05:Authentifikator'),
  (NULL, 'address', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'address_override', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'auditor_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'avatar_url', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'city', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'contact_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'contact_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'contact_person', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'contact_phone', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'display_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'dpo_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'dpo_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'external_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'external_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'ip_address', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'ip_address_log', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'ip_hash', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'mobile', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'phone', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'phone_number', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'processor_dpo_contact', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'recipient_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'recipient_emails', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'recipient_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'street', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'subject_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'subject_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'supplier_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'tax_id', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'user_agent', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'user_email', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'user_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'voter_name', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'zip', 'pseudonymise', 'S07-06:direkt-identifizierend'),
  (NULL, 'acknowledgment_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'action_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'affected_services_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'aggregation_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'ai_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'answer_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'applicability_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'approval_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'approval_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'availability_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'block_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'body', 'drop', 'S07-06:Freitext'),
  (NULL, 'cancel_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'change_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'change_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'changes_in_context', 'drop', 'S07-06:Freitext'),
  (NULL, 'comment', 'drop', 'S07-06:Freitext'),
  (NULL, 'comments', 'drop', 'S07-06:Freitext'),
  (NULL, 'completion_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'conclusion_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'confidentiality_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'content', 'drop', 'S07-06:Freitext'),
  (NULL, 'control_context', 'drop', 'S07-06:Freitext'),
  (NULL, 'control_details', 'drop', 'S07-06:Freitext'),
  (NULL, 'cost_note', 'drop', 'S07-06:Freitext'),
  (NULL, 'criticality_rationale', 'drop', 'S07-06:Freitext'),
  (NULL, 'data_source_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'decision_rationale', 'drop', 'S07-06:Freitext'),
  (NULL, 'decline_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'description', 'drop', 'S07-06:Freitext'),
  (NULL, 'designation_rationale', 'drop', 'S07-06:Freitext'),
  (NULL, 'detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'details', 'drop', 'S07-06:Freitext'),
  (NULL, 'dismiss_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'dpia_trigger_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'early_warning_message', 'drop', 'S07-06:Freitext'),
  (NULL, 'edpb_assessment_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'error_details', 'drop', 'S07-06:Freitext'),
  (NULL, 'error_message', 'drop', 'S07-06:Freitext'),
  (NULL, 'evaluation_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'evidence_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'executive_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'failure_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'file_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'finding', 'drop', 'S07-06:Freitext'),
  (NULL, 'findings', 'drop', 'S07-06:Freitext'),
  (NULL, 'findings_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'footer_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'full_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'gap_details', 'drop', 'S07-06:Freitext'),
  (NULL, 'government_access_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'header_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'health_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'help_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'impact_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'implementation_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'integrity_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'item_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'legal_basis_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'link_context', 'drop', 'S07-06:Freitext'),
  (NULL, 'link_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'lock_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'long_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'maturity_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'message', 'drop', 'S07-06:Freitext'),
  (NULL, 'narrative', 'drop', 'S07-06:Freitext'),
  (NULL, 'note_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'notification_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'objection_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'overrule_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'performance_feedback', 'drop', 'S07-06:Freitext'),
  (NULL, 'personal_data_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'pii_tombstone_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'post_mortem_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'processing_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'project_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'publisher_response', 'drop', 'S07-06:Freitext'),
  (NULL, 'question_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'rationale', 'drop', 'S07-06:Freitext'),
  (NULL, 'reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'regulatory_body', 'drop', 'S07-06:Freitext'),
  (NULL, 'rejection_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'release_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'rendered_content', 'drop', 'S07-06:Freitext'),
  (NULL, 'reply_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'report_content', 'drop', 'S07-06:Freitext'),
  (NULL, 'resolution', 'drop', 'S07-06:Freitext'),
  (NULL, 'resolution_note', 'drop', 'S07-06:Freitext'),
  (NULL, 'response', 'drop', 'S07-06:Freitext'),
  (NULL, 'response_body', 'drop', 'S07-06:Freitext'),
  (NULL, 'response_note', 'drop', 'S07-06:Freitext'),
  (NULL, 'retention_justification', 'drop', 'S07-06:Freitext'),
  (NULL, 'retention_period_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'review_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'review_trigger_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'reviewer_comment', 'drop', 'S07-06:Freitext'),
  (NULL, 'revocation_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'revoke_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'risk_context', 'drop', 'S07-06:Freitext'),
  (NULL, 'sample_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'scope_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'script_content', 'drop', 'S07-06:Freitext'),
  (NULL, 'service_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'short_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'skip_reason', 'drop', 'S07-06:Freitext'),
  (NULL, 'sql_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'submitted_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'surveillance_laws_summary', 'drop', 'S07-06:Freitext'),
  (NULL, 'systematic_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'template_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'tom_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'transfer_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'translated_text', 'drop', 'S07-06:Freitext'),
  (NULL, 'treatment_rationale', 'drop', 'S07-06:Freitext'),
  (NULL, 'validity_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'verification_notes', 'drop', 'S07-06:Freitext'),
  (NULL, 'violation_detail', 'drop', 'S07-06:Freitext'),
  (NULL, 'vulnerability_description', 'drop', 'S07-06:Freitext'),
  (NULL, 'welcome_message', 'drop', 'S07-06:Freitext'),
  (NULL, 'xhtml_content', 'drop', 'S07-06:Freitext'),
  (NULL, 'yoy_explanation', 'drop', 'S07-06:Freitext'),
  ('academy_quiz_attempt', 'answers_json', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_quiz_attempt', 'score_pct', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_quiz_attempt', 'passed', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_quiz_attempt', 'attempt_number', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_quiz_attempt', 'duration_seconds', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_enrollment', 'progress_pct', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('academy_enrollment', 'completed_lessons', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('policy_quiz_response', 'selected_option_index', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten'),
  ('policy_quiz_response', 'is_correct', 'drop', 'S07-23:Beschaeftigten-Leistungsdaten')
ON CONFLICT (COALESCE(entity_type,'*'), key_name) DO NOTHING;

-- ── Heuristik für Schlüssel ohne Regel ───────────────────────────────
-- Zweck: eine Spalte, die es beim Schreiben dieser Migration noch nicht
-- gab, darf nicht deshalb ungeschützt sein, weil niemand daran gedacht
-- hat, sie einzutragen.

CREATE OR REPLACE FUNCTION pii_key_class(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN lower(p_key) ~ '(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|access[_-]?key|recovery[_-]?code)'
     AND lower(p_key) !~ '(token[_-]?count|tokens?[_-]?used|(total|input|output|prompt|completion|cached)[_-]?tokens)'
      THEN 'drop'
    WHEN lower(p_key) ~ '(^|_)(email|e_mail|mail_address)(_|$)|email$|_emails$'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(^|_)(phone|mobile|fax|telefon)(_|$)|_phone$|phone_number'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(^|_)(name|firstname|lastname|surname|vorname|nachname)(_|$)|_name$'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(ip_address|ip_hash|user_agent|device_id|fingerprint|geo_location)'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(date_of_birth|birth_date|birthday|national_id|tax_id|passport|iban|bic|account_number|social_security)'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(^|_)(street|postal_code|zip|city|address)(_|$)|_address$'
      THEN 'pseudonymise'
    WHEN lower(p_key) ~ '(description|notes?|comment|content|resolution|message|rationale|justification|summary|reason|detail|feedback|observation|narrative|text)$'
      OR lower(p_key) ~ '^(description|notes?|comment|content|resolution|message|body|detail|details)$'
      THEN 'drop'
    ELSE 'none'
  END;
$$;

COMMENT ON FUNCTION pii_key_class(text) IS
  'S07-06: Rückfallklassifikation für Schlüssel ohne Eintrag in pii_redaction_rule. Fail-safe by default: unbekannte Freitext- und Kontaktmuster werden redigiert, nicht durchgelassen.';

-- Pseudonymisiert einen JSON-Wert beliebiger Form. Skalare werden zu
-- '__tombstoned__:<HMAC>', Objekte und Arrays elementweise.
CREATE OR REPLACE FUNCTION pii_pseudonymise_value(
  p_val jsonb, p_salt text, p_depth int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_out  jsonb;
  v_key  text;
  v_item jsonb;
  v_arr  jsonb := '[]'::jsonb;
BEGIN
  IF p_val IS NULL OR p_val = 'null'::jsonb THEN
    RETURN p_val;
  END IF;
  IF p_depth > 32 THEN
    RETURN '"__redacted__"'::jsonb;
  END IF;

  IF jsonb_typeof(p_val) = 'object' THEN
    v_out := '{}'::jsonb;
    FOR v_key, v_item IN SELECT * FROM jsonb_each(p_val) LOOP
      v_out := v_out || jsonb_build_object(
        v_key, pii_pseudonymise_value(v_item, p_salt, p_depth + 1));
    END LOOP;
    RETURN v_out;
  ELSIF jsonb_typeof(p_val) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(p_val) LOOP
      v_arr := v_arr || jsonb_build_array(
        pii_pseudonymise_value(v_item, p_salt, p_depth + 1));
    END LOOP;
    RETURN v_arr;
  END IF;

  RETURN to_jsonb('__tombstoned__:' || pii_hmac(
    COALESCE(p_salt, '') || '|' ||
    CASE WHEN jsonb_typeof(p_val) = 'string' THEN p_val #>> '{}'
         ELSE p_val::text END,
    'audit_pii'));
END;
$$;

REVOKE ALL ON FUNCTION pii_pseudonymise_value(jsonb, text, int) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION pii_pseudonymise_value(jsonb, text, int) TO grc_app;
  END IF;
END $g$;

-- ââ Redaktion â───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION redact_pii_jsonb(
  p_obj         jsonb,
  p_salt        text,
  p_entity_type text DEFAULT NULL,
  p_depth       int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_out  jsonb;
  v_key  text;
  v_val  jsonb;
  v_mode text;
  v_arr  jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  IF p_obj IS NULL THEN
    RETURN NULL;
  END IF;

  -- Schutz gegen pathologisch tiefe Strukturen; 32 Ebenen sind weit mehr,
  -- als in `changes` je vorkommt.
  IF p_depth > 32 THEN
    RETURN '"__redacted__"'::jsonb;
  END IF;

  IF jsonb_typeof(p_obj) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(p_obj) LOOP
      v_arr := v_arr || jsonb_build_array(
        redact_pii_jsonb(v_item, p_salt, p_entity_type, p_depth + 1));
    END LOOP;
    RETURN v_arr;
  END IF;

  IF jsonb_typeof(p_obj) <> 'object' THEN
    RETURN p_obj;
  END IF;

  v_out := '{}'::jsonb;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_obj) LOOP
    SELECT r.mode INTO v_mode
      FROM pii_redaction_rule r
     WHERE lower(r.key_name) = lower(v_key)
       AND (r.entity_type IS NULL OR r.entity_type = p_entity_type)
     ORDER BY (r.entity_type IS NOT NULL) DESC   -- entitätsspezifisch schlägt global
     LIMIT 1;

    IF v_mode IS NULL THEN
      v_mode := pii_key_class(v_key);
    END IF;

    IF v_mode = 'keep' OR v_mode = 'none' THEN
      -- Kein Treffer auf dieser Ebene: rekursiv weiter, denn die
      -- E-Mail-Adresse kann eine Ebene tiefer liegen (genau der Fall,
      -- den die alte Implementierung nie erreicht hat).
      IF jsonb_typeof(v_val) IN ('object', 'array') THEN
        v_out := v_out || jsonb_build_object(
          v_key, redact_pii_jsonb(v_val, p_salt, p_entity_type, p_depth + 1));
      ELSE
        v_out := v_out || jsonb_build_object(v_key, v_val);
      END IF;

    ELSIF v_mode = 'drop' THEN
      v_out := v_out || jsonb_build_object(
        v_key, CASE WHEN v_val = 'null'::jsonb THEN v_val
                    ELSE '"__redacted__"'::jsonb END);

    ELSE  -- pseudonymise
      -- Auch {"old":…,"new":…} aus dem UPDATE-Diff und Arrays von
      -- Kontaktangaben werden elementweise pseudonymisiert.
      v_out := v_out || jsonb_build_object(
        v_key, pii_pseudonymise_value(v_val, p_salt, p_depth + 1));
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION redact_pii_jsonb(jsonb, text, text, int) IS
  'S07-06: rekursive Redaktion einer changes-Struktur gegen pii_redaction_rule. Behandelt Objekte, Arrays und alle Skalartypen. Ersetzt die frühere Fassung, die nur die oberste Ebene, nur Strings und nur 26 Schlüsselnamen kannte.';

REVOKE ALL ON FUNCTION redact_pii_jsonb(jsonb, text, text, int) FROM PUBLIC;
DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION redact_pii_jsonb(jsonb, text, text, int) TO grc_app;
  END IF;
END $g$;

-- Die frühere Zwei-Argument-Signatur `redact_pii_jsonb(jsonb, text)` wird
-- ERSETZT, nicht ergänzt: die neue Fassung hat Vorgabewerte für die
-- beiden hinzugekommenen Parameter und nimmt zwei Argumente weiterhin
-- entgegen. Ein zusätzlicher Zwei-Argument-Wrapper würde den Aufruf
-- mehrdeutig machen (`function redact_pii_jsonb(jsonb, unknown) is not
-- unique`) und jeden Bestandsaufrufer brechen.
DROP FUNCTION IF EXISTS redact_pii_jsonb(jsonb, text);
