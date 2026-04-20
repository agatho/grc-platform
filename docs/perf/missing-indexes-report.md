# Missing-Indexes-Report

_Generated: 2026-04-18T00:36:30.087Z_

Statische DDL-Analyse identifiziert Spalten, die wahrscheinlich einen Index brauchen. Heuristik, kein Query-Plan: bitte mit EXPLAIN/ANALYZE auf Live-DB validieren, bevor Index erstellt wird.

**545 Tabellen analysiert, 1738 Index-Kandidaten.**

## Prioritaeten-Hinweis

| Reason            | Was                              | Priorisierung                                 |
| ----------------- | -------------------------------- | --------------------------------------------- |
| RLS-Filter        | `org_id` Index fehlt             | **HIGH** -- RLS-Policy prueft pro Row         |
| FK                | FK-Spalte ohne Index             | **HIGH** -- JOIN-Performance + Delete-Cascade |
| ID-Suffix         | `xxx_id` ohne FK aber ohne Index | Medium -- oft Filter                          |
| Timestamp-Sort    | `created_at/updated_at`          | Medium -- ORDER BY                            |
| Status-Filter     | `status/state`                   | Low -- geringe Cardinality                    |
| Audit-User-Filter | `created_by/updated_by`          | Low                                           |

## Audit-User-Filter (205)

```sql
CREATE INDEX IF NOT EXISTS idx_notification_created_by ON notification(created_by);
CREATE INDEX IF NOT EXISTS idx_notification_updated_by ON notification(updated_by);
CREATE INDEX IF NOT EXISTS idx_notification_deleted_by ON notification(deleted_by);
CREATE INDEX IF NOT EXISTS idx_organization_created_by ON organization(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_updated_by ON organization(updated_by);
CREATE INDEX IF NOT EXISTS idx_organization_deleted_by ON organization(deleted_by);
CREATE INDEX IF NOT EXISTS idx_user_created_by ON user(created_by);
CREATE INDEX IF NOT EXISTS idx_user_updated_by ON user(updated_by);
CREATE INDEX IF NOT EXISTS idx_user_deleted_by ON user(deleted_by);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_created_by ON user_organization_role(created_by);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_updated_by ON user_organization_role(updated_by);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_deleted_by ON user_organization_role(deleted_by);
CREATE INDEX IF NOT EXISTS idx_invitation_invited_by ON invitation(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitation_created_by ON invitation(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_updated_by ON invitation(updated_by);
CREATE INDEX IF NOT EXISTS idx_invitation_deleted_by ON invitation(deleted_by);
CREATE INDEX IF NOT EXISTS idx_task_completed_by ON task(completed_by);
CREATE INDEX IF NOT EXISTS idx_task_created_by ON task(created_by);
CREATE INDEX IF NOT EXISTS idx_task_updated_by ON task(updated_by);
CREATE INDEX IF NOT EXISTS idx_task_deleted_by ON task(deleted_by);
CREATE INDEX IF NOT EXISTS idx_task_comment_created_by ON task_comment(created_by);
CREATE INDEX IF NOT EXISTS idx_module_config_enabled_by ON module_config(enabled_by);
CREATE INDEX IF NOT EXISTS idx_module_config_disabled_by ON module_config(disabled_by);
CREATE INDEX IF NOT EXISTS idx_module_config_created_by ON module_config(created_by);
CREATE INDEX IF NOT EXISTS idx_module_config_updated_by ON module_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_asset_created_by ON asset(created_by);
CREATE INDEX IF NOT EXISTS idx_asset_updated_by ON asset(updated_by);
CREATE INDEX IF NOT EXISTS idx_asset_deleted_by ON asset(deleted_by);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_created_by ON asset_cia_profile(created_by);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_updated_by ON asset_cia_profile(updated_by);
CREATE INDEX IF NOT EXISTS idx_work_item_completed_by ON work_item(completed_by);
CREATE INDEX IF NOT EXISTS idx_work_item_created_by ON work_item(created_by);
CREATE INDEX IF NOT EXISTS idx_work_item_updated_by ON work_item(updated_by);
CREATE INDEX IF NOT EXISTS idx_work_item_deleted_by ON work_item(deleted_by);
CREATE INDEX IF NOT EXISTS idx_work_item_link_created_by ON work_item_link(created_by);
CREATE INDEX IF NOT EXISTS idx_kri_created_by ON kri(created_by);
CREATE INDEX IF NOT EXISTS idx_kri_updated_by ON kri(updated_by);
CREATE INDEX IF NOT EXISTS idx_kri_deleted_by ON kri(deleted_by);
CREATE INDEX IF NOT EXISTS idx_kri_measurement_created_by ON kri_measurement(created_by);
CREATE INDEX IF NOT EXISTS idx_process_risk_created_by ON process_risk(created_by);
CREATE INDEX IF NOT EXISTS idx_process_step_risk_created_by ON process_step_risk(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_created_by ON risk(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_updated_by ON risk(updated_by);
CREATE INDEX IF NOT EXISTS idx_risk_deleted_by ON risk(deleted_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_created_by ON risk_appetite(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_updated_by ON risk_appetite(updated_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_deleted_by ON risk_appetite(deleted_by);
CREATE INDEX IF NOT EXISTS idx_risk_asset_created_by ON risk_asset(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_control_created_by ON risk_control(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_framework_mapping_created_by ON risk_framework_mapping(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_created_by ON risk_treatment(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_updated_by ON risk_treatment(updated_by);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_deleted_by ON risk_treatment(deleted_by);
CREATE INDEX IF NOT EXISTS idx_process_created_by ON process(created_by);
CREATE INDEX IF NOT EXISTS idx_process_updated_by ON process(updated_by);
CREATE INDEX IF NOT EXISTS idx_process_deleted_by ON process(deleted_by);
CREATE INDEX IF NOT EXISTS idx_process_control_created_by ON process_control(created_by);
CREATE INDEX IF NOT EXISTS idx_process_step_control_created_by ON process_step_control(created_by);
CREATE INDEX IF NOT EXISTS idx_process_version_created_by ON process_version(created_by);
CREATE INDEX IF NOT EXISTS idx_process_asset_created_by ON process_asset(created_by);
CREATE INDEX IF NOT EXISTS idx_process_document_created_by ON process_document(created_by);
CREATE INDEX IF NOT EXISTS idx_process_step_asset_created_by ON process_step_asset(created_by);
CREATE INDEX IF NOT EXISTS idx_process_comment_resolved_by ON process_comment(resolved_by);
CREATE INDEX IF NOT EXISTS idx_process_comment_created_by ON process_comment(created_by);
CREATE INDEX IF NOT EXISTS idx_process_review_schedule_created_by ON process_review_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_control_created_by ON control(created_by);
CREATE INDEX IF NOT EXISTS idx_control_updated_by ON control(updated_by);
CREATE INDEX IF NOT EXISTS idx_control_deleted_by ON control(deleted_by);
CREATE INDEX IF NOT EXISTS idx_control_test_created_by ON control_test(created_by);
CREATE INDEX IF NOT EXISTS idx_control_test_updated_by ON control_test(updated_by);
CREATE INDEX IF NOT EXISTS idx_control_test_deleted_by ON control_test(deleted_by);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_created_by ON control_test_campaign(created_by);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_updated_by ON control_test_campaign(updated_by);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_deleted_by ON control_test_campaign(deleted_by);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_evidence_deleted_by ON evidence(deleted_by);
CREATE INDEX IF NOT EXISTS idx_finding_verified_by ON finding(verified_by);
CREATE INDEX IF NOT EXISTS idx_finding_created_by ON finding(created_by);
CREATE INDEX IF NOT EXISTS idx_finding_updated_by ON finding(updated_by);
CREATE INDEX IF NOT EXISTS idx_finding_deleted_by ON finding(deleted_by);
CREATE INDEX IF NOT EXISTS idx_document_created_by ON document(created_by);
CREATE INDEX IF NOT EXISTS idx_document_updated_by ON document(updated_by);
CREATE INDEX IF NOT EXISTS idx_document_deleted_by ON document(deleted_by);
CREATE INDEX IF NOT EXISTS idx_document_entity_link_created_by ON document_entity_link(created_by);
CREATE INDEX IF NOT EXISTS idx_document_version_created_by ON document_version(created_by);
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_created_by ON general_catalog_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_deleted_by ON general_catalog_entry(deleted_by);
CREATE INDEX IF NOT EXISTS idx_org_active_catalog_activated_by ON org_active_catalog(activated_by);
CREATE INDEX IF NOT EXISTS idx_org_catalog_exclusion_excluded_by ON org_catalog_exclusion(excluded_by);
CREATE INDEX IF NOT EXISTS idx_org_risk_methodology_updated_by ON org_risk_methodology(updated_by);
CREATE INDEX IF NOT EXISTS idx_asset_classification_classified_by ON asset_classification(classified_by);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_entry_added_by ON incident_timeline_entry(added_by);
CREATE INDEX IF NOT EXISTS idx_security_incident_reported_by ON security_incident(reported_by);
CREATE INDEX IF NOT EXISTS idx_security_incident_created_by ON security_incident(created_by);
CREATE INDEX IF NOT EXISTS idx_security_incident_updated_by ON security_incident(updated_by);
CREATE INDEX IF NOT EXISTS idx_threat_created_by ON threat(created_by);
CREATE INDEX IF NOT EXISTS idx_vulnerability_created_by ON vulnerability(created_by);
CREATE INDEX IF NOT EXISTS idx_assessment_control_eval_assessed_by ON assessment_control_eval(assessed_by);
CREATE INDEX IF NOT EXISTS idx_assessment_risk_eval_evaluated_by ON assessment_risk_eval(evaluated_by);
CREATE INDEX IF NOT EXISTS idx_assessment_run_created_by ON assessment_run(created_by);
CREATE INDEX IF NOT EXISTS idx_control_maturity_assessed_by ON control_maturity(assessed_by);
CREATE INDEX IF NOT EXISTS idx_management_review_created_by ON management_review(created_by);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_created_by ON bc_exercise(created_by);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_created_by ON bc_exercise_finding(created_by);
CREATE INDEX IF NOT EXISTS idx_bcp_approved_by ON bcp(approved_by);
CREATE INDEX IF NOT EXISTS idx_bcp_created_by ON bcp(created_by);
CREATE INDEX IF NOT EXISTS idx_bia_assessment_approved_by ON bia_assessment(approved_by);
CREATE INDEX IF NOT EXISTS idx_bia_assessment_created_by ON bia_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_bia_process_impact_assessed_by ON bia_process_impact(assessed_by);
CREATE INDEX IF NOT EXISTS idx_continuity_strategy_created_by ON continuity_strategy(created_by);
CREATE INDEX IF NOT EXISTS idx_crisis_log_created_by ON crisis_log(created_by);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_activated_by ON crisis_scenario(activated_by);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_created_by ON crisis_scenario(created_by);
CREATE INDEX IF NOT EXISTS idx_data_breach_created_by ON data_breach(created_by);
CREATE INDEX IF NOT EXISTS idx_dpia_created_by ON dpia(created_by);
CREATE INDEX IF NOT EXISTS idx_dsr_created_by ON dsr(created_by);
CREATE INDEX IF NOT EXISTS idx_dsr_activity_created_by ON dsr_activity(created_by);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_created_by ON ropa_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_tia_created_by ON tia(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_by ON audit(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_activity_performed_by ON audit_activity(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_checklist_created_by ON audit_checklist(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_checklist_item_completed_by ON audit_checklist_item(completed_by);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_created_by ON audit_evidence(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_plan_approved_by ON audit_plan(approved_by);
CREATE INDEX IF NOT EXISTS idx_audit_plan_created_by ON audit_plan(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_universe_entry_created_by ON audit_universe_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_contract_signed_by ON contract(signed_by);
CREATE INDEX IF NOT EXISTS idx_contract_created_by ON contract(created_by);
CREATE INDEX IF NOT EXISTS idx_contract_updated_by ON contract(updated_by);
CREATE INDEX IF NOT EXISTS idx_contract_deleted_by ON contract(deleted_by);
CREATE INDEX IF NOT EXISTS idx_contract_amendment_created_by ON contract_amendment(created_by);
CREATE INDEX IF NOT EXISTS idx_contract_sla_measurement_measured_by ON contract_sla_measurement(measured_by);
CREATE INDEX IF NOT EXISTS idx_lksg_assessment_assessed_by ON lksg_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_lksg_assessment_reviewed_by ON lksg_assessment(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_vendor_created_by ON vendor(created_by);
CREATE INDEX IF NOT EXISTS idx_vendor_updated_by ON vendor(updated_by);
CREATE INDEX IF NOT EXISTS idx_vendor_deleted_by ON vendor(deleted_by);
CREATE INDEX IF NOT EXISTS idx_vendor_due_diligence_reviewed_by ON vendor_due_diligence(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_vendor_risk_assessment_assessed_by ON vendor_risk_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_dd_session_created_by ON dd_session(created_by);
CREATE INDEX IF NOT EXISTS idx_questionnaire_template_created_by ON questionnaire_template(created_by);
CREATE INDEX IF NOT EXISTS idx_esg_annual_report_approved_by ON esg_annual_report(approved_by);
CREATE INDEX IF NOT EXISTS idx_esg_materiality_assessment_created_by ON esg_materiality_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_esg_measurement_verified_by ON esg_measurement(verified_by);
CREATE INDEX IF NOT EXISTS idx_wb_case_created_by ON wb_case(created_by);
CREATE INDEX IF NOT EXISTS idx_wb_case_evidence_uploaded_by ON wb_case_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_grc_budget_approved_by ON grc_budget(approved_by);
CREATE INDEX IF NOT EXISTS idx_grc_budget_created_by ON grc_budget(created_by);
CREATE INDEX IF NOT EXISTS idx_grc_cost_entry_created_by ON grc_cost_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_org_branding_updated_by ON org_branding(updated_by);
CREATE INDEX IF NOT EXISTS idx_compliance_calendar_event_updated_by ON compliance_calendar_event(updated_by);
CREATE INDEX IF NOT EXISTS idx_compliance_calendar_event_deleted_by ON compliance_calendar_event(deleted_by);
CREATE INDEX IF NOT EXISTS idx_sso_config_created_by ON sso_config(created_by);
CREATE INDEX IF NOT EXISTS idx_sso_config_updated_by ON sso_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_sso_config_deleted_by ON sso_config(deleted_by);
CREATE INDEX IF NOT EXISTS idx_translation_status_created_by ON translation_status(created_by);
CREATE INDEX IF NOT EXISTS idx_translation_status_updated_by ON translation_status(updated_by);
CREATE INDEX IF NOT EXISTS idx_translation_status_deleted_by ON translation_status(deleted_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_threshold_updated_by ON risk_appetite_threshold(updated_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_threshold_deleted_by ON risk_appetite_threshold(deleted_by);
CREATE INDEX IF NOT EXISTS idx_cci_configuration_updated_by ON cci_configuration(updated_by);
CREATE INDEX IF NOT EXISTS idx_report_template_created_by ON report_template(created_by);
CREATE INDEX IF NOT EXISTS idx_wb_evidence_superseded_by ON wb_evidence(superseded_by);
CREATE INDEX IF NOT EXISTS idx_tag_definition_created_by ON tag_definition(created_by);
CREATE INDEX IF NOT EXISTS idx_data_lineage_source_created_by ON data_lineage_source(created_by);
CREATE INDEX IF NOT EXISTS idx_data_lineage_entry_verified_by ON data_lineage_entry(verified_by);
CREATE INDEX IF NOT EXISTS idx_data_lineage_entry_created_by ON data_lineage_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_eu_taxonomy_assessment_assessed_by ON eu_taxonomy_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_eu_taxonomy_assessment_created_by ON eu_taxonomy_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_root_cause_analysis_created_by ON root_cause_analysis(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_sample_sampled_by ON audit_sample(sampled_by);
CREATE INDEX IF NOT EXISTS idx_audit_sample_reviewed_by ON audit_sample(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_audit_sample_created_by ON audit_sample(created_by);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_created_by ON approval_workflow(created_by);
CREATE INDEX IF NOT EXISTS idx_approval_request_requested_by ON approval_request(requested_by);
CREATE INDEX IF NOT EXISTS idx_exception_report_resolved_by ON exception_report(resolved_by);
CREATE INDEX IF NOT EXISTS idx_exception_report_created_by ON exception_report(created_by);
CREATE INDEX IF NOT EXISTS idx_control_monitoring_rule_created_by ON control_monitoring_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_attestation_campaign_created_by ON attestation_campaign(created_by);
CREATE INDEX IF NOT EXISTS idx_sox_scoping_approved_by ON sox_scoping(approved_by);
CREATE INDEX IF NOT EXISTS idx_sox_scoping_created_by ON sox_scoping(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_template_created_by ON checklist_template(created_by);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_created_by ON checklist_instance(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_request_requested_by ON evidence_request(requested_by);
CREATE INDEX IF NOT EXISTS idx_data_link_created_by ON data_link(created_by);
CREATE INDEX IF NOT EXISTS idx_data_validation_rule_created_by ON data_validation_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_content_placeholder_created_by ON content_placeholder(created_by);
CREATE INDEX IF NOT EXISTS idx_narrative_template_created_by ON narrative_template(created_by);
CREATE INDEX IF NOT EXISTS idx_narrative_instance_created_by ON narrative_instance(created_by);
CREATE INDEX IF NOT EXISTS idx_inline_comment_resolved_by ON inline_comment(resolved_by);
CREATE INDEX IF NOT EXISTS idx_inline_comment_created_by ON inline_comment(created_by);
CREATE INDEX IF NOT EXISTS idx_review_cycle_created_by ON review_cycle(created_by);
CREATE INDEX IF NOT EXISTS idx_content_request_requested_by ON content_request(requested_by);
CREATE INDEX IF NOT EXISTS idx_reminder_rule_created_by ON reminder_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_messaging_integration_created_by ON messaging_integration(created_by);
CREATE INDEX IF NOT EXISTS idx_connector_instance_created_by ON connector_instance(created_by);
CREATE INDEX IF NOT EXISTS idx_xbrl_tagging_instance_tagged_by ON xbrl_tagging_instance(tagged_by);
CREATE INDEX IF NOT EXISTS idx_consolidation_group_created_by ON consolidation_group(created_by);
CREATE INDEX IF NOT EXISTS idx_consolidation_entry_created_by ON consolidation_entry(created_by);
-- ... 5 more
```

