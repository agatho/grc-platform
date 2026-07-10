-- ============================================================================
-- Migration 0357: Audit-Trigger-Backfill — explizite Registrierung (ADR-011)
--
-- Kontext: Der RLS-Coverage-Report (2026-05-13) listet 180 Tabellen mit
-- RLS + Policy, aber ohne statisch nachweisbare audit_trigger()-Registrierung
-- (Flag AUDIT_MISSING). Migration 0337 hat zwar einen DYNAMISCHEN Sweep über
-- alle org_id-Tabellen ausgeführt, aber:
--   1. Die statische Analyse (scripts/audit-rls-coverage.mjs) kann den
--      EXECUTE-format()-Sweep nicht sehen — der Report bleibt rot.
--   2. Tabellen OHNE org_id-Spalte (7 Stück, z. B. dd_evidence,
--      wb_anonymous_mailbox) wurden vom Sweep übersprungen und haben
--      bis heute KEINEN Trigger.
--   3. Auf einer frischen DB ist die Coverage nur durch den Sweep-Zeitpunkt
--      definiert — explizite Registrierung macht sie deterministisch.
--
-- Diese Migration registriert audit_trigger() EXPLIZIT (statisch sichtbar)
-- auf 177 Tabellen (174 aus dem Report, +1 nach dem Report hinzugekommene
-- Tabelle asset_classification_override, +2 Legacy-DMS-Tabellen).
-- Idempotent + duplikatsicher: Der Guard prüft über
-- pg_trigger ⋈ pg_proc (tgfoid), ob IRGENDEIN Trigger der Tabelle bereits
-- die Funktion audit_trigger() ausführt — unabhängig vom Trigger-Namen
-- (deckt alle drei historischen Namenskonventionen ab: `audit_trigger`,
-- `<tbl>_audit`, `<tbl>_audit_trigger`). Auf Bestands-DBs, wo der 0337-Sweep
-- schon Trigger angelegt hat, ist jeder Block ein No-Op.
--
-- to_regclass()-Guard: kein CREATE TRIGGER auf nicht existierende Tabellen
-- (relevant für die zwei Legacy-DMS-Tabellen am Ende).
--
-- Bewusst NICHT registriert (dokumentierte Ausnahmen, analog 0337):
--   - session, account, verification_token  → Auth.js-Tabellen; enthalten
--     Session-/OAuth-/Verification-Tokens — Secrets dürfen nicht in
--     audit_log.changes kopiert werden; hohe Änderungsfrequenz.
--   - process_event                         → Process-Mining-Eventstrom,
--     Massendaten (bereits in 0337 ausgenommen).
--
-- Die audit_trigger()-Funktion (rev. 0343) liest org_id via
-- to_jsonb(NEW)->>'org_id' und ist damit auch auf Tabellen ohne
-- org_id-Spalte sicher (Scope = 'org:platform').
-- ============================================================================

