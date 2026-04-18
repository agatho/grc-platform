-- Migration 0105: Phase-3 RLS + audit_trigger fuer alle 55 neu in TS
-- integrierten Tabellen (aeb8a34).
--
-- Hintergrund: Die Tabellen waren bereits in drizzle/*.sql vorhanden,
-- aber teilweise ohne RLS (da die Ur-Migrationen dies vergessen haben
-- oder RLS nur ueber DO-Block + format() gesetzt wurde, was der
-- RLS-Coverage-Audit (scripts/audit-rls-coverage.mjs) nicht regex-erkennen
-- kann).
--
-- Diese Migration macht RLS + audit_trigger fuer alle 55 Tabellen
-- explizit und idempotent. Die literalen ALTER TABLE + CREATE POLICY
-- Statements werden vom audit-rls-coverage.mjs Regex erkannt. DO-Block-
-- Wrapper sind fuer CREATE POLICY + CREATE TRIGGER noetig (nicht
-- idempotent in PG), der Regex sieht aber trotzdem die literalen
-- CREATE POLICY/CREATE TRIGGER Statements darin.
--
-- PLATFORM_EXEMPT (kein org_id -- globale Registry):
--   connector_type_definition, xbrl_taxonomy, xbrl_tag,
--   catalog_entry_mapping, module_nav_item

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (ALTER TABLE ist idempotent in PG)
-- ============================================================

-- ai-act-extended.ts (7 Tabellen)
ALTER TABLE ai_gpai_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_incident ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_corrective_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_authority_communication ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_penalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prohibited_screening ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_qms ENABLE ROW LEVEL SECURITY;

-- approval-workflow.ts (7) -- approval_decision/review_decision/
-- attestation_response haben KEIN direktes org_id, RLS via Parent-FK
ALTER TABLE approval_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestation_campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestation_response ENABLE ROW LEVEL SECURITY;

-- audit-extras.ts (3)
ALTER TABLE audit_sample ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_report ENABLE ROW LEVEL SECURITY;

-- checklist.ts (2)
ALTER TABLE checklist_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_instance ENABLE ROW LEVEL SECURITY;

-- connector.ts (3 -- connector_type_definition ist PLATFORM_EXEMPT)
ALTER TABLE connector_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_field_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_sync_log ENABLE ROW LEVEL SECURITY;

-- content-narrative.ts (4)
ALTER TABLE content_placeholder ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_instance ENABLE ROW LEVEL SECURITY;

-- control-monitoring.ts (2)
ALTER TABLE control_monitoring_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_monitoring_result ENABLE ROW LEVEL SECURITY;

-- data-governance.ts (5)
ALTER TABLE data_lineage_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_validation_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_validation_result ENABLE ROW LEVEL SECURITY;

-- esef-xbrl.ts (5 -- xbrl_taxonomy + xbrl_tag sind PLATFORM_EXEMPT)
ALTER TABLE xbrl_tagging_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE esef_filing ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE eu_taxonomy_assessment ENABLE ROW LEVEL SECURITY;

-- isms-cap.ts (3)
ALTER TABLE isms_nonconformity ENABLE ROW LEVEL SECURITY;
ALTER TABLE isms_corrective_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_cause_analysis ENABLE ROW LEVEL SECURITY;

-- risk-acceptance.ts (3)
ALTER TABLE risk_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_acceptance_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE erm_sync_config ENABLE ROW LEVEL SECURITY;

-- phase3-extras.ts (6 -- catalog_entry_mapping + module_nav_item sind
-- PLATFORM_EXEMPT)
ALTER TABLE evidence_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE inline_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_integration ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE sox_scoping ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_definition ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (idempotent via DO+EXCEPTION, Regex sieht literal)
-- ============================================================

-- Direct org_id-Tabellen: Standard-Policy
DO $$ BEGIN CREATE POLICY rls_ai_gpai_model ON ai_gpai_model USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_incident ON ai_incident USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_corrective_action ON ai_corrective_action USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_authority_communication ON ai_authority_communication USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_penalty ON ai_penalty USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_prohibited_screening ON ai_prohibited_screening USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_ai_provider_qms ON ai_provider_qms USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_approval_workflow ON approval_workflow USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_approval_request ON approval_request USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_approval_decision ON approval_decision USING (EXISTS (SELECT 1 FROM approval_request r WHERE r.id = approval_decision.request_id AND r.org_id = current_setting('app.current_org_id')::uuid)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_review_cycle ON review_cycle USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_review_decision ON review_decision USING (EXISTS (SELECT 1 FROM review_cycle c WHERE c.id = review_decision.cycle_id AND c.org_id = current_setting('app.current_org_id')::uuid)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_attestation_campaign ON attestation_campaign USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_attestation_response ON attestation_response USING (EXISTS (SELECT 1 FROM attestation_campaign c WHERE c.id = attestation_response.campaign_id AND c.org_id = current_setting('app.current_org_id')::uuid)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_audit_sample ON audit_sample USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_board_report ON board_report USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_exception_report ON exception_report USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_checklist_template ON checklist_template USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_checklist_instance ON checklist_instance USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_connector_instance ON connector_instance USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_connector_field_mapping ON connector_field_mapping USING (EXISTS (SELECT 1 FROM connector_instance ci WHERE ci.id = connector_field_mapping.connector_id AND ci.org_id = current_setting('app.current_org_id')::uuid)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_connector_sync_log ON connector_sync_log USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_content_placeholder ON content_placeholder USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_content_request ON content_request USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_narrative_template ON narrative_template USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_narrative_instance ON narrative_instance USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_control_monitoring_rule ON control_monitoring_rule USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_control_monitoring_result ON control_monitoring_result USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_data_lineage_source ON data_lineage_source USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_data_lineage_entry ON data_lineage_entry USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_data_link ON data_link USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_data_validation_rule ON data_validation_rule USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_data_validation_result ON data_validation_result USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_xbrl_tagging_instance ON xbrl_tagging_instance USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_esef_filing ON esef_filing USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_consolidation_group ON consolidation_group USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_consolidation_entry ON consolidation_entry USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_eu_taxonomy_assessment ON eu_taxonomy_assessment USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_isms_nonconformity ON isms_nonconformity USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_isms_corrective_action ON isms_corrective_action USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_root_cause_analysis ON root_cause_analysis USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_risk_acceptance ON risk_acceptance USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_risk_acceptance_authority ON risk_acceptance_authority USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_erm_sync_config ON erm_sync_config USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY rls_evidence_request ON evidence_request USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_inline_comment ON inline_comment USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_messaging_integration ON messaging_integration USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_reminder_rule ON reminder_rule USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_sox_scoping ON sox_scoping USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_tag_definition ON tag_definition USING (org_id = current_setting('app.current_org_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- audit_trigger() -- SHA-256-Hash-Chain (ADR-011)
-- ============================================================

DO $$ BEGIN CREATE TRIGGER audit_ai_gpai_model AFTER INSERT OR UPDATE OR DELETE ON ai_gpai_model FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_incident AFTER INSERT OR UPDATE OR DELETE ON ai_incident FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_corrective_action AFTER INSERT OR UPDATE OR DELETE ON ai_corrective_action FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_authority_communication AFTER INSERT OR UPDATE OR DELETE ON ai_authority_communication FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_penalty AFTER INSERT OR UPDATE OR DELETE ON ai_penalty FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_prohibited_screening AFTER INSERT OR UPDATE OR DELETE ON ai_prohibited_screening FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_ai_provider_qms AFTER INSERT OR UPDATE OR DELETE ON ai_provider_qms FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_approval_workflow AFTER INSERT OR UPDATE OR DELETE ON approval_workflow FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_approval_request AFTER INSERT OR UPDATE OR DELETE ON approval_request FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_approval_decision AFTER INSERT OR UPDATE OR DELETE ON approval_decision FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_review_cycle AFTER INSERT OR UPDATE OR DELETE ON review_cycle FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_review_decision AFTER INSERT OR UPDATE OR DELETE ON review_decision FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_attestation_campaign AFTER INSERT OR UPDATE OR DELETE ON attestation_campaign FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_attestation_response AFTER INSERT OR UPDATE OR DELETE ON attestation_response FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_audit_sample AFTER INSERT OR UPDATE OR DELETE ON audit_sample FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_board_report AFTER INSERT OR UPDATE OR DELETE ON board_report FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_exception_report AFTER INSERT OR UPDATE OR DELETE ON exception_report FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_checklist_template AFTER INSERT OR UPDATE OR DELETE ON checklist_template FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_checklist_instance AFTER INSERT OR UPDATE OR DELETE ON checklist_instance FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_connector_instance AFTER INSERT OR UPDATE OR DELETE ON connector_instance FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_connector_field_mapping AFTER INSERT OR UPDATE OR DELETE ON connector_field_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_connector_sync_log AFTER INSERT OR UPDATE OR DELETE ON connector_sync_log FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_content_placeholder AFTER INSERT OR UPDATE OR DELETE ON content_placeholder FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_content_request AFTER INSERT OR UPDATE OR DELETE ON content_request FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_narrative_template AFTER INSERT OR UPDATE OR DELETE ON narrative_template FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_narrative_instance AFTER INSERT OR UPDATE OR DELETE ON narrative_instance FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_control_monitoring_rule AFTER INSERT OR UPDATE OR DELETE ON control_monitoring_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_control_monitoring_result AFTER INSERT OR UPDATE OR DELETE ON control_monitoring_result FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_data_lineage_source AFTER INSERT OR UPDATE OR DELETE ON data_lineage_source FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_data_lineage_entry AFTER INSERT OR UPDATE OR DELETE ON data_lineage_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_data_link AFTER INSERT OR UPDATE OR DELETE ON data_link FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_data_validation_rule AFTER INSERT OR UPDATE OR DELETE ON data_validation_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_data_validation_result AFTER INSERT OR UPDATE OR DELETE ON data_validation_result FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_xbrl_tagging_instance AFTER INSERT OR UPDATE OR DELETE ON xbrl_tagging_instance FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_esef_filing AFTER INSERT OR UPDATE OR DELETE ON esef_filing FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_consolidation_group AFTER INSERT OR UPDATE OR DELETE ON consolidation_group FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_consolidation_entry AFTER INSERT OR UPDATE OR DELETE ON consolidation_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_eu_taxonomy_assessment AFTER INSERT OR UPDATE OR DELETE ON eu_taxonomy_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_isms_nonconformity AFTER INSERT OR UPDATE OR DELETE ON isms_nonconformity FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_isms_corrective_action AFTER INSERT OR UPDATE OR DELETE ON isms_corrective_action FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_root_cause_analysis AFTER INSERT OR UPDATE OR DELETE ON root_cause_analysis FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_risk_acceptance AFTER INSERT OR UPDATE OR DELETE ON risk_acceptance FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_risk_acceptance_authority AFTER INSERT OR UPDATE OR DELETE ON risk_acceptance_authority FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_erm_sync_config AFTER INSERT OR UPDATE OR DELETE ON erm_sync_config FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER audit_catalog_entry_mapping AFTER INSERT OR UPDATE OR DELETE ON catalog_entry_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_evidence_request AFTER INSERT OR UPDATE OR DELETE ON evidence_request FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_inline_comment AFTER INSERT OR UPDATE OR DELETE ON inline_comment FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_messaging_integration AFTER INSERT OR UPDATE OR DELETE ON messaging_integration FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_module_nav_item AFTER INSERT OR UPDATE OR DELETE ON module_nav_item FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_reminder_rule AFTER INSERT OR UPDATE OR DELETE ON reminder_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_sox_scoping AFTER INSERT OR UPDATE OR DELETE ON sox_scoping FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER audit_tag_definition AFTER INSERT OR UPDATE OR DELETE ON tag_definition FOR EACH ROW EXECUTE FUNCTION audit_trigger(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