## FK -> academy_course (1)

```sql
CREATE INDEX IF NOT EXISTS idx_academy_certificate_course_id ON academy_certificate(course_id);
```

## FK -> academy_lesson (1)

```sql
CREATE INDEX IF NOT EXISTS idx_academy_quiz_attempt_lesson_id ON academy_quiz_attempt(lesson_id);
```

## FK -> ai_corrective_action (2)

```sql
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_related_action_id ON ai_authority_communication(related_action_id);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_related_action_id ON ai_authority_communication(related_action_id);
```

## FK -> ai_gpai_model (2)

```sql
CREATE INDEX IF NOT EXISTS idx_ai_incident_gpai_model_id ON ai_incident(gpai_model_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_gpai_model_id ON ai_incident(gpai_model_id);
```

## FK -> ai_incident (2)

```sql
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_related_incident_id ON ai_authority_communication(related_incident_id);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_related_incident_id ON ai_authority_communication(related_incident_id);
```

## FK -> ai_system (8)

```sql
CREATE INDEX IF NOT EXISTS idx_ai_prohibited_screening_ai_system_id ON ai_prohibited_screening(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_prohibited_screening_ai_system_id ON ai_prohibited_screening(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_qms_ai_system_id ON ai_provider_qms(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_qms_ai_system_id ON ai_provider_qms(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_ai_system_id ON ai_authority_communication(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_ai_system_id ON ai_authority_communication(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_penalty_ai_system_id ON ai_penalty(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_penalty_ai_system_id ON ai_penalty(ai_system_id);
```

## FK -> api_scope (1)

```sql
CREATE INDEX IF NOT EXISTS idx_api_key_scope_scope_id ON api_key_scope(scope_id);
```

## FK -> approval_workflow (1)

```sql
CREATE INDEX IF NOT EXISTS idx_approval_request_workflow_id ON approval_request(workflow_id);
```

## FK -> asset (3)

```sql
CREATE INDEX IF NOT EXISTS idx_cve_asset_match_asset_id ON cve_asset_match(asset_id);
CREATE INDEX IF NOT EXISTS idx_attack_path_result_entry_asset_id ON attack_path_result(entry_asset_id);
CREATE INDEX IF NOT EXISTS idx_attack_path_result_target_asset_id ON attack_path_result(target_asset_id);
```

## FK -> audit_analytics_import (1)

```sql
CREATE INDEX IF NOT EXISTS idx_audit_analytics_result_import_id ON audit_analytics_result(import_id);
```

## FK -> audit_wp_review_note (1)

```sql
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_reply_review_note_id ON audit_wp_review_note_reply(review_note_id);
```

## FK -> bc_exercise (1)

```sql
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_last_validated_exercise_id ON recovery_procedure(last_validated_exercise_id);
```

## FK -> bc_exercise_scenario (1)

```sql
CREATE INDEX IF NOT EXISTS idx_bc_exercise_scenario_id ON bc_exercise(scenario_id);
```

## FK -> bowtie_element (2)

```sql
CREATE INDEX IF NOT EXISTS idx_bowtie_path_source_element_id ON bowtie_path(source_element_id);
CREATE INDEX IF NOT EXISTS idx_bowtie_path_target_element_id ON bowtie_path(target_element_id);
```

## FK -> checklist_template (1)

```sql
CREATE INDEX IF NOT EXISTS idx_checklist_instance_template_id ON checklist_instance(template_id);
```

## FK -> control (2)

```sql
CREATE INDEX IF NOT EXISTS idx_soa_ai_suggestion_suggested_control_id ON soa_ai_suggestion(suggested_control_id);
CREATE INDEX IF NOT EXISTS idx_bowtie_element_control_id ON bowtie_element(control_id);
```

## FK -> copilot_message (1)

```sql
CREATE INDEX IF NOT EXISTS idx_copilot_suggested_action_message_id ON copilot_suggested_action(message_id);
```

## FK -> crisis_contact_node (2)

```sql
CREATE INDEX IF NOT EXISTS idx_crisis_communication_log_node_id ON crisis_communication_log(node_id);
CREATE INDEX IF NOT EXISTS idx_crisis_communication_log_escalated_to_node_id ON crisis_communication_log(escalated_to_node_id);
```

## FK -> crisis_contact_tree (1)

```sql
CREATE INDEX IF NOT EXISTS idx_crisis_communication_log_tree_id ON crisis_communication_log(tree_id);
```

## FK -> data_region (1)

```sql
CREATE INDEX IF NOT EXISTS idx_region_tenant_config_backup_region_id ON region_tenant_config(backup_region_id);
```

## FK -> device_registration (1)

```sql
CREATE INDEX IF NOT EXISTS idx_push_notification_device_id ON push_notification(device_id);
```

## FK -> dora_ict_incident (1)

```sql
CREATE INDEX IF NOT EXISTS idx_dora_information_sharing_source_incident_id ON dora_information_sharing(source_incident_id);
```

## FK -> eam_context (1)

```sql
CREATE INDEX IF NOT EXISTS idx_eam_context_predecessor_context_id ON eam_context(predecessor_context_id);
```

## FK -> fair_parameters (1)

```sql
CREATE INDEX IF NOT EXISTS idx_fair_simulation_result_parameters_id ON fair_simulation_result(parameters_id);
```

