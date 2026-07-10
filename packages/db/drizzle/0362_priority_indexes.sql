-- Migration 0362: priorisierter Index-Batch (127 Indizes).
--
-- Quellen:
--   * docs/perf/missing-indexes-report.md (2026-04-18, 1.738 Kandidaten)
--   * docs/audits/perf-db-index-audit-2026-05-22.md
--   * Live-Abgleich gegen die Dev-DB am 2026-07-10 (pg_constraint/pg_index):
--     62 Tabellen ohne org_id-Index, 435 FK-Spalten ohne Index.
--
-- Bewusst KEIN Vollabbau der 1.738 Kandidaten. Priorisierung:
--   (a) org_id-Spalten ohne fuehrenden Index — RLS prueft app.current_org_id
--       auf JEDER Query dieser Tabellen (62 Indizes).
--   (b) FK-Spalten ohne Index in den heissen Kern-Modulen (risk/control/
--       finding/audit/process/document/work_item/asset/evidence/task/
--       tprm/bcms/dpms/wb) — JOIN-Performance + FK-Cascade-Checks
--       (59 Indizes).
--   (c) Spalten, die nachweislich in where()/orderBy() der API-Routen
--       vorkommen (per Grep verifiziert, Fundstellen im Kommentar)
--       (6 Indizes).
--
-- Bewusst NICHT indexiert:
--   * ~305 created_by/updated_by/deleted_by-Audit-FKs (Report-Prio "Low",
--     kein Route-Filter nutzt sie).
--   * status/state-Spalten (geringe Cardinality) und pauschale
--     created_at-Sortier-Indizes (heisse Faelle bereits in 0348/0350/0352).
--   * FK-Spalten kalter Module (academy, marketplace, xbrl, plugin,
--     portal, scim, eam, copilot, bi, bowtie, fair, region/sovereignty).
--   * module_config.module_key — durch module_config_org_module_uq
--     ausreichend abgedeckt.
--
-- Kein CONCURRENTLY: der Runner (packages/db/src/migrate-all.ts) wickelt
-- jede Datei in client.begin(...) — CREATE INDEX CONCURRENTLY ist in
-- Transaktionen unzulaessig. Trade-off wie in 0348 dokumentiert
-- (ADR-014): kurzer Write-Lock pro Tabelle ist bei den aktuellen
-- Tabellengroessen akzeptabel. Sollte eine Instanz mit sehr grossen
-- Tabellen migrieren, diesen Batch manuell ausserhalb der Migration mit
-- CONCURRENTLY einspielen und die Datei als applied markieren.
--
-- Alle Statements idempotent (IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- (a) org_id — RLS-Filterspalten ohne fuehrenden org_id-Index (62)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_approval_workflow_org_id ON approval_workflow (org_id);
CREATE INDEX IF NOT EXISTS idx_asset_cia_profile_org_id ON asset_cia_profile (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource_allocation_org_id ON audit_resource_allocation (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_time_entry_org_id ON audit_time_entry (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_working_paper_org_id ON audit_working_paper (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_wp_folder_org_id ON audit_wp_folder (org_id);
CREATE INDEX IF NOT EXISTS idx_auditor_profile_org_id ON auditor_profile (org_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_org_id ON bc_exercise_finding (org_id);
CREATE INDEX IF NOT EXISTS idx_bcp_procedure_org_id ON bcp_procedure (org_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_org_id ON bcp_resource (org_id);
CREATE INDEX IF NOT EXISTS idx_bia_process_impact_org_id ON bia_process_impact (org_id);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_org_id ON bia_supplier_dependency (org_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_org_id ON checklist_template (org_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_entry_org_id ON consolidation_entry (org_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_group_org_id ON consolidation_group (org_id);
CREATE INDEX IF NOT EXISTS idx_continuity_strategy_org_id ON continuity_strategy (org_id);
CREATE INDEX IF NOT EXISTS idx_continuous_audit_result_org_id ON continuous_audit_result (org_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendment_org_id ON contract_amendment (org_id);
CREATE INDEX IF NOT EXISTS idx_contract_sla_org_id ON contract_sla (org_id);
CREATE INDEX IF NOT EXISTS idx_contract_sla_measurement_org_id ON contract_sla_measurement (org_id);
CREATE INDEX IF NOT EXISTS idx_control_monitoring_rule_org_id ON control_monitoring_rule (org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_log_org_id ON crisis_log (org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_org_id ON crisis_scenario (org_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_org_id ON crisis_team_member (org_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_result_org_id ON data_validation_result (org_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_rule_org_id ON data_validation_rule (org_id);
CREATE INDEX IF NOT EXISTS idx_eam_object_suggestion_org_id ON eam_object_suggestion (org_id);
CREATE INDEX IF NOT EXISTS idx_emission_factor_org_id ON emission_factor (org_id);
CREATE INDEX IF NOT EXISTS idx_esg_collection_assignment_org_id ON esg_collection_assignment (org_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_activity_org_id ON external_auditor_activity (org_id);
CREATE INDEX IF NOT EXISTS idx_external_auditor_share_org_id ON external_auditor_share (org_id);
CREATE INDEX IF NOT EXISTS idx_inline_comment_org_id ON inline_comment (org_id);
CREATE INDEX IF NOT EXISTS idx_materiality_iro_org_id ON materiality_iro (org_id);
CREATE INDEX IF NOT EXISTS idx_materiality_stakeholder_engagement_org_id ON materiality_stakeholder_engagement (org_id);
CREATE INDEX IF NOT EXISTS idx_process_asset_org_id ON process_asset (org_id);
CREATE INDEX IF NOT EXISTS idx_process_conformance_result_org_id ON process_conformance_result (org_id);
CREATE INDEX IF NOT EXISTS idx_process_document_org_id ON process_document (org_id);
CREATE INDEX IF NOT EXISTS idx_process_event_org_id ON process_event (org_id);
CREATE INDEX IF NOT EXISTS idx_process_kpi_measurement_org_id ON process_kpi_measurement (org_id);
CREATE INDEX IF NOT EXISTS idx_process_mining_suggestion_org_id ON process_mining_suggestion (org_id);
CREATE INDEX IF NOT EXISTS idx_process_step_asset_org_id ON process_step_asset (org_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_relevance_score_org_id ON regulatory_relevance_score (org_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rule_org_id ON reminder_rule (org_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle_org_id ON review_cycle (org_id);
CREATE INDEX IF NOT EXISTS idx_risk_evaluation_log_org_id ON risk_evaluation_log (org_id);
CREATE INDEX IF NOT EXISTS idx_search_index_org_id ON search_index (org_id);
CREATE INDEX IF NOT EXISTS idx_supplier_esg_corrective_action_org_id ON supplier_esg_corrective_action (org_id);
CREATE INDEX IF NOT EXISTS idx_technology_application_link_org_id ON technology_application_link (org_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_role_org_id ON user_custom_role (org_id);
CREATE INDEX IF NOT EXISTS idx_user_nav_preference_org_id ON user_nav_preference (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contact_org_id ON vendor_contact (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_due_diligence_org_id ON vendor_due_diligence (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_risk_assessment_org_id ON vendor_risk_assessment (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecard_history_org_id ON vendor_scorecard_history (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sla_measurement_org_id ON vendor_sla_measurement (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_notification_org_id ON vendor_sub_processor_notification (org_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_evidence_org_id ON wb_case_evidence (org_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_message_org_id ON wb_case_message (org_id);
CREATE INDEX IF NOT EXISTS idx_wb_interview_org_id ON wb_interview (org_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_activity_org_id ON wb_ombudsperson_activity (org_id);
CREATE INDEX IF NOT EXISTS idx_wb_ombudsperson_assignment_org_id ON wb_ombudsperson_assignment (org_id);
CREATE INDEX IF NOT EXISTS idx_work_item_link_org_id ON work_item_link (org_id);

-- ---------------------------------------------------------------------------
-- (b) FK-Spalten ohne Index — heisse Kern-Module (59)
-- ---------------------------------------------------------------------------

-- Audit-Management
CREATE INDEX IF NOT EXISTS idx_approval_request_workflow_id ON approval_request (workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_result_import_id ON audit_analytics_result (import_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_evidence_id ON audit_evidence (evidence_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan_item_universe_entry_id ON audit_plan_item (universe_entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_wp_review_note_reply_review_note_id ON audit_wp_review_note_reply (review_note_id);
CREATE INDEX IF NOT EXISTS idx_audit_work_item_id ON audit (work_item_id);

-- BCMS
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_exercise_id ON bc_exercise_finding (exercise_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_finding_finding_id ON bc_exercise_finding (finding_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_bcp_id ON bc_exercise (bcp_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_crisis_scenario_id ON bc_exercise (crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_bc_exercise_work_item_id ON bc_exercise (work_item_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_asset_id ON bcp_resource (asset_id);
CREATE INDEX IF NOT EXISTS idx_bcp_resource_bcp_id ON bcp_resource (bcp_id);
CREATE INDEX IF NOT EXISTS idx_bcp_work_item_id ON bcp (work_item_id);
CREATE INDEX IF NOT EXISTS idx_bia_supplier_dependency_bia_process_impact_id ON bia_supplier_dependency (bia_process_impact_id);
CREATE INDEX IF NOT EXISTS idx_crisis_log_crisis_scenario_id ON crisis_log (crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_crisis_scenario_bcp_id ON crisis_scenario (bcp_id);
CREATE INDEX IF NOT EXISTS idx_crisis_team_member_crisis_scenario_id ON crisis_team_member (crisis_scenario_id);
CREATE INDEX IF NOT EXISTS idx_essential_process_bia_assessment_id ON essential_process (bia_assessment_id);
CREATE INDEX IF NOT EXISTS idx_essential_process_process_id ON essential_process (process_id);

-- Contracts / DMS
CREATE INDEX IF NOT EXISTS idx_contract_amendment_document_id ON contract_amendment (document_id);
CREATE INDEX IF NOT EXISTS idx_contract_document_id ON contract (document_id);
CREATE INDEX IF NOT EXISTS idx_contract_work_item_id ON contract (work_item_id);
CREATE INDEX IF NOT EXISTS idx_document_work_item_id ON document (work_item_id);

-- ICS / Controls
CREATE INDEX IF NOT EXISTS idx_control_effectiveness_score_control_id ON control_effectiveness_score (control_id);
CREATE INDEX IF NOT EXISTS idx_control_test_task_id ON control_test (task_id);
CREATE INDEX IF NOT EXISTS idx_control_work_item_id ON control (work_item_id);
CREATE INDEX IF NOT EXISTS idx_finding_task_id ON finding (task_id);
CREATE INDEX IF NOT EXISTS idx_finding_work_item_id ON finding (work_item_id);
CREATE INDEX IF NOT EXISTS idx_soa_ai_suggestion_suggested_control_id ON soa_ai_suggestion (suggested_control_id);

-- ISMS
CREATE INDEX IF NOT EXISTS idx_cve_asset_match_asset_id ON cve_asset_match (asset_id);
CREATE INDEX IF NOT EXISTS idx_security_incident_work_item_id ON security_incident (work_item_id);
CREATE INDEX IF NOT EXISTS idx_threat_catalog_entry_id ON threat (catalog_entry_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_mitigation_control_id ON vulnerability (mitigation_control_id);

-- ERM
CREATE INDEX IF NOT EXISTS idx_emerging_risk_promoted_to_risk_id ON emerging_risk (promoted_to_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_interconnection_target_risk_id ON risk_interconnection (target_risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_prediction_alert_prediction_id ON risk_prediction_alert (prediction_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatment_work_item_id ON risk_treatment (work_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_work_item_id ON risk (work_item_id);

-- DPMS
CREATE INDEX IF NOT EXISTS idx_data_breach_work_item_id ON data_breach (work_item_id);
CREATE INDEX IF NOT EXISTS idx_dpia_work_item_id ON dpia (work_item_id);
CREATE INDEX IF NOT EXISTS idx_dsr_work_item_id ON dsr (work_item_id);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_controller_org_id ON ropa_entry (controller_org_id);
CREATE INDEX IF NOT EXISTS idx_ropa_entry_work_item_id ON ropa_entry (work_item_id);
CREATE INDEX IF NOT EXISTS idx_tia_work_item_id ON tia (work_item_id);

-- TPRM / Due Diligence (Supplier-Portal-Hot-Path, vgl. Audit F-04)
CREATE INDEX IF NOT EXISTS idx_dd_evidence_question_id ON dd_evidence (question_id);
CREATE INDEX IF NOT EXISTS idx_dd_response_question_id ON dd_response (question_id);
CREATE INDEX IF NOT EXISTS idx_dd_session_due_diligence_id ON dd_session (due_diligence_id);
CREATE INDEX IF NOT EXISTS idx_dd_session_template_id ON dd_session (template_id);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecard_history_scorecard_id ON vendor_scorecard_history (scorecard_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sub_processor_notification_vendor_id ON vendor_sub_processor_notification (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_work_item_id ON vendor (work_item_id);

-- ESG (Control-Verknuepfung in den ICS-Querverweis)
CREATE INDEX IF NOT EXISTS idx_esg_control_link_control_id ON esg_control_link (control_id);

-- Whistleblowing
CREATE INDEX IF NOT EXISTS idx_wb_case_evidence_report_id ON wb_case_evidence (report_id);
CREATE INDEX IF NOT EXISTS idx_wb_case_report_id ON wb_case (report_id);

-- Tasks / Work Items / Notifications
CREATE INDEX IF NOT EXISTS idx_grc_time_entry_task_id ON grc_time_entry (task_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_device_id ON push_notification (device_id);
CREATE INDEX IF NOT EXISTS idx_task_work_item_id ON task (work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_emergency_plan_id ON work_item (emergency_plan_id);

-- ---------------------------------------------------------------------------
-- (c) Verifizierte where()/orderBy()-Spalten aus API-Routen (6)
-- ---------------------------------------------------------------------------

-- work_item.type_key: eq(workItem.typeKey, ...) in work-items/route.ts,
-- work-items/[id]/route.ts, work-items/[id]/links/route.ts,
-- assets/[id]/work-items/route.ts (6 Fundstellen)
CREATE INDEX IF NOT EXISTS idx_work_item_type_key ON work_item (type_key);
-- control_test.tester_id: eq(controlTest.testerId, ...) — "meine Tests"
CREATE INDEX IF NOT EXISTS idx_control_test_tester_id ON control_test (tester_id);
-- evidence.uploaded_by: eq(evidence.uploadedBy, ...)
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence (uploaded_by);
-- wb_case.assigned_to: eq(wbCase.assignedTo, ...)
CREATE INDEX IF NOT EXISTS idx_wb_case_assigned_to ON wb_case (assigned_to);
-- process.reviewer_id: eq(process.reviewerId, ...) (Review-Reminder)
CREATE INDEX IF NOT EXISTS idx_process_reviewer_id ON process (reviewer_id);
-- contract_obligation.responsible_id: eq(contractObligation.responsibleId, ...)
CREATE INDEX IF NOT EXISTS idx_contract_obligation_responsible_id ON contract_obligation (responsible_id);
