-- Migration 0093: Close all remaining RLS gaps
-- 30 tables with org_id but no RLS + 5 tables with RLS enabled but no policy
-- Security-critical: prevents cross-org data leakage

-- ============================================================
-- Part 1: Tables with org_id that need RLS enabled + policy
-- ============================================================

-- attestation_campaign
ALTER TABLE attestation_campaign ENABLE ROW LEVEL SECURITY;
CREATE POLICY attestation_campaign_org_isolation ON attestation_campaign
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- audit_sample
ALTER TABLE audit_sample ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_sample_org_isolation ON audit_sample
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- board_report
ALTER TABLE board_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_report_org_isolation ON board_report
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- checklist_instance
ALTER TABLE checklist_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_instance_org_isolation ON checklist_instance
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- checklist_template
ALTER TABLE checklist_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_template_org_isolation ON checklist_template
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- connector_instance
ALTER TABLE connector_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_instance_org_isolation ON connector_instance
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- connector_sync_log
ALTER TABLE connector_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_sync_log_org_isolation ON connector_sync_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- consolidation_entry
ALTER TABLE consolidation_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY consolidation_entry_org_isolation ON consolidation_entry
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- consolidation_group
ALTER TABLE consolidation_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY consolidation_group_org_isolation ON consolidation_group
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- content_placeholder
ALTER TABLE content_placeholder ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_placeholder_org_isolation ON content_placeholder
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- content_request
ALTER TABLE content_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_request_org_isolation ON content_request
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- control_monitoring_result
ALTER TABLE control_monitoring_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_monitoring_result_org_isolation ON control_monitoring_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- control_monitoring_rule
ALTER TABLE control_monitoring_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_monitoring_rule_org_isolation ON control_monitoring_rule
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- data_lineage_entry
ALTER TABLE data_lineage_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_lineage_entry_org_isolation ON data_lineage_entry
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- data_lineage_source
ALTER TABLE data_lineage_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_lineage_source_org_isolation ON data_lineage_source
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- data_link
ALTER TABLE data_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_link_org_isolation ON data_link
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- data_validation_result
ALTER TABLE data_validation_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_validation_result_org_isolation ON data_validation_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- data_validation_rule
ALTER TABLE data_validation_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_validation_rule_org_isolation ON data_validation_rule
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- esef_filing
ALTER TABLE esef_filing ENABLE ROW LEVEL SECURITY;
CREATE POLICY esef_filing_org_isolation ON esef_filing
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- evidence_request
ALTER TABLE evidence_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_request_org_isolation ON evidence_request
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- grc_report_template
ALTER TABLE grc_report_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY grc_report_template_org_isolation ON grc_report_template
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- inline_comment
ALTER TABLE inline_comment ENABLE ROW LEVEL SECURITY;
CREATE POLICY inline_comment_org_isolation ON inline_comment
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- messaging_integration
ALTER TABLE messaging_integration ENABLE ROW LEVEL SECURITY;
CREATE POLICY messaging_integration_org_isolation ON messaging_integration
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- narrative_instance
ALTER TABLE narrative_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY narrative_instance_org_isolation ON narrative_instance
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- narrative_template
ALTER TABLE narrative_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY narrative_template_org_isolation ON narrative_template
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- reminder_rule
ALTER TABLE reminder_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_rule_org_isolation ON reminder_rule
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- review_cycle
ALTER TABLE review_cycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_cycle_org_isolation ON review_cycle
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- sox_scoping
ALTER TABLE sox_scoping ENABLE ROW LEVEL SECURITY;
CREATE POLICY sox_scoping_org_isolation ON sox_scoping
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- tag_definition
ALTER TABLE tag_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY tag_definition_org_isolation ON tag_definition
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- xbrl_tagging_instance
ALTER TABLE xbrl_tagging_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY xbrl_tagging_instance_org_isolation ON xbrl_tagging_instance
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================
-- Part 2: Tables with RLS enabled but MISSING policy (deny-all!)
-- ============================================================

-- notification_preference
CREATE POLICY notification_preference_org_isolation ON notification_preference
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- rcsa_assignment
CREATE POLICY rcsa_assignment_org_isolation ON rcsa_assignment
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- rcsa_campaign
CREATE POLICY rcsa_campaign_org_isolation ON rcsa_campaign
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- rcsa_response
CREATE POLICY rcsa_response_org_isolation ON rcsa_response
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- rcsa_result
CREATE POLICY rcsa_result_org_isolation ON rcsa_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