## FK -> inline_comment (1)

```sql
CREATE INDEX IF NOT EXISTS idx_inline_comment_parent_id ON inline_comment(parent_id);
```

## FK -> marketplace_version (1)

```sql
CREATE INDEX IF NOT EXISTS idx_marketplace_installation_version_id ON marketplace_installation(version_id);
```

## FK -> narrative_template (1)

```sql
CREATE INDEX IF NOT EXISTS idx_narrative_instance_template_id ON narrative_instance(template_id);
```

## FK -> organization (9)

```sql
CREATE INDEX IF NOT EXISTS idx_rcsa_assignment_org_id ON rcsa_assignment(org_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_response_org_id ON rcsa_response(org_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_result_org_id ON rcsa_result(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_wp_folder_org_id ON audit_wp_folder(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_org_id ON audit_working_paper(org_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_share_org_id ON external_auditor_share(org_id);
CREATE INDEX IF NOT EXISTS idx_eam_object_suggestion_org_id ON eam_object_suggestion(org_id);
CREATE INDEX IF NOT EXISTS idx_user_nav_preference_org_id ON user_nav_preference(org_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_role_org_id ON user_custom_role(org_id);
```

## FK -> playbook_phase (1)

```sql
CREATE INDEX IF NOT EXISTS idx_playbook_activation_current_phase_id ON playbook_activation(current_phase_id);
```

## FK -> plugin (1)

```sql
CREATE INDEX IF NOT EXISTS idx_plugin_installation_plugin_id ON plugin_installation(plugin_id);
```

## FK -> portal_config (1)

```sql
CREATE INDEX IF NOT EXISTS idx_portal_session_portal_config_id ON portal_session(portal_config_id);
```

## FK -> process (1)

```sql
CREATE INDEX IF NOT EXISTS idx_architecture_element_process_id ON architecture_element(process_id);
```

## FK -> report_template (4)

```sql
CREATE INDEX IF NOT EXISTS idx_report_schedule_template_id ON report_schedule(template_id);
CREATE INDEX IF NOT EXISTS idx_report_schedule_template_id ON report_schedule(template_id);
CREATE INDEX IF NOT EXISTS idx_report_schedule_template_id ON report_schedule(template_id);
CREATE INDEX IF NOT EXISTS idx_report_schedule_template_id ON report_schedule(template_id);
```

## FK -> risk (2)

```sql
CREATE INDEX IF NOT EXISTS idx_risk_interconnection_target_risk_id ON risk_interconnection(target_risk_id);
CREATE INDEX IF NOT EXISTS idx_emerging_risk_promoted_to_risk_id ON emerging_risk(promoted_to_risk_id);
```

## FK -> risk_prediction (1)

```sql
CREATE INDEX IF NOT EXISTS idx_risk_prediction_alert_prediction_id ON risk_prediction_alert(prediction_id);
```

## FK -> role_dashboard_config (1)

```sql
CREATE INDEX IF NOT EXISTS idx_role_dashboard_widget_preference_dashboard_config_id ON role_dashboard_widget_preference(dashboard_config_id);
```

## FK -> scim_token (1)

```sql
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_token_id ON scim_sync_log(token_id);
```

## FK -> task (1)

```sql
CREATE INDEX IF NOT EXISTS idx_bc_exercise_lesson_task_id ON bc_exercise_lesson(task_id);
```

## FK -> template_pack (1)

```sql
CREATE INDEX IF NOT EXISTS idx_import_job_template_pack_id ON import_job(template_pack_id);
```

## FK -> user (248)