-- ── Platform & Collaboration (platform, module, dashboard, branding, task) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.invitation') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.invitation') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER invitation_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON invitation FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.module_config') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.module_config') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER module_config_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON module_config FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.role_permission') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.role_permission') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER role_permission_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON role_permission FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.widget_definition') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.widget_definition') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER widget_definition_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON widget_definition FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.user_dashboard_layout') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.user_dashboard_layout') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER user_dashboard_layout_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON user_dashboard_layout FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.org_branding') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.org_branding') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER org_branding_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON org_branding FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.search_index') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.search_index') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER search_index_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON search_index FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.entity_comment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.entity_comment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER entity_comment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON entity_comment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.task') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.task') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER task_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON task FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.task_comment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.task_comment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER task_comment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON task_comment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── BPM / Prozesse (process, bpm-advanced) ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.process') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_version') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_version') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_version_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_version FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_step') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_step') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_step_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_asset') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_asset') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_asset_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_asset FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_control') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_control') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_control_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_control FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_document') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_document') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_document_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_document FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_step_asset') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_step_asset') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_step_asset_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_asset FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_step_control') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_step_control') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_step_control_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_control FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_maturity_questionnaire') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_maturity_questionnaire') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_maturity_questionnaire_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_maturity_questionnaire FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_template') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_template') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_template_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_template FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── ERM / Risk (risk, erm-advanced) ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.kri_measurement') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.kri_measurement') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER kri_measurement_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON kri_measurement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_asset') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_asset') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_asset_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_asset FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_control') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_control') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_control_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_control FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_framework_mapping') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_framework_mapping') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_framework_mapping_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_framework_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_risk') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_risk') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_risk_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_risk FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_step_risk') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_step_risk') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_step_risk_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_risk FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bowtie_path') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bowtie_path') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bowtie_path_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bowtie_path FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bowtie_template') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bowtie_template') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bowtie_template_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bowtie_template FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── ISMS (isms, asset, incident-timeline, isms-intelligence) ────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.assessment_run') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.assessment_run') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER assessment_run_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON assessment_run FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.assessment_control_eval') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.assessment_control_eval') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER assessment_control_eval_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON assessment_control_eval FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.assessment_risk_eval') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.assessment_risk_eval') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER assessment_risk_eval_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON assessment_risk_eval FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.asset_classification') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.asset_classification') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER asset_classification_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON asset_classification FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.asset_cia_profile') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.asset_cia_profile') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER asset_cia_profile_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON asset_cia_profile FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  -- asset_classification_override kam erst nach dem Report (0325) dazu — im
  -- Report vom 2026-05-13 noch nicht gelistet, aber ebenfalls ohne explizite
  -- Registrierung.
  IF to_regclass('public.asset_classification_override') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.asset_classification_override') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER asset_classification_override_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON asset_classification_override FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.asset_type_risk_recommendation') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.asset_type_risk_recommendation') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER asset_type_risk_recommendation_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON asset_type_risk_recommendation FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.control_maturity') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_maturity') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_maturity_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_maturity FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.incident_timeline_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.incident_timeline_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER incident_timeline_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON incident_timeline_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.management_review') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.management_review') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER management_review_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON management_review FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_scenario') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_scenario') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_scenario_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_scenario FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.security_incident') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.security_incident') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER security_incident_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON security_incident FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.soa_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.soa_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER soa_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON soa_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.threat') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.threat') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER threat_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON threat FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vulnerability') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vulnerability') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vulnerability_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vulnerability FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.cve_feed_item') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.cve_feed_item') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER cve_feed_item_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON cve_feed_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── ICS / Evidence (control, ics-advanced) ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.evidence') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.evidence') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER evidence_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.control_library_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_library_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_library_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_library_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Audit Management (audit-mgmt, audit-advanced, audit-analytics) ──────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.audit_universe_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_universe_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_universe_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_universe_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_plan_item') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_plan_item') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_plan_item_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_plan_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_activity') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_activity') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_activity_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_activity FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_checklist_item') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_checklist_item') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_checklist_item_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_checklist_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_evidence') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_evidence') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_evidence_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_evidence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_wp_review_note_reply') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_wp_review_note_reply') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_wp_review_note_reply_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_wp_review_note_reply FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.continuous_audit_result') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.continuous_audit_result') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER continuous_audit_result_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON continuous_audit_result FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.external_auditor_activity') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.external_auditor_activity') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER external_auditor_activity_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON external_auditor_activity FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_risk_prediction') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_risk_prediction') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_risk_prediction_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_risk_prediction FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.audit_risk_prediction_model') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.audit_risk_prediction_model') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER audit_risk_prediction_model_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_risk_prediction_model FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── BCMS (bcms, bcms-advanced) ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.bia_assessment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bia_assessment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bia_assessment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bia_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bia_process_impact') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bia_process_impact') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bia_process_impact_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bia_process_impact FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bia_supplier_dependency') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bia_supplier_dependency') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bia_supplier_dependency_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bia_supplier_dependency FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bcp') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bcp') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bcp_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bcp FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bcp_procedure') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bcp_procedure') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bcp_procedure_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bcp_procedure FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bcp_resource') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bcp_resource') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bcp_resource_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bcp_resource FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.continuity_strategy') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.continuity_strategy') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER continuity_strategy_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON continuity_strategy FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.crisis_scenario') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.crisis_scenario') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER crisis_scenario_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON crisis_scenario FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.crisis_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.crisis_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER crisis_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON crisis_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.crisis_team_member') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.crisis_team_member') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER crisis_team_member_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON crisis_team_member FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.essential_process') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.essential_process') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER essential_process_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON essential_process FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bc_exercise_finding') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bc_exercise_finding') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bc_exercise_finding_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bc_exercise_finding FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.bc_exercise_scenario') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.bc_exercise_scenario') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER bc_exercise_scenario_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bc_exercise_scenario FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.resilience_score_snapshot') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.resilience_score_snapshot') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER resilience_score_snapshot_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON resilience_score_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── DPMS (dpms, dpms-advanced) ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.ropa_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ropa_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ropa_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ropa_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ropa_data_category') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ropa_data_category') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ropa_data_category_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ropa_data_category FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ropa_data_subject') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ropa_data_subject') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ropa_data_subject_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ropa_data_subject FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ropa_recipient') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ropa_recipient') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ropa_recipient_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ropa_recipient FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dpia') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dpia') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dpia_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dpia FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dpia_risk') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dpia_risk') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dpia_risk_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dpia_risk FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dpia_measure') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dpia_measure') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dpia_measure_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dpia_measure FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dsr') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dsr') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dsr_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dsr FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dsr_activity') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dsr_activity') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dsr_activity_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dsr_activity FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.data_breach') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.data_breach') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER data_breach_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON data_breach FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.data_breach_notification') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.data_breach_notification') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER data_breach_notification_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON data_breach_notification FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.tia') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.tia') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER tia_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON tia FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.country_risk_profile') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.country_risk_profile') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER country_risk_profile_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON country_risk_profile FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── TPRM & Verträge (tprm, tprm-advanced, supplier-portal) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.vendor') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vendor_contact') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor_contact') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_contact_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor_contact FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vendor_due_diligence') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor_due_diligence') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_due_diligence_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor_due_diligence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vendor_due_diligence_question') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor_due_diligence_question') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_due_diligence_question_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor_due_diligence_question FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vendor_risk_assessment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor_risk_assessment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_risk_assessment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor_risk_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.vendor_scorecard_history') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.vendor_scorecard_history') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER vendor_scorecard_history_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON vendor_scorecard_history FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.lksg_assessment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.lksg_assessment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER lksg_assessment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON lksg_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.contract') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.contract') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER contract_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON contract FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.contract_amendment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.contract_amendment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER contract_amendment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON contract_amendment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.contract_obligation') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.contract_obligation') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER contract_obligation_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON contract_obligation FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.contract_sla') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.contract_sla') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER contract_sla_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON contract_sla FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.contract_sla_measurement') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.contract_sla_measurement') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER contract_sla_measurement_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON contract_sla_measurement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dd_session') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dd_session') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dd_session_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dd_session FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dd_response') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dd_response') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dd_response_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dd_response FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.dd_evidence') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.dd_evidence') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER dd_evidence_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON dd_evidence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.questionnaire_template') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.questionnaire_template') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER questionnaire_template_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON questionnaire_template FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.questionnaire_section') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.questionnaire_section') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER questionnaire_section_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON questionnaire_section FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.questionnaire_question') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.questionnaire_question') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER questionnaire_question_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON questionnaire_question FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── ESG (esg, esg-advanced) ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.esg_materiality_assessment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_materiality_assessment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_materiality_assessment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_materiality_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_materiality_topic') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_materiality_topic') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_materiality_topic_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_materiality_topic FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_materiality_vote') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_materiality_vote') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_materiality_vote_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_materiality_vote FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_measurement') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_measurement') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_measurement_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_measurement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_target') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_target') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_target_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_target FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_annual_report') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_annual_report') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_annual_report_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_annual_report FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esg_control_link') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esg_control_link') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esg_control_link_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esg_control_link FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esrs_datapoint_definition') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esrs_datapoint_definition') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esrs_datapoint_definition_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esrs_datapoint_definition FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.esrs_metric') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.esrs_metric') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER esrs_metric_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON esrs_metric FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.emission_factor') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.emission_factor') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER emission_factor_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON emission_factor FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Whistleblowing (whistleblowing, whistleblowing-advanced) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.wb_report') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.wb_report') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER wb_report_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON wb_report FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.wb_anonymous_mailbox') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.wb_anonymous_mailbox') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER wb_anonymous_mailbox_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON wb_anonymous_mailbox FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.wb_investigation_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.wb_investigation_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER wb_investigation_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON wb_investigation_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.wb_ombudsperson_activity') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.wb_ombudsperson_activity') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER wb_ombudsperson_activity_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON wb_ombudsperson_activity FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Katalog & Framework-Mapping (catalog, framework-mapping) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.risk_catalog') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_catalog') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_catalog_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_catalog FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_catalog_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_catalog_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_catalog_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_catalog_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.control_catalog') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_catalog') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_catalog_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_catalog FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.control_catalog_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_catalog_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_catalog_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_catalog_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.general_catalog_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.general_catalog_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER general_catalog_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON general_catalog_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.catalog_lifecycle_phase') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.catalog_lifecycle_phase') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER catalog_lifecycle_phase_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON catalog_lifecycle_phase FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.org_catalog_exclusion') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.org_catalog_exclusion') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER org_catalog_exclusion_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON org_catalog_exclusion FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.org_risk_methodology') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.org_risk_methodology') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER org_risk_methodology_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON org_risk_methodology FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.framework_mapping') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.framework_mapping') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER framework_mapping_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON framework_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.framework_mapping_rule') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.framework_mapping_rule') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER framework_mapping_rule_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON framework_mapping_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.framework_coverage_snapshot') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.framework_coverage_snapshot') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER framework_coverage_snapshot_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON framework_coverage_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.framework_gap_analysis') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.framework_gap_analysis') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER framework_gap_analysis_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON framework_gap_analysis FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.control_framework_coverage') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_framework_coverage') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_framework_coverage_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_framework_coverage FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── EU AI Act & AI-Governance (ai-act, intelligence) ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.ai_system') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_system') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_system_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_system FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_conformity_assessment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_conformity_assessment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_conformity_assessment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_conformity_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_framework_mapping') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_framework_mapping') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_framework_mapping_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_framework_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_fria') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_fria') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_fria_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_fria FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_human_oversight_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_human_oversight_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_human_oversight_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_human_oversight_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_transparency_entry') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_transparency_entry') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_transparency_entry_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_transparency_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.ai_prompt_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.ai_prompt_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER ai_prompt_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON ai_prompt_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Intelligence & Analytics (intelligence) ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.control_effectiveness_score') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.control_effectiveness_score') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER control_effectiveness_score_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_effectiveness_score FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.executive_kpi_snapshot') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.executive_kpi_snapshot') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER executive_kpi_snapshot_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON executive_kpi_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.finding_sla_config') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.finding_sla_config') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER finding_sla_config_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON finding_sla_config FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.regulatory_feed_item') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.regulatory_feed_item') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER regulatory_feed_item_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON regulatory_feed_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.regulatory_relevance_score') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.regulatory_relevance_score') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER regulatory_relevance_score_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON regulatory_relevance_score FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── EAM (eam-advanced) ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.architecture_health_snapshot') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.architecture_health_snapshot') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER architecture_health_snapshot_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON architecture_health_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.cloud_service_catalog') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.cloud_service_catalog') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER cloud_service_catalog_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON cloud_service_catalog FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.technology_application_link') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.technology_application_link') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER technology_application_link_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON technology_application_link FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── API-Plattform, Events & Connectoren (api-platform, event-bus, identity, evidence-/cloud-connector) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.api_scope') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.api_scope') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER api_scope_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON api_scope FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.api_key_scope') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.api_key_scope') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER api_key_scope_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON api_key_scope FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.api_usage_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.api_usage_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER api_usage_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON api_usage_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.event_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.event_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER event_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON event_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.webhook_delivery_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.webhook_delivery_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER webhook_delivery_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON webhook_delivery_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.scim_sync_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.scim_sync_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER scim_sync_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON scim_sync_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.connector_health_check') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.connector_health_check') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER connector_health_check_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON connector_health_check FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.cloud_compliance_snapshot') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.cloud_compliance_snapshot') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER cloud_compliance_snapshot_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON cloud_compliance_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Extensions & Marketplace (extension) ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.extension_marketplace') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.extension_marketplace') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER extension_marketplace_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON extension_marketplace FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.plugin_hook') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.plugin_hook') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER plugin_hook_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON plugin_hook FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.plugin_setting') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.plugin_setting') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER plugin_setting_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON plugin_setting FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.plugin_execution_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.plugin_execution_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER plugin_execution_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON plugin_execution_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Mobile & SaaS-Metering (mobile, saas-metering) ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.mobile_session') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.mobile_session') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER mobile_session_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON mobile_session FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.offline_sync_state') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.offline_sync_state') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER offline_sync_state_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON offline_sync_state FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.push_notification') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.push_notification') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER push_notification_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON push_notification FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.usage_meter') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.usage_meter') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER usage_meter_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON usage_meter FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.usage_record') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.usage_record') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER usage_record_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON usage_record FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Agents, ABAC & Simulation (agents, abac, simulation) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.agent_execution_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.agent_execution_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER agent_execution_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON agent_execution_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.abac_access_log') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.abac_access_log') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER abac_access_log_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON abac_access_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.process_simulation_result') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.process_simulation_result') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER process_simulation_result_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_simulation_result FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.simulation_activity_param') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.simulation_activity_param') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER simulation_activity_param_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON simulation_activity_param FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.simulation_run_result') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.simulation_run_result') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER simulation_run_result_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON simulation_run_result FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.scenario_engine_scenario') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.scenario_engine_scenario') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER scenario_engine_scenario_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON scenario_engine_scenario FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Onboarding, Benchmarking, Data Sovereignty & Portale ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.onboarding_step') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.onboarding_step') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER onboarding_step_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON onboarding_step FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.template_pack') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.template_pack') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER template_pack_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON template_pack FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.template_pack_item') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.template_pack_item') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER template_pack_item_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON template_pack_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.benchmark_pool') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.benchmark_pool') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER benchmark_pool_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON benchmark_pool FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.data_region') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.data_region') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER data_region_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON data_region FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.portal_audit_trail') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.portal_audit_trail') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER portal_audit_trail_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON portal_audit_trail FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── Programme Cockpit (programme) ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.programme_journey_event') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.programme_journey_event') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER programme_journey_event_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON programme_journey_event FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.programme_template_subtask') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.programme_template_subtask') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER programme_template_subtask_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON programme_template_subtask FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── DMS (document + Legacy) ──────────────────────────────────────────────────
-- acknowledgment und document_entity_link sind seit dem DMS-Overhaul
-- (0353–0356) nicht mehr im Drizzle-Schema, existieren aber in der
-- Migrationskette (angelegt in 0011) und damit in Bestands-DBs weiter.
-- Der to_regclass-Guard überspringt sie, falls eine künftige Migration
-- sie droppt.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0357] audit_trigger() fehlt — Block übersprungen'; RETURN; END IF;
  IF to_regclass('public.document_version') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.document_version') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER document_version_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON document_version FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.acknowledgment') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.acknowledgment') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER acknowledgment_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON acknowledgment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.document_entity_link') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.document_entity_link') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER document_entity_link_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON document_entity_link FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