```sql
CREATE INDEX IF NOT EXISTS idx_bc_exercise_facilitator_id ON bc_exercise(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_created_by ON bc_exercise(created_by);
CREATE INDEX IF NOT EXISTS idx_rcsa_campaign_created_by ON rcsa_campaign(created_by);
CREATE INDEX IF NOT EXISTS idx_policy_distribution_distributed_by ON policy_distribution(distributed_by);
CREATE INDEX IF NOT EXISTS idx_policy_distribution_created_by ON policy_distribution(created_by);
CREATE INDEX IF NOT EXISTS idx_playbook_template_created_by ON playbook_template(created_by);
CREATE INDEX IF NOT EXISTS idx_playbook_activation_activated_by ON playbook_activation(activated_by);
CREATE INDEX IF NOT EXISTS idx_compliance_calendar_event_created_by ON compliance_calendar_event(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_dashboard_created_by ON custom_dashboard(created_by);
CREATE INDEX IF NOT EXISTS idx_import_column_mapping_created_by ON import_column_mapping(created_by);
CREATE INDEX IF NOT EXISTS idx_export_schedule_created_by ON export_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_scim_token_created_by ON scim_token(created_by);
CREATE INDEX IF NOT EXISTS idx_scim_token_revoked_by ON scim_token(revoked_by);
CREATE INDEX IF NOT EXISTS idx_translation_status_translated_by ON translation_status(translated_by);
CREATE INDEX IF NOT EXISTS idx_webhook_registration_created_by ON webhook_registration(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_threshold_created_by ON risk_appetite_threshold(created_by);
CREATE INDEX IF NOT EXISTS idx_certification_readiness_snapshot_created_by ON certification_readiness_snapshot(created_by);
CREATE INDEX IF NOT EXISTS idx_nis2_incident_report_created_by ON nis2_incident_report(created_by);
CREATE INDEX IF NOT EXISTS idx_fair_parameters_created_by ON fair_parameters(created_by);
CREATE INDEX IF NOT EXISTS idx_fair_parameters_updated_by ON fair_parameters(updated_by);
CREATE INDEX IF NOT EXISTS idx_fair_simulation_result_created_by ON fair_simulation_result(created_by);
CREATE INDEX IF NOT EXISTS idx_asset_cpe_created_by ON asset_cpe(created_by);
CREATE INDEX IF NOT EXISTS idx_cve_asset_match_acknowledged_by ON cve_asset_match(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_soa_ai_suggestion_reviewed_by ON soa_ai_suggestion(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_automation_rule_created_by ON automation_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_report_template_created_by ON report_template(created_by);
CREATE INDEX IF NOT EXISTS idx_report_template_created_by ON report_template(created_by);
CREATE INDEX IF NOT EXISTS idx_report_template_created_by ON report_template(created_by);
CREATE INDEX IF NOT EXISTS idx_report_template_created_by ON report_template(created_by);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_generated_by ON report_generation_log(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_generated_by ON report_generation_log(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_generated_by ON report_generation_log(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_generated_by ON report_generation_log(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_schedule_created_by ON report_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_report_schedule_created_by ON report_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_report_schedule_created_by ON report_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_report_schedule_created_by ON report_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_regulation_simulation_created_by ON regulation_simulation(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_import_created_by ON audit_analytics_import(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_result_created_by ON audit_analytics_result(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_model_created_by ON risk_prediction_model(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_model_created_by ON risk_prediction_model(created_by);
CREATE INDEX IF NOT EXISTS idx_abac_policy_created_by ON abac_policy(created_by);
CREATE INDEX IF NOT EXISTS idx_simulation_scenario_created_by ON simulation_scenario(created_by);
CREATE INDEX IF NOT EXISTS idx_simulation_scenario_created_by ON simulation_scenario(created_by);
CREATE INDEX IF NOT EXISTS idx_dmn_decision_created_by ON dmn_decision(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_registration_created_by ON agent_registration(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_recommendation_accepted_by ON agent_recommendation(accepted_by);
CREATE INDEX IF NOT EXISTS idx_architecture_element_owner ON architecture_element(owner);
CREATE INDEX IF NOT EXISTS idx_architecture_element_created_by ON architecture_element(created_by);
CREATE INDEX IF NOT EXISTS idx_architecture_relationship_created_by ON architecture_relationship(created_by);
CREATE INDEX IF NOT EXISTS idx_architecture_rule_created_by ON architecture_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_architecture_rule_violation_acknowledged_by ON architecture_rule_violation(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_data_flow_created_by ON data_flow(created_by);
CREATE INDEX IF NOT EXISTS idx_application_interface_created_by ON application_interface(created_by);
CREATE INDEX IF NOT EXISTS idx_technology_entry_created_by ON technology_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_architecture_change_request_submitted_by ON architecture_change_request(submitted_by);
CREATE INDEX IF NOT EXISTS idx_architecture_change_request_reviewed_by ON architecture_change_request(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_architecture_change_request_created_by ON architecture_change_request(created_by);
CREATE INDEX IF NOT EXISTS idx_architecture_change_vote_user_id ON architecture_change_vote(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definition_created_by ON custom_field_definition(created_by);
CREATE INDEX IF NOT EXISTS idx_treatment_milestone_responsible_id ON treatment_milestone(responsible_id);
CREATE INDEX IF NOT EXISTS idx_emerging_risk_responsible_id ON emerging_risk(responsible_id);
CREATE INDEX IF NOT EXISTS idx_emerging_risk_created_by ON emerging_risk(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_event_created_by ON risk_event(created_by);
CREATE INDEX IF NOT EXISTS idx_ccm_connector_created_by ON ccm_connector(created_by);
CREATE INDEX IF NOT EXISTS idx_sox_scope_approved_by ON sox_scope(approved_by);
CREATE INDEX IF NOT EXISTS idx_sox_walkthrough_performed_by ON sox_walkthrough(performed_by);
CREATE INDEX IF NOT EXISTS idx_sox_walkthrough_reviewed_by ON sox_walkthrough(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_control_deficiency_remediation_responsible ON control_deficiency(remediation_responsible);
CREATE INDEX IF NOT EXISTS idx_control_deficiency_retest_by ON control_deficiency(retest_by);
CREATE INDEX IF NOT EXISTS idx_control_deficiency_created_by ON control_deficiency(created_by);
CREATE INDEX IF NOT EXISTS idx_crisis_contact_tree_created_by ON crisis_contact_tree(created_by);
CREATE INDEX IF NOT EXISTS idx_crisis_contact_node_user_id ON crisis_contact_node(user_id);
CREATE INDEX IF NOT EXISTS idx_crisis_contact_node_deputy_user_id ON crisis_contact_node(deputy_user_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_lesson_action_owner_id ON bc_exercise_lesson(action_owner_id);
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_approved_by ON recovery_procedure(approved_by);
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_created_by ON recovery_procedure(created_by);
CREATE INDEX IF NOT EXISTS idx_retention_schedule_responsible_id ON retention_schedule(responsible_id);
CREATE INDEX IF NOT EXISTS idx_retention_schedule_created_by ON retention_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_retention_exception_responsible_id ON retention_exception(responsible_id);
CREATE INDEX IF NOT EXISTS idx_retention_exception_released_by ON retention_exception(released_by);
CREATE INDEX IF NOT EXISTS idx_retention_exception_created_by ON retention_exception(created_by);
CREATE INDEX IF NOT EXISTS idx_deletion_request_approved_by ON deletion_request(approved_by);
CREATE INDEX IF NOT EXISTS idx_deletion_request_rejected_by ON deletion_request(rejected_by);
CREATE INDEX IF NOT EXISTS idx_deletion_request_verified_by ON deletion_request(verified_by);
CREATE INDEX IF NOT EXISTS idx_deletion_request_created_by ON deletion_request(created_by);
CREATE INDEX IF NOT EXISTS idx_transfer_impact_assessment_assessor_id ON transfer_impact_assessment(assessor_id);
CREATE INDEX IF NOT EXISTS idx_transfer_impact_assessment_created_by ON transfer_impact_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_processor_agreement_created_by ON processor_agreement(created_by);
CREATE INDEX IF NOT EXISTS idx_sub_processor_notification_response_by ON sub_processor_notification(response_by);
CREATE INDEX IF NOT EXISTS idx_pbd_assessment_assessed_by ON pbd_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_pbd_assessment_approved_by ON pbd_assessment(approved_by);
CREATE INDEX IF NOT EXISTS idx_pbd_assessment_created_by ON pbd_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_consent_type_validity_assessed_by ON consent_type(validity_assessed_by);
CREATE INDEX IF NOT EXISTS idx_consent_type_created_by ON consent_type(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_wp_folder_created_by ON audit_wp_folder(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_prepared_by ON audit_working_paper(prepared_by);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_reviewed_by ON audit_working_paper(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_approved_by ON audit_working_paper(approved_by);
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_created_by ON audit_wp_review_note(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_resolved_by ON audit_wp_review_note(resolved_by);
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_reply_created_by ON audit_wp_review_note_reply(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_time_entry_created_by ON audit_time_entry(created_by);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_rule_created_by ON continuous_audit_rule(created_by);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_acknowledged_by ON continuous_audit_exception(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_false_positive_approved_by ON continuous_audit_exception(false_positive_approved_by);
CREATE INDEX IF NOT EXISTS idx_audit_qa_review_reviewer_id ON audit_qa_review(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_audit_qa_review_created_by ON audit_qa_review(created_by);
CREATE INDEX IF NOT EXISTS idx_external_auditor_share_shared_by ON external_auditor_share(shared_by);
CREATE INDEX IF NOT EXISTS idx_vendor_sla_measurement_measured_by ON vendor_sla_measurement(measured_by);
CREATE INDEX IF NOT EXISTS idx_vendor_exit_plan_reviewed_by ON vendor_exit_plan(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_vendor_exit_plan_created_by ON vendor_exit_plan(created_by);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_approved_by ON vendor_sub_processor(approved_by);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_notification_reviewed_by ON vendor_sub_processor_notification(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_materiality_assessment_finalized_by ON materiality_assessment(finalized_by);
CREATE INDEX IF NOT EXISTS idx_materiality_assessment_created_by ON materiality_assessment(created_by);
CREATE INDEX IF NOT EXISTS idx_materiality_iro_created_by ON materiality_iro(created_by);
CREATE INDEX IF NOT EXISTS idx_emission_activity_data_created_by ON emission_activity_data(created_by);
CREATE INDEX IF NOT EXISTS idx_esg_collection_campaign_created_by ON esg_collection_campaign(created_by);
CREATE INDEX IF NOT EXISTS idx_esg_collection_assignment_reviewer_id ON esg_collection_assignment(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_esg_assessment_assessed_by ON supplier_esg_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_supplier_esg_corrective_action_responsible_id ON supplier_esg_corrective_action(responsible_id);
CREATE INDEX IF NOT EXISTS idx_lksg_due_diligence_created_by ON lksg_due_diligence(created_by);
CREATE INDEX IF NOT EXISTS idx_esrs_disclosure_template_reviewed_by ON esrs_disclosure_template(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_wb_evidence_uploaded_by ON wb_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_wb_interview_interviewer_id ON wb_interview(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_wb_investigation_log_performed_by ON wb_investigation_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_wb_protection_case_created_by ON wb_protection_case(created_by);
CREATE INDEX IF NOT EXISTS idx_wb_protection_event_reviewed_by ON wb_protection_event(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_assignment_assigned_by ON wb_ombudsperson_assignment(assigned_by);
CREATE INDEX IF NOT EXISTS idx_process_event_log_imported_by ON process_event_log(imported_by);
CREATE INDEX IF NOT EXISTS idx_process_kpi_definition_owner_id ON process_kpi_definition(owner_id);
CREATE INDEX IF NOT EXISTS idx_process_kpi_measurement_measured_by ON process_kpi_measurement(measured_by);
CREATE INDEX IF NOT EXISTS idx_process_maturity_assessment_assessor_id ON process_maturity_assessment(assessor_id);
CREATE INDEX IF NOT EXISTS idx_value_stream_map_created_by ON value_stream_map(created_by);
CREATE INDEX IF NOT EXISTS idx_application_assessment_history_changed_by ON application_assessment_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_eam_data_object_created_by ON eam_data_object(created_by);
CREATE INDEX IF NOT EXISTS idx_eam_context_created_by ON eam_context(created_by);
CREATE INDEX IF NOT EXISTS idx_eam_org_unit_head_user_id ON eam_org_unit(head_user_id);
CREATE INDEX IF NOT EXISTS idx_eam_ai_config_created_by ON eam_ai_config(created_by);
CREATE INDEX IF NOT EXISTS idx_eam_translation_translated_by ON eam_translation(translated_by);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_resolved_by ON risk_anomaly_detection(resolved_by);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_resolved_by ON risk_anomaly_detection(resolved_by);
CREATE INDEX IF NOT EXISTS idx_ai_system_created_by ON ai_system(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_system_updated_by ON ai_system(updated_by);
CREATE INDEX IF NOT EXISTS idx_ai_conformity_assessment_assessed_by ON ai_conformity_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_ai_human_oversight_log_reviewed_by ON ai_human_oversight_log(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ai_human_oversight_log_reviewer_id ON ai_human_oversight_log(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_transparency_entry_published_by ON ai_transparency_entry(published_by);
CREATE INDEX IF NOT EXISTS idx_ai_fria_created_by ON ai_fria(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_fria_assessed_by ON ai_fria(assessed_by);
CREATE INDEX IF NOT EXISTS idx_ai_framework_mapping_assessed_by ON ai_framework_mapping(assessed_by);
CREATE INDEX IF NOT EXISTS idx_ai_incident_created_by ON ai_incident(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_incident_created_by ON ai_incident(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_prohibited_screening_screened_by ON ai_prohibited_screening(screened_by);
CREATE INDEX IF NOT EXISTS idx_ai_prohibited_screening_screened_by ON ai_prohibited_screening(screened_by);
CREATE INDEX IF NOT EXISTS idx_ai_provider_qms_responsible_id ON ai_provider_qms(responsible_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_qms_responsible_id ON ai_provider_qms(responsible_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_action_assigned_to ON ai_corrective_action(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_action_verified_by ON ai_corrective_action(verified_by);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_action_assigned_to ON ai_corrective_action(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_action_verified_by ON ai_corrective_action(verified_by);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_created_by ON ai_authority_communication(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_created_by ON ai_authority_communication(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_gpai_model_created_by ON ai_gpai_model(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_gpai_model_updated_by ON ai_gpai_model(updated_by);
CREATE INDEX IF NOT EXISTS idx_isms_nonconformity_assigned_to ON isms_nonconformity(assigned_to);
CREATE INDEX IF NOT EXISTS idx_isms_corrective_action_verified_by ON isms_corrective_action(verified_by);
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_revoked_by ON risk_acceptance(revoked_by);
CREATE INDEX IF NOT EXISTS idx_custom_role_created_by ON custom_role(created_by);
CREATE INDEX IF NOT EXISTS idx_user_custom_role_created_by ON user_custom_role(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_contact_created_by ON organization_contact(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_contact_updated_by ON organization_contact(updated_by);
CREATE INDEX IF NOT EXISTS idx_scenario_engine_scenario_created_by ON scenario_engine_scenario(created_by);
CREATE INDEX IF NOT EXISTS idx_tax_cms_element_responsible_id ON tax_cms_element(responsible_id);
CREATE INDEX IF NOT EXISTS idx_tax_risk_owner_id ON tax_risk(owner_id);
CREATE INDEX IF NOT EXISTS idx_tax_gobd_archive_archived_by ON tax_gobd_archive(archived_by);
CREATE INDEX IF NOT EXISTS idx_tax_icfr_control_owner_id ON tax_icfr_control(owner_id);
CREATE INDEX IF NOT EXISTS idx_tax_audit_prep_coordinator_id ON tax_audit_prep(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_horizon_scan_item_reviewed_by ON horizon_scan_item(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_horizon_impact_assessment_assessed_by ON horizon_impact_assessment(assessed_by);
CREATE INDEX IF NOT EXISTS idx_horizon_impact_assessment_approved_by ON horizon_impact_assessment(approved_by);
CREATE INDEX IF NOT EXISTS idx_horizon_calendar_event_assignee_id ON horizon_calendar_event(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cert_readiness_assessment_lead_assessor_id ON cert_readiness_assessment(lead_assessor_id);
CREATE INDEX IF NOT EXISTS idx_cert_evidence_package_generated_by ON cert_evidence_package(generated_by);
CREATE INDEX IF NOT EXISTS idx_cert_mock_audit_auditor_id ON cert_mock_audit(auditor_id);
CREATE INDEX IF NOT EXISTS idx_bi_report_created_by ON bi_report(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_report_updated_by ON bi_report(updated_by);
CREATE INDEX IF NOT EXISTS idx_bi_query_created_by ON bi_query(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_shared_dashboard_created_by ON bi_shared_dashboard(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_scheduled_report_created_by ON bi_scheduled_report(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_report_execution_triggered_by ON bi_report_execution(triggered_by);
CREATE INDEX IF NOT EXISTS idx_maturity_assessment_assessor_id ON maturity_assessment(assessor_id);
CREATE INDEX IF NOT EXISTS idx_maturity_assessment_approved_by ON maturity_assessment(approved_by);
CREATE INDEX IF NOT EXISTS idx_maturity_roadmap_item_assignee_id ON maturity_roadmap_item(assignee_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_submission_submitted_by ON benchmark_submission(submitted_by);
CREATE INDEX IF NOT EXISTS idx_risk_var_calculation_computed_by ON risk_var_calculation(computed_by);
CREATE INDEX IF NOT EXISTS idx_risk_sensitivity_analysis_created_by ON risk_sensitivity_analysis(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_executive_summary_approved_by ON risk_executive_summary(approved_by);
-- ... 48 more
```

## FK -> vendor (1)

```sql
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_notification_vendor_id ON vendor_sub_processor_notification(vendor_id);
```

## FK -> vendor_scorecard (1)

```sql
CREATE INDEX IF NOT EXISTS idx_vendor_scorecard_history_scorecard_id ON vendor_scorecard_history(scorecard_id);
```

## FK -> xbrl_tag (2)

```sql
CREATE INDEX IF NOT EXISTS idx_xbrl_tag_parent_id ON xbrl_tag(parent_id);
CREATE INDEX IF NOT EXISTS idx_xbrl_tagging_instance_tag_id ON xbrl_tagging_instance(tag_id);
```

## FK -> xbrl_taxonomy (1)

```sql
CREATE INDEX IF NOT EXISTS idx_xbrl_tagging_instance_taxonomy_id ON xbrl_tagging_instance(taxonomy_id);
```

## ID-Suffix (241)

```sql
CREATE INDEX IF NOT EXISTS idx_access_log_session_id ON access_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_session_id ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_data_export_log_entity_id ON data_export_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_entity_id ON notification(entity_id);
CREATE INDEX IF NOT EXISTS idx_user_sso_provider_id ON user(sso_provider_id);
CREATE INDEX IF NOT EXISTS idx_account_provider_account_id ON account(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_task_source_entity_id ON task(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_assessment_run_id ON asset_cia_profile(assessment_run_id);
CREATE INDEX IF NOT EXISTS idx_work_item_element_id ON work_item(element_id);
CREATE INDEX IF NOT EXISTS idx_work_item_reviewer_id ON work_item(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_process_step_risk_process_step_id ON process_step_risk(process_step_id);
CREATE INDEX IF NOT EXISTS idx_risk_work_item_id ON risk(work_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_framework_mapping_requirement_id ON risk_framework_mapping(requirement_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_work_item_id ON risk_treatment(work_item_id);
CREATE INDEX IF NOT EXISTS idx_process_reviewer_id ON process(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_process_step_bpmn_element_id ON process_step(bpmn_element_id);
CREATE INDEX IF NOT EXISTS idx_process_comment_entity_id ON process_comment(entity_id);
CREATE INDEX IF NOT EXISTS idx_process_review_schedule_process_id ON process_review_schedule(process_id);
CREATE INDEX IF NOT EXISTS idx_process_review_schedule_assigned_reviewer_id ON process_review_schedule(assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_control_work_item_id ON control(work_item_id);
CREATE INDEX IF NOT EXISTS idx_control_test_task_id ON control_test(task_id);
CREATE INDEX IF NOT EXISTS idx_control_test_tester_id ON control_test(tester_id);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_responsible_id ON control_test_campaign(responsible_id);
CREATE INDEX IF NOT EXISTS idx_evidence_entity_id ON evidence(entity_id);
CREATE INDEX IF NOT EXISTS idx_finding_work_item_id ON finding(work_item_id);
CREATE INDEX IF NOT EXISTS idx_finding_task_id ON finding(task_id);
CREATE INDEX IF NOT EXISTS idx_document_work_item_id ON document(work_item_id);
CREATE INDEX IF NOT EXISTS idx_document_reviewer_id ON document(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_document_approver_id ON document(approver_id);
CREATE INDEX IF NOT EXISTS idx_document_entity_link_entity_id ON document_entity_link(entity_id);
CREATE INDEX IF NOT EXISTS idx_catalog_entry_reference_entity_id ON catalog_entry_reference(entity_id);
CREATE INDEX IF NOT EXISTS idx_catalog_lifecycle_phase_entity_id ON catalog_lifecycle_phase(entity_id);
CREATE INDEX IF NOT EXISTS idx_org_catalog_exclusion_entry_id ON org_catalog_exclusion(entry_id);
CREATE INDEX IF NOT EXISTS idx_security_incident_element_id ON security_incident(element_id);
CREATE INDEX IF NOT EXISTS idx_security_incident_work_item_id ON security_incident(work_item_id);
CREATE INDEX IF NOT EXISTS idx_threat_catalog_entry_id ON threat(catalog_entry_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_mitigation_control_id ON vulnerability(mitigation_control_id);
CREATE INDEX IF NOT EXISTS idx_management_review_chair_id ON management_review(chair_id);
CREATE INDEX IF NOT EXISTS idx_soa_entry_responsible_id ON soa_entry(responsible_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_work_item_id ON bc_exercise(work_item_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_crisis_scenario_id ON bc_exercise(crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_bcp_id ON bc_exercise(bcp_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_exercise_lead_id ON bc_exercise(exercise_lead_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_report_document_id ON bc_exercise(report_document_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_exercise_id ON bc_exercise_finding(exercise_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_finding_id ON bc_exercise_finding(finding_id);
CREATE INDEX IF NOT EXISTS idx_bcp_work_item_id ON bcp(work_item_id);
CREATE INDEX IF NOT EXISTS idx_bcp_bc_manager_id ON bcp(bc_manager_id);
CREATE INDEX IF NOT EXISTS idx_bcp_deputy_manager_id ON bcp(deputy_manager_id);
CREATE INDEX IF NOT EXISTS idx_bcp_report_document_id ON bcp(report_document_id);
CREATE INDEX IF NOT EXISTS idx_bcp_procedure_responsible_id ON bcp_procedure(responsible_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_bcp_id ON bcp_resource(bcp_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_asset_id ON bcp_resource(asset_id);
CREATE INDEX IF NOT EXISTS idx_bia_assessment_lead_assessor_id ON bia_assessment(lead_assessor_id);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_bia_process_impact_id ON bia_supplier_dependency(bia_process_impact_id);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_vendor_id ON bia_supplier_dependency(vendor_id);
CREATE INDEX IF NOT EXISTS idx_crisis_log_crisis_scenario_id ON crisis_log(crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_bcp_id ON crisis_scenario(bcp_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_crisis_scenario_id ON crisis_team_member(crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_user_id ON crisis_team_member(user_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_deputy_user_id ON crisis_team_member(deputy_user_id);
CREATE INDEX IF NOT EXISTS idx_essential_process_process_id ON essential_process(process_id);
CREATE INDEX IF NOT EXISTS idx_essential_process_bia_assessment_id ON essential_process(bia_assessment_id);
CREATE INDEX IF NOT EXISTS idx_data_breach_work_item_id ON data_breach(work_item_id);
CREATE INDEX IF NOT EXISTS idx_data_breach_assignee_id ON data_breach(assignee_id);
CREATE INDEX IF NOT EXISTS idx_dpia_work_item_id ON dpia(work_item_id);
CREATE INDEX IF NOT EXISTS idx_dpia_residual_risk_sign_off_id ON dpia(residual_risk_sign_off_id);
CREATE INDEX IF NOT EXISTS idx_dsr_work_item_id ON dsr(work_item_id);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_work_item_id ON ropa_entry(work_item_id);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_controller_org_id ON ropa_entry(controller_org_id);
CREATE INDEX IF NOT EXISTS idx_tia_work_item_id ON tia(work_item_id);
CREATE INDEX IF NOT EXISTS idx_tia_responsible_id ON tia(responsible_id);
CREATE INDEX IF NOT EXISTS idx_audit_work_item_id ON audit(work_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_auditee_id ON audit(auditee_id);
CREATE INDEX IF NOT EXISTS idx_audit_report_document_id ON audit(report_document_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_evidence_id ON audit_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan_item_universe_entry_id ON audit_plan_item(universe_entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan_item_lead_auditor_id ON audit_plan_item(lead_auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_universe_entry_entity_id ON audit_universe_entry(entity_id);
CREATE INDEX IF NOT EXISTS idx_contract_work_item_id ON contract(work_item_id);
CREATE INDEX IF NOT EXISTS idx_contract_document_id ON contract(document_id);
CREATE INDEX IF NOT EXISTS idx_contract_approver_id ON contract(approver_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendment_document_id ON contract_amendment(document_id);
CREATE INDEX IF NOT EXISTS idx_contract_obligation_responsible_id ON contract_obligation(responsible_id);
CREATE INDEX IF NOT EXISTS idx_vendor_work_item_id ON vendor(work_item_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tax_id ON vendor(tax_id);
CREATE INDEX IF NOT EXISTS idx_dd_evidence_question_id ON dd_evidence(question_id);
CREATE INDEX IF NOT EXISTS idx_dd_response_question_id ON dd_response(question_id);
CREATE INDEX IF NOT EXISTS idx_dd_session_due_diligence_id ON dd_session(due_diligence_id);
CREATE INDEX IF NOT EXISTS idx_dd_session_template_id ON dd_session(template_id);
CREATE INDEX IF NOT EXISTS idx_esg_control_link_datapoint_id ON esg_control_link(datapoint_id);
CREATE INDEX IF NOT EXISTS idx_esg_control_link_control_id ON esg_control_link(control_id);
CREATE INDEX IF NOT EXISTS idx_esg_materiality_vote_voter_id ON esg_materiality_vote(voter_id);
CREATE INDEX IF NOT EXISTS idx_esg_target_metric_id ON esg_target(metric_id);
CREATE INDEX IF NOT EXISTS idx_esrs_metric_datapoint_id ON esrs_metric(datapoint_id);
CREATE INDEX IF NOT EXISTS idx_esrs_metric_responsible_user_id ON esrs_metric(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_control_effectiveness_score_control_id ON control_effectiveness_score(control_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_relevance_score_feed_item_id ON regulatory_relevance_score(feed_item_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_report_id ON wb_case(report_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_evidence_report_id ON wb_case_evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_message_author_id ON wb_case_message(author_id);
CREATE INDEX IF NOT EXISTS idx_grc_cost_entry_entity_id ON grc_cost_entry(entity_id);
CREATE INDEX IF NOT EXISTS idx_grc_roi_calculation_entity_id ON grc_roi_calculation(entity_id);
CREATE INDEX IF NOT EXISTS idx_grc_time_entry_task_id ON grc_time_entry(task_id);
CREATE INDEX IF NOT EXISTS idx_grc_time_entry_entity_id ON grc_time_entry(entity_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_layout_user_id ON user_dashboard_layout(user_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_campaign_question_set_id ON rcsa_campaign(question_set_id);
CREATE INDEX IF NOT EXISTS idx_rcsa_assignment_entity_id ON rcsa_assignment(entity_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_saml_entity_id ON sso_config(saml_entity_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_oidc_client_id ON sso_config(oidc_client_id);
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_scim_resource_id ON scim_sync_log(scim_resource_id);
CREATE INDEX IF NOT EXISTS idx_translation_status_entity_id ON translation_status(entity_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_log_entity_id ON webhook_delivery_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_event_log_entity_id ON event_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_event_log_user_id ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cve_asset_match_linked_vulnerability_id ON cve_asset_match(linked_vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_compliance_culture_snapshot_org_entity_id ON compliance_culture_snapshot(org_entity_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_execution_triggered_by_event_id ON automation_rule_execution(triggered_by_event_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_execution_entity_id ON automation_rule_execution(entity_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_schedule_id ON report_generation_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_schedule_id ON report_generation_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_schedule_id ON report_generation_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_schedule_id ON report_generation_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attack_path_result_batch_id ON attack_path_result(batch_id);
CREATE INDEX IF NOT EXISTS idx_risk_propagation_result_source_risk_id ON risk_propagation_result(source_risk_id);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_import_audit_id ON audit_analytics_import(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_result_finding_id ON audit_analytics_result(finding_id);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_risk_id ON risk_prediction(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_entity_id ON risk_prediction(entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_entity_id ON risk_prediction(entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_alert_risk_id ON risk_prediction_alert(risk_id);
CREATE INDEX IF NOT EXISTS idx_abac_access_log_entity_id ON abac_access_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_abac_access_log_matched_policy_id ON abac_access_log(matched_policy_id);
CREATE INDEX IF NOT EXISTS idx_simulation_scenario_source_entity_id ON simulation_scenario(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_simulation_activity_param_activity_id ON simulation_activity_param(activity_id);
CREATE INDEX IF NOT EXISTS idx_simulation_activity_param_resource_id ON simulation_activity_param(resource_id);
CREATE INDEX IF NOT EXISTS idx_agent_recommendation_entity_id ON agent_recommendation(entity_id);
CREATE INDEX IF NOT EXISTS idx_application_portfolio_vendor_id ON application_portfolio(vendor_id);
CREATE INDEX IF NOT EXISTS idx_data_flow_ropa_entry_id ON data_flow(ropa_entry_id);
CREATE INDEX IF NOT EXISTS idx_search_index_entity_id ON search_index(entity_id);
CREATE INDEX IF NOT EXISTS idx_search_index_owner_id ON search_index(owner_id);
CREATE INDEX IF NOT EXISTS idx_treatment_milestone_depends_on_milestone_id ON treatment_milestone(depends_on_milestone_id);
CREATE INDEX IF NOT EXISTS idx_control_deficiency_finding_id ON control_deficiency(finding_id);
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_entity_id ON recovery_procedure(entity_id);
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_step_depends_on_step_id ON recovery_procedure_step(depends_on_step_id);
CREATE INDEX IF NOT EXISTS idx_deletion_request_evidence_document_id ON deletion_request(evidence_document_id);
CREATE INDEX IF NOT EXISTS idx_processor_agreement_agreement_document_id ON processor_agreement(agreement_document_id);
CREATE INDEX IF NOT EXISTS idx_pbd_assessment_dpia_id ON pbd_assessment(dpia_id);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_rule_id ON continuous_audit_exception(rule_id);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_entity_id ON continuous_audit_exception(entity_id);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_escalated_finding_id ON continuous_audit_exception(escalated_finding_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_share_entity_id ON external_auditor_share(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_activity_external_user_id ON external_auditor_activity(external_user_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_activity_entity_id ON external_auditor_activity(entity_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sla_definition_contract_id ON vendor_sla_definition(contract_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_tia_id ON vendor_sub_processor(tia_id);
CREATE INDEX IF NOT EXISTS idx_materiality_stakeholder_engagement_evidence_document_id ON materiality_stakeholder_engagement(evidence_document_id);
CREATE INDEX IF NOT EXISTS idx_emission_activity_data_emission_factor_id ON emission_activity_data(emission_factor_id);
CREATE INDEX IF NOT EXISTS idx_esg_collection_campaign_template_id ON esg_collection_campaign(template_id);
CREATE INDEX IF NOT EXISTS idx_esg_collection_assignment_metric_id ON esg_collection_assignment(metric_id);
CREATE INDEX IF NOT EXISTS idx_lksg_due_diligence_risk_analysis_document_id ON lksg_due_diligence(risk_analysis_document_id);
CREATE INDEX IF NOT EXISTS idx_wb_investigation_assigned_team_id ON wb_investigation(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_wb_investigation_final_report_document_id ON wb_investigation(final_report_document_id);
CREATE INDEX IF NOT EXISTS idx_wb_protection_case_reporter_user_id ON wb_protection_case(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_activity_ombudsperson_user_id ON wb_ombudsperson_activity(ombudsperson_user_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_activity_case_id ON wb_ombudsperson_activity(case_id);
CREATE INDEX IF NOT EXISTS idx_process_event_case_id ON process_event(case_id);
CREATE INDEX IF NOT EXISTS idx_eam_bpmn_element_placement_bpmn_node_id ON eam_bpmn_element_placement(bpmn_node_id);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_entity_id ON risk_anomaly_detection(entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_entity_id ON risk_anomaly_detection(entity_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_source_connection_id ON data_lineage_source(connection_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_entry_entity_id ON data_lineage_entry(entity_id);
CREATE INDEX IF NOT EXISTS idx_eu_taxonomy_assessment_objective_id ON eu_taxonomy_assessment(objective_id);
CREATE INDEX IF NOT EXISTS idx_root_cause_analysis_incident_id ON root_cause_analysis(incident_id);
CREATE INDEX IF NOT EXISTS idx_root_cause_analysis_owner_id ON root_cause_analysis(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_sample_audit_id ON audit_sample(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_sample_campaign_id ON audit_sample(campaign_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_entity_id ON approval_request(entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_decision_approver_id ON approval_decision(approver_id);
CREATE INDEX IF NOT EXISTS idx_exception_report_entity_id ON exception_report(entity_id);
CREATE INDEX IF NOT EXISTS idx_control_monitoring_rule_control_id ON control_monitoring_rule(control_id);
CREATE INDEX IF NOT EXISTS idx_attestation_response_policy_id ON attestation_response(policy_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_entity_id ON checklist_instance(entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_request_audit_id ON evidence_request(audit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_request_evidence_id ON evidence_request(evidence_id);
CREATE INDEX IF NOT EXISTS idx_data_link_source_id ON data_link(source_id);
CREATE INDEX IF NOT EXISTS idx_data_link_target_id ON data_link(target_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_result_entity_id ON data_validation_result(entity_id);
CREATE INDEX IF NOT EXISTS idx_content_placeholder_source_id ON content_placeholder(source_id);
CREATE INDEX IF NOT EXISTS idx_narrative_instance_entity_id ON narrative_instance(entity_id);
CREATE INDEX IF NOT EXISTS idx_inline_comment_entity_id ON inline_comment(entity_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_entity_id ON review_cycle(entity_id);
CREATE INDEX IF NOT EXISTS idx_review_decision_reviewer_id ON review_decision(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_content_request_entity_id ON content_request(entity_id);
CREATE INDEX IF NOT EXISTS idx_messaging_integration_channel_id ON messaging_integration(channel_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_group_parent_entity_id ON consolidation_group(parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_entry_entity_id ON consolidation_entry(entity_id);
CREATE INDEX IF NOT EXISTS idx_esef_filing_document_id ON esef_filing(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_system_eu_database_registration_id ON ai_system(eu_database_registration_id);
-- ... 41 more
```

## RLS-Filter (53)

```sql
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_org_id ON asset_cia_profile(org_id);
CREATE INDEX IF NOT EXISTS idx_work_item_link_org_id ON work_item_link(org_id);
CREATE INDEX IF NOT EXISTS idx_process_asset_org_id ON process_asset(org_id);
CREATE INDEX IF NOT EXISTS idx_process_document_org_id ON process_document(org_id);
CREATE INDEX IF NOT EXISTS idx_process_step_asset_org_id ON process_step_asset(org_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_org_id ON bc_exercise_finding(org_id);
CREATE INDEX IF NOT EXISTS idx_bcp_procedure_org_id ON bcp_procedure(org_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_org_id ON bcp_resource(org_id);
CREATE INDEX IF NOT EXISTS idx_bia_process_impact_org_id ON bia_process_impact(org_id);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_org_id ON bia_supplier_dependency(org_id);
CREATE INDEX IF NOT EXISTS idx_continuity_strategy_org_id ON continuity_strategy(org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_log_org_id ON crisis_log(org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_org_id ON crisis_scenario(org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_org_id ON crisis_team_member(org_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendment_org_id ON contract_amendment(org_id);
CREATE INDEX IF NOT EXISTS idx_contract_sla_org_id ON contract_sla(org_id);
CREATE INDEX IF NOT EXISTS idx_contract_sla_measurement_org_id ON contract_sla_measurement(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_org_id ON vendor_contact(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_due_diligence_org_id ON vendor_due_diligence(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_risk_assessment_org_id ON vendor_risk_assessment(org_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_relevance_score_org_id ON regulatory_relevance_score(org_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_evidence_org_id ON wb_case_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_message_org_id ON wb_case_message(org_id);
CREATE INDEX IF NOT EXISTS idx_simulation_activity_param_org_id ON simulation_activity_param(org_id);
CREATE INDEX IF NOT EXISTS idx_technology_application_link_org_id ON technology_application_link(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource_allocation_org_id ON audit_resource_allocation(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_time_entry_org_id ON audit_time_entry(org_id);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_result_org_id ON continuous_audit_result(org_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_activity_org_id ON external_auditor_activity(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecard_history_org_id ON vendor_scorecard_history(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sla_measurement_org_id ON vendor_sla_measurement(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_notification_org_id ON vendor_sub_processor_notification(org_id);
CREATE INDEX IF NOT EXISTS idx_materiality_iro_org_id ON materiality_iro(org_id);
CREATE INDEX IF NOT EXISTS idx_materiality_stakeholder_engagement_org_id ON materiality_stakeholder_engagement(org_id);
CREATE INDEX IF NOT EXISTS idx_emission_factor_org_id ON emission_factor(org_id);
CREATE INDEX IF NOT EXISTS idx_esg_collection_assignment_org_id ON esg_collection_assignment(org_id);
CREATE INDEX IF NOT EXISTS idx_supplier_esg_corrective_action_org_id ON supplier_esg_corrective_action(org_id);
CREATE INDEX IF NOT EXISTS idx_wb_interview_org_id ON wb_interview(org_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_assignment_org_id ON wb_ombudsperson_assignment(org_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_activity_org_id ON wb_ombudsperson_activity(org_id);
CREATE INDEX IF NOT EXISTS idx_process_event_org_id ON process_event(org_id);
CREATE INDEX IF NOT EXISTS idx_process_conformance_result_org_id ON process_conformance_result(org_id);
CREATE INDEX IF NOT EXISTS idx_process_mining_suggestion_org_id ON process_mining_suggestion(org_id);
CREATE INDEX IF NOT EXISTS idx_process_kpi_measurement_org_id ON process_kpi_measurement(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_org_id ON approval_workflow(org_id);
CREATE INDEX IF NOT EXISTS idx_control_monitoring_rule_org_id ON control_monitoring_rule(org_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_org_id ON checklist_template(org_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_rule_org_id ON data_validation_rule(org_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_result_org_id ON data_validation_result(org_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_org_id ON review_cycle(org_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_group_org_id ON consolidation_group(org_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_entry_org_id ON consolidation_entry(org_id);
CREATE INDEX IF NOT EXISTS idx_process_simulation_result_org_id ON process_simulation_result(org_id);
```

## Status-Filter (137)

```sql
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_status ON general_catalog_entry(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_status ON vulnerability(status);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_status ON bc_exercise(status);
CREATE INDEX IF NOT EXISTS idx_audit_plan_item_status ON audit_plan_item(status);
CREATE INDEX IF NOT EXISTS idx_lksg_assessment_status ON lksg_assessment(status);
CREATE INDEX IF NOT EXISTS idx_rcsa_campaign_status ON rcsa_campaign(status);
CREATE INDEX IF NOT EXISTS idx_rcsa_assignment_status ON rcsa_assignment(status);
CREATE INDEX IF NOT EXISTS idx_policy_distribution_status ON policy_distribution(status);
CREATE INDEX IF NOT EXISTS idx_policy_acknowledgment_status ON policy_acknowledgment(status);
CREATE INDEX IF NOT EXISTS idx_import_job_status ON import_job(status);
CREATE INDEX IF NOT EXISTS idx_import_job_status ON import_job(status);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_threshold_status ON risk_appetite_threshold(status);
CREATE INDEX IF NOT EXISTS idx_nis2_incident_report_status ON nis2_incident_report(status);
CREATE INDEX IF NOT EXISTS idx_cve_asset_match_status ON cve_asset_match(status);
CREATE INDEX IF NOT EXISTS idx_soa_ai_suggestion_status ON soa_ai_suggestion(status);
CREATE INDEX IF NOT EXISTS idx_maturity_roadmap_action_status ON maturity_roadmap_action(status);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_status ON report_generation_log(status);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_status ON report_generation_log(status);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_status ON report_generation_log(status);
CREATE INDEX IF NOT EXISTS idx_report_generation_log_status ON report_generation_log(status);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_model_status ON risk_prediction_model(status);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_model_status ON risk_prediction_model(status);
CREATE INDEX IF NOT EXISTS idx_simulation_scenario_status ON simulation_scenario(status);
CREATE INDEX IF NOT EXISTS idx_simulation_scenario_status ON simulation_scenario(status);
CREATE INDEX IF NOT EXISTS idx_dmn_decision_status ON dmn_decision(status);
CREATE INDEX IF NOT EXISTS idx_agent_registration_status ON agent_registration(status);
CREATE INDEX IF NOT EXISTS idx_agent_recommendation_status ON agent_recommendation(status);
CREATE INDEX IF NOT EXISTS idx_architecture_element_status ON architecture_element(status);
CREATE INDEX IF NOT EXISTS idx_architecture_rule_violation_status ON architecture_rule_violation(status);
CREATE INDEX IF NOT EXISTS idx_data_flow_status ON data_flow(status);
CREATE INDEX IF NOT EXISTS idx_architecture_change_request_status ON architecture_change_request(status);
CREATE INDEX IF NOT EXISTS idx_search_index_status ON search_index(status);
CREATE INDEX IF NOT EXISTS idx_treatment_milestone_status ON treatment_milestone(status);
CREATE INDEX IF NOT EXISTS idx_emerging_risk_status ON emerging_risk(status);
CREATE INDEX IF NOT EXISTS idx_sox_scope_status ON sox_scope(status);
CREATE INDEX IF NOT EXISTS idx_crisis_communication_log_status ON crisis_communication_log(status);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_lesson_status ON bc_exercise_lesson(status);
CREATE INDEX IF NOT EXISTS idx_recovery_procedure_status ON recovery_procedure(status);
CREATE INDEX IF NOT EXISTS idx_retention_exception_status ON retention_exception(status);
CREATE INDEX IF NOT EXISTS idx_deletion_request_status ON deletion_request(status);
CREATE INDEX IF NOT EXISTS idx_transfer_impact_assessment_status ON transfer_impact_assessment(status);
CREATE INDEX IF NOT EXISTS idx_pbd_assessment_status ON pbd_assessment(status);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_status ON audit_working_paper(status);
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_status ON audit_wp_review_note(status);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_exception_status ON continuous_audit_exception(status);
CREATE INDEX IF NOT EXISTS idx_audit_qa_review_status ON audit_qa_review(status);
CREATE INDEX IF NOT EXISTS idx_vendor_exit_plan_status ON vendor_exit_plan(status);
CREATE INDEX IF NOT EXISTS idx_materiality_assessment_status ON materiality_assessment(status);
CREATE INDEX IF NOT EXISTS idx_esg_collection_campaign_status ON esg_collection_campaign(status);
CREATE INDEX IF NOT EXISTS idx_esg_collection_assignment_status ON esg_collection_assignment(status);
CREATE INDEX IF NOT EXISTS idx_supplier_esg_corrective_action_status ON supplier_esg_corrective_action(status);
CREATE INDEX IF NOT EXISTS idx_esrs_disclosure_template_status ON esrs_disclosure_template(status);
CREATE INDEX IF NOT EXISTS idx_process_event_log_status ON process_event_log(status);
CREATE INDEX IF NOT EXISTS idx_process_mining_suggestion_status ON process_mining_suggestion(status);
CREATE INDEX IF NOT EXISTS idx_process_kpi_measurement_status ON process_kpi_measurement(status);
CREATE INDEX IF NOT EXISTS idx_value_stream_map_status ON value_stream_map(status);
CREATE INDEX IF NOT EXISTS idx_eam_context_status ON eam_context(status);
CREATE INDEX IF NOT EXISTS idx_eam_translation_status ON eam_translation(status);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_status ON risk_anomaly_detection(status);
CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_status ON risk_anomaly_detection(status);
CREATE INDEX IF NOT EXISTS idx_eu_taxonomy_assessment_status ON eu_taxonomy_assessment(status);
CREATE INDEX IF NOT EXISTS idx_root_cause_analysis_status ON root_cause_analysis(status);
CREATE INDEX IF NOT EXISTS idx_audit_sample_status ON audit_sample(status);
CREATE INDEX IF NOT EXISTS idx_approval_request_status ON approval_request(status);
CREATE INDEX IF NOT EXISTS idx_attestation_campaign_status ON attestation_campaign(status);
CREATE INDEX IF NOT EXISTS idx_sox_scoping_status ON sox_scoping(status);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_status ON checklist_instance(status);
CREATE INDEX IF NOT EXISTS idx_evidence_request_status ON evidence_request(status);
CREATE INDEX IF NOT EXISTS idx_narrative_template_status ON narrative_template(status);
CREATE INDEX IF NOT EXISTS idx_narrative_instance_status ON narrative_instance(status);
CREATE INDEX IF NOT EXISTS idx_review_cycle_status ON review_cycle(status);
CREATE INDEX IF NOT EXISTS idx_content_request_status ON content_request(status);
CREATE INDEX IF NOT EXISTS idx_connector_sync_log_status ON connector_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_xbrl_tagging_instance_status ON xbrl_tagging_instance(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_entry_status ON consolidation_entry(status);
CREATE INDEX IF NOT EXISTS idx_board_report_status ON board_report(status);
CREATE INDEX IF NOT EXISTS idx_esef_filing_status ON esef_filing(status);
CREATE INDEX IF NOT EXISTS idx_ai_system_status ON ai_system(status);
CREATE INDEX IF NOT EXISTS idx_ai_system_status ON ai_system(status);
CREATE INDEX IF NOT EXISTS idx_ai_conformity_assessment_status ON ai_conformity_assessment(status);
CREATE INDEX IF NOT EXISTS idx_ai_conformity_assessment_status ON ai_conformity_assessment(status);
CREATE INDEX IF NOT EXISTS idx_ai_transparency_entry_status ON ai_transparency_entry(status);
CREATE INDEX IF NOT EXISTS idx_ai_transparency_entry_status ON ai_transparency_entry(status);
CREATE INDEX IF NOT EXISTS idx_ai_fria_status ON ai_fria(status);
CREATE INDEX IF NOT EXISTS idx_ai_fria_status ON ai_fria(status);
CREATE INDEX IF NOT EXISTS idx_ai_incident_status ON ai_incident(status);
CREATE INDEX IF NOT EXISTS idx_ai_prohibited_screening_status ON ai_prohibited_screening(status);
CREATE INDEX IF NOT EXISTS idx_ai_provider_qms_status ON ai_provider_qms(status);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_action_status ON ai_corrective_action(status);
CREATE INDEX IF NOT EXISTS idx_ai_authority_communication_status ON ai_authority_communication(status);
CREATE INDEX IF NOT EXISTS idx_ai_penalty_status ON ai_penalty(status);
CREATE INDEX IF NOT EXISTS idx_ai_gpai_model_status ON ai_gpai_model(status);
CREATE INDEX IF NOT EXISTS idx_scenario_engine_scenario_status ON scenario_engine_scenario(status);
CREATE INDEX IF NOT EXISTS idx_tax_cms_element_status ON tax_cms_element(status);
CREATE INDEX IF NOT EXISTS idx_tax_risk_status ON tax_risk(status);
CREATE INDEX IF NOT EXISTS idx_tax_gobd_archive_status ON tax_gobd_archive(status);
CREATE INDEX IF NOT EXISTS idx_tax_icfr_control_status ON tax_icfr_control(status);
CREATE INDEX IF NOT EXISTS idx_tax_audit_prep_status ON tax_audit_prep(status);
CREATE INDEX IF NOT EXISTS idx_horizon_scan_item_status ON horizon_scan_item(status);
CREATE INDEX IF NOT EXISTS idx_horizon_impact_assessment_status ON horizon_impact_assessment(status);
CREATE INDEX IF NOT EXISTS idx_cert_readiness_assessment_status ON cert_readiness_assessment(status);
CREATE INDEX IF NOT EXISTS idx_cert_evidence_package_status ON cert_evidence_package(status);
CREATE INDEX IF NOT EXISTS idx_cert_mock_audit_status ON cert_mock_audit(status);
CREATE INDEX IF NOT EXISTS idx_bi_report_status ON bi_report(status);
CREATE INDEX IF NOT EXISTS idx_bi_query_status ON bi_query(status);
CREATE INDEX IF NOT EXISTS idx_bi_report_execution_status ON bi_report_execution(status);
CREATE INDEX IF NOT EXISTS idx_maturity_assessment_status ON maturity_assessment(status);
CREATE INDEX IF NOT EXISTS idx_maturity_roadmap_item_status ON maturity_roadmap_item(status);
CREATE INDEX IF NOT EXISTS idx_risk_var_calculation_status ON risk_var_calculation(status);
CREATE INDEX IF NOT EXISTS idx_risk_executive_summary_status ON risk_executive_summary(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_version_status ON marketplace_version(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_installation_status ON marketplace_installation(status);
CREATE INDEX IF NOT EXISTS idx_portal_questionnaire_response_status ON portal_questionnaire_response(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollment_status ON academy_enrollment(status);
CREATE INDEX IF NOT EXISTS idx_api_key_status ON api_key(status);
CREATE INDEX IF NOT EXISTS idx_developer_app_status ON developer_app(status);
CREATE INDEX IF NOT EXISTS idx_plugin_installation_status ON plugin_installation(status);
CREATE INDEX IF NOT EXISTS idx_plugin_execution_log_status ON plugin_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_session_status ON onboarding_session(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_step_status ON onboarding_step(status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_state_status ON offline_sync_state(status);
CREATE INDEX IF NOT EXISTS idx_org_subscription_status ON org_subscription(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_status ON billing_invoice(status);
CREATE INDEX IF NOT EXISTS idx_evidence_connector_status ON evidence_connector(status);
CREATE INDEX IF NOT EXISTS idx_connector_health_check_status ON connector_health_check(status);
CREATE INDEX IF NOT EXISTS idx_copilot_suggested_action_status ON copilot_suggested_action(status);
CREATE INDEX IF NOT EXISTS idx_evidence_review_job_status ON evidence_review_job(status);
CREATE INDEX IF NOT EXISTS idx_evidence_review_gap_status ON evidence_review_gap(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_change_status ON regulatory_change(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_impact_assessment_status ON regulatory_impact_assessment(status);
CREATE INDEX IF NOT EXISTS idx_control_test_execution_status ON control_test_execution(status);
CREATE INDEX IF NOT EXISTS idx_control_test_checklist_status ON control_test_checklist(status);
CREATE INDEX IF NOT EXISTS idx_dora_ict_risk_status ON dora_ict_risk(status);
CREATE INDEX IF NOT EXISTS idx_dora_tlpt_plan_status ON dora_tlpt_plan(status);
CREATE INDEX IF NOT EXISTS idx_dora_ict_incident_status ON dora_ict_incident(status);
CREATE INDEX IF NOT EXISTS idx_dora_ict_provider_status ON dora_ict_provider(status);
CREATE INDEX IF NOT EXISTS idx_dora_information_sharing_status ON dora_information_sharing(status);
```

## Timestamp-Sort (783)

```sql
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_export_log_created_at ON data_export_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_updated_at ON notification(updated_at);
CREATE INDEX IF NOT EXISTS idx_notification_deleted_at ON notification(deleted_at);
CREATE INDEX IF NOT EXISTS idx_organization_created_at ON organization(created_at);
CREATE INDEX IF NOT EXISTS idx_organization_updated_at ON organization(updated_at);
CREATE INDEX IF NOT EXISTS idx_organization_deleted_at ON organization(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at);
CREATE INDEX IF NOT EXISTS idx_user_updated_at ON user(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_deleted_at ON user(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_created_at ON user_organization_role(created_at);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_updated_at ON user_organization_role(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_organization_role_deleted_at ON user_organization_role(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invitation_created_at ON invitation(created_at);
CREATE INDEX IF NOT EXISTS idx_invitation_updated_at ON invitation(updated_at);
CREATE INDEX IF NOT EXISTS idx_invitation_deleted_at ON invitation(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_created_at ON task(created_at);
CREATE INDEX IF NOT EXISTS idx_task_updated_at ON task(updated_at);
CREATE INDEX IF NOT EXISTS idx_task_deleted_at ON task(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_comment_created_at ON task_comment(created_at);
CREATE INDEX IF NOT EXISTS idx_task_comment_updated_at ON task_comment(updated_at);
CREATE INDEX IF NOT EXISTS idx_task_comment_deleted_at ON task_comment(deleted_at);
CREATE INDEX IF NOT EXISTS idx_module_config_created_at ON module_config(created_at);
CREATE INDEX IF NOT EXISTS idx_module_config_updated_at ON module_config(updated_at);
CREATE INDEX IF NOT EXISTS idx_module_definition_created_at ON module_definition(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_created_at ON asset(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_updated_at ON asset(updated_at);
CREATE INDEX IF NOT EXISTS idx_asset_deleted_at ON asset(deleted_at);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_created_at ON asset_cia_profile(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_updated_at ON asset_cia_profile(updated_at);
CREATE INDEX IF NOT EXISTS idx_work_item_created_at ON work_item(created_at);
CREATE INDEX IF NOT EXISTS idx_work_item_updated_at ON work_item(updated_at);
CREATE INDEX IF NOT EXISTS idx_work_item_deleted_at ON work_item(deleted_at);
CREATE INDEX IF NOT EXISTS idx_work_item_link_created_at ON work_item_link(created_at);
CREATE INDEX IF NOT EXISTS idx_work_item_type_created_at ON work_item_type(created_at);
CREATE INDEX IF NOT EXISTS idx_kri_created_at ON kri(created_at);
CREATE INDEX IF NOT EXISTS idx_kri_updated_at ON kri(updated_at);
CREATE INDEX IF NOT EXISTS idx_kri_deleted_at ON kri(deleted_at);
CREATE INDEX IF NOT EXISTS idx_kri_measurement_created_at ON kri_measurement(created_at);
CREATE INDEX IF NOT EXISTS idx_process_risk_created_at ON process_risk(created_at);
CREATE INDEX IF NOT EXISTS idx_process_step_risk_created_at ON process_step_risk(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_created_at ON risk(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_updated_at ON risk(updated_at);
CREATE INDEX IF NOT EXISTS idx_risk_deleted_at ON risk(deleted_at);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_created_at ON risk_appetite(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_updated_at ON risk_appetite(updated_at);
CREATE INDEX IF NOT EXISTS idx_risk_appetite_deleted_at ON risk_appetite(deleted_at);
CREATE INDEX IF NOT EXISTS idx_risk_asset_created_at ON risk_asset(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_control_created_at ON risk_control(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_framework_mapping_created_at ON risk_framework_mapping(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_created_at ON risk_treatment(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_updated_at ON risk_treatment(updated_at);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_deleted_at ON risk_treatment(deleted_at);
CREATE INDEX IF NOT EXISTS idx_simulation_result_created_at ON simulation_result(created_at);
CREATE INDEX IF NOT EXISTS idx_process_created_at ON process(created_at);
CREATE INDEX IF NOT EXISTS idx_process_updated_at ON process(updated_at);
CREATE INDEX IF NOT EXISTS idx_process_deleted_at ON process(deleted_at);
CREATE INDEX IF NOT EXISTS idx_process_control_created_at ON process_control(created_at);
CREATE INDEX IF NOT EXISTS idx_process_step_created_at ON process_step(created_at);
CREATE INDEX IF NOT EXISTS idx_process_step_updated_at ON process_step(updated_at);
CREATE INDEX IF NOT EXISTS idx_process_step_deleted_at ON process_step(deleted_at);
CREATE INDEX IF NOT EXISTS idx_process_step_control_created_at ON process_step_control(created_at);
CREATE INDEX IF NOT EXISTS idx_process_version_created_at ON process_version(created_at);
CREATE INDEX IF NOT EXISTS idx_process_asset_created_at ON process_asset(created_at);
CREATE INDEX IF NOT EXISTS idx_process_document_created_at ON process_document(created_at);
CREATE INDEX IF NOT EXISTS idx_process_step_asset_created_at ON process_step_asset(created_at);
CREATE INDEX IF NOT EXISTS idx_process_comment_created_at ON process_comment(created_at);
CREATE INDEX IF NOT EXISTS idx_process_comment_updated_at ON process_comment(updated_at);
CREATE INDEX IF NOT EXISTS idx_process_comment_deleted_at ON process_comment(deleted_at);
CREATE INDEX IF NOT EXISTS idx_process_review_schedule_created_at ON process_review_schedule(created_at);
CREATE INDEX IF NOT EXISTS idx_process_review_schedule_updated_at ON process_review_schedule(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_created_at ON control(created_at);
CREATE INDEX IF NOT EXISTS idx_control_updated_at ON control(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_deleted_at ON control(deleted_at);
CREATE INDEX IF NOT EXISTS idx_control_test_created_at ON control_test(created_at);
CREATE INDEX IF NOT EXISTS idx_control_test_updated_at ON control_test(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_test_deleted_at ON control_test(deleted_at);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_created_at ON control_test_campaign(created_at);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_updated_at ON control_test_campaign(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_test_campaign_deleted_at ON control_test_campaign(deleted_at);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_deleted_at ON evidence(deleted_at);
CREATE INDEX IF NOT EXISTS idx_finding_created_at ON finding(created_at);
CREATE INDEX IF NOT EXISTS idx_finding_updated_at ON finding(updated_at);
CREATE INDEX IF NOT EXISTS idx_finding_deleted_at ON finding(deleted_at);
CREATE INDEX IF NOT EXISTS idx_document_created_at ON document(created_at);
CREATE INDEX IF NOT EXISTS idx_document_updated_at ON document(updated_at);
CREATE INDEX IF NOT EXISTS idx_document_deleted_at ON document(deleted_at);
CREATE INDEX IF NOT EXISTS idx_document_entity_link_created_at ON document_entity_link(created_at);
CREATE INDEX IF NOT EXISTS idx_document_version_created_at ON document_version(created_at);
CREATE INDEX IF NOT EXISTS idx_catalog_entry_reference_created_at ON catalog_entry_reference(created_at);
CREATE INDEX IF NOT EXISTS idx_catalog_lifecycle_phase_created_at ON catalog_lifecycle_phase(created_at);
CREATE INDEX IF NOT EXISTS idx_control_catalog_created_at ON control_catalog(created_at);
CREATE INDEX IF NOT EXISTS idx_control_catalog_updated_at ON control_catalog(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_catalog_entry_created_at ON control_catalog_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_created_at ON general_catalog_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_updated_at ON general_catalog_entry(updated_at);
CREATE INDEX IF NOT EXISTS idx_general_catalog_entry_deleted_at ON general_catalog_entry(deleted_at);
CREATE INDEX IF NOT EXISTS idx_org_risk_methodology_created_at ON org_risk_methodology(created_at);
CREATE INDEX IF NOT EXISTS idx_org_risk_methodology_updated_at ON org_risk_methodology(updated_at);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_created_at ON risk_catalog(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_updated_at ON risk_catalog(updated_at);
CREATE INDEX IF NOT EXISTS idx_risk_catalog_entry_created_at ON risk_catalog_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_classification_created_at ON asset_classification(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_classification_updated_at ON asset_classification(updated_at);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_entry_created_at ON incident_timeline_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_scenario_created_at ON risk_scenario(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incident_created_at ON security_incident(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incident_updated_at ON security_incident(updated_at);
CREATE INDEX IF NOT EXISTS idx_security_incident_deleted_at ON security_incident(deleted_at);
CREATE INDEX IF NOT EXISTS idx_threat_created_at ON threat(created_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_created_at ON vulnerability(created_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_deleted_at ON vulnerability(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assessment_control_eval_created_at ON assessment_control_eval(created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_control_eval_updated_at ON assessment_control_eval(updated_at);
CREATE INDEX IF NOT EXISTS idx_assessment_risk_eval_created_at ON assessment_risk_eval(created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_risk_eval_updated_at ON assessment_risk_eval(updated_at);
CREATE INDEX IF NOT EXISTS idx_assessment_run_created_at ON assessment_run(created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_run_updated_at ON assessment_run(updated_at);
CREATE INDEX IF NOT EXISTS idx_control_maturity_created_at ON control_maturity(created_at);
CREATE INDEX IF NOT EXISTS idx_management_review_created_at ON management_review(created_at);
CREATE INDEX IF NOT EXISTS idx_management_review_updated_at ON management_review(updated_at);
CREATE INDEX IF NOT EXISTS idx_soa_entry_created_at ON soa_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_soa_entry_updated_at ON soa_entry(updated_at);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_created_at ON bc_exercise(created_at);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_updated_at ON bc_exercise(updated_at);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_created_at ON bc_exercise(created_at);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_updated_at ON bc_exercise(updated_at);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_created_at ON bc_exercise_finding(created_at);
CREATE INDEX IF NOT EXISTS idx_bcp_created_at ON bcp(created_at);
CREATE INDEX IF NOT EXISTS idx_bcp_updated_at ON bcp(updated_at);
CREATE INDEX IF NOT EXISTS idx_bcp_deleted_at ON bcp(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bcp_procedure_created_at ON bcp_procedure(created_at);
CREATE INDEX IF NOT EXISTS idx_bcp_procedure_updated_at ON bcp_procedure(updated_at);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_created_at ON bcp_resource(created_at);
CREATE INDEX IF NOT EXISTS idx_bia_assessment_created_at ON bia_assessment(created_at);
CREATE INDEX IF NOT EXISTS idx_bia_assessment_updated_at ON bia_assessment(updated_at);
CREATE INDEX IF NOT EXISTS idx_bia_process_impact_created_at ON bia_process_impact(created_at);
CREATE INDEX IF NOT EXISTS idx_bia_process_impact_updated_at ON bia_process_impact(updated_at);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_created_at ON bia_supplier_dependency(created_at);
CREATE INDEX IF NOT EXISTS idx_continuity_strategy_created_at ON continuity_strategy(created_at);
CREATE INDEX IF NOT EXISTS idx_continuity_strategy_updated_at ON continuity_strategy(updated_at);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_created_at ON crisis_scenario(created_at);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_updated_at ON crisis_scenario(updated_at);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_created_at ON crisis_team_member(created_at);
CREATE INDEX IF NOT EXISTS idx_essential_process_created_at ON essential_process(created_at);
CREATE INDEX IF NOT EXISTS idx_essential_process_updated_at ON essential_process(updated_at);
CREATE INDEX IF NOT EXISTS idx_data_breach_created_at ON data_breach(created_at);
CREATE INDEX IF NOT EXISTS idx_data_breach_updated_at ON data_breach(updated_at);
CREATE INDEX IF NOT EXISTS idx_data_breach_deleted_at ON data_breach(deleted_at);
CREATE INDEX IF NOT EXISTS idx_data_breach_notification_created_at ON data_breach_notification(created_at);
CREATE INDEX IF NOT EXISTS idx_dpia_created_at ON dpia(created_at);
CREATE INDEX IF NOT EXISTS idx_dpia_updated_at ON dpia(updated_at);
CREATE INDEX IF NOT EXISTS idx_dpia_deleted_at ON dpia(deleted_at);
CREATE INDEX IF NOT EXISTS idx_dpia_measure_created_at ON dpia_measure(created_at);
CREATE INDEX IF NOT EXISTS idx_dpia_risk_created_at ON dpia_risk(created_at);
CREATE INDEX IF NOT EXISTS idx_dsr_created_at ON dsr(created_at);
CREATE INDEX IF NOT EXISTS idx_dsr_updated_at ON dsr(updated_at);
CREATE INDEX IF NOT EXISTS idx_ropa_data_category_created_at ON ropa_data_category(created_at);
CREATE INDEX IF NOT EXISTS idx_ropa_data_subject_created_at ON ropa_data_subject(created_at);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_created_at ON ropa_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_updated_at ON ropa_entry(updated_at);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_deleted_at ON ropa_entry(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ropa_recipient_created_at ON ropa_recipient(created_at);
CREATE INDEX IF NOT EXISTS idx_tia_created_at ON tia(created_at);
CREATE INDEX IF NOT EXISTS idx_tia_updated_at ON tia(updated_at);
CREATE INDEX IF NOT EXISTS idx_tia_deleted_at ON tia(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_updated_at ON audit(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_deleted_at ON audit(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_activity_created_at ON audit_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_checklist_created_at ON audit_checklist(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_checklist_item_created_at ON audit_checklist_item(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_created_at ON audit_evidence(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_plan_created_at ON audit_plan(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_plan_updated_at ON audit_plan(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_plan_item_created_at ON audit_plan_item(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_universe_entry_created_at ON audit_universe_entry(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_universe_entry_updated_at ON audit_universe_entry(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_universe_entry_deleted_at ON audit_universe_entry(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contract_created_at ON contract(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_updated_at ON contract(updated_at);
CREATE INDEX IF NOT EXISTS idx_contract_deleted_at ON contract(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contract_amendment_created_at ON contract_amendment(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_obligation_created_at ON contract_obligation(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_obligation_updated_at ON contract_obligation(updated_at);
CREATE INDEX IF NOT EXISTS idx_contract_sla_created_at ON contract_sla(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_sla_updated_at ON contract_sla(updated_at);
CREATE INDEX IF NOT EXISTS idx_contract_sla_measurement_created_at ON contract_sla_measurement(created_at);
CREATE INDEX IF NOT EXISTS idx_lksg_assessment_created_at ON lksg_assessment(created_at);
CREATE INDEX IF NOT EXISTS idx_lksg_assessment_updated_at ON lksg_assessment(updated_at);
CREATE INDEX IF NOT EXISTS idx_vendor_created_at ON vendor(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_updated_at ON vendor(updated_at);
CREATE INDEX IF NOT EXISTS idx_vendor_deleted_at ON vendor(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_created_at ON vendor_contact(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_updated_at ON vendor_contact(updated_at);
CREATE INDEX IF NOT EXISTS idx_vendor_due_diligence_created_at ON vendor_due_diligence(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_due_diligence_updated_at ON vendor_due_diligence(updated_at);
-- ... 583 more
```
