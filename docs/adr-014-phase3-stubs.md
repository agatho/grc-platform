# ADR-014 Phase 3 — Schema-Stubs fuer bisher nicht exportierte Tabellen

_Generated: 2026-04-18T00:33:57.506Z_

55 Tabellen existieren in `packages/db/drizzle/*.sql`, haben aber keinen `pgTable()`-Export in `packages/db/src/schema/`. Folge: Code kann sie nicht type-safe ansprechen (nur via `db.execute(sql`…`)`), und der Drift-Check (F-18) listet sie als `extraInDb`.

Der auto-generierte Draft liegt in `packages/db/src/schema/_generated_stubs.ts`. Jeden Eintrag reviewen, in die passende Domain-Datei umziehen, FK-References verdrahten, dann aus _generated_stubs.ts loeschen.

## Tabellen

| Tabelle | Source-Migration |
|---|---|
| `ai_authority_communication` | 0085_ai_act_complete.sql |
| `ai_corrective_action` | 0085_ai_act_complete.sql |
| `ai_gpai_model` | 0085_ai_act_full_compliance.sql |
| `ai_incident` | 0085_ai_act_complete.sql |
| `ai_penalty` | 0085_ai_act_complete.sql |
| `ai_prohibited_screening` | 0085_ai_act_complete.sql |
| `ai_provider_qms` | 0085_ai_act_complete.sql |
| `approval_decision` | 0079_round2_features.sql |
| `approval_request` | 0079_round2_features.sql |
| `approval_workflow` | 0079_round2_features.sql |
| `attestation_campaign` | 0080_round3_features.sql |
| `attestation_response` | 0080_round3_features.sql |
| `audit_sample` | 0079_round2_features.sql |
| `board_report` | 0084_round7_financial_reporting.sql |
| `catalog_entry_mapping` | 0075_fix_missing_tables.sql |
| `checklist_instance` | 0080_round3_features.sql |
| `checklist_template` | 0080_round3_features.sql |
| `connector_field_mapping` | 0083_round6_connectors.sql |
| `connector_instance` | 0083_round6_connectors.sql |
| `connector_sync_log` | 0083_round6_connectors.sql |
| `connector_type_definition` | 0083_round6_connectors.sql |
| `consolidation_entry` | 0084_round7_financial_reporting.sql |
| `consolidation_group` | 0084_round7_financial_reporting.sql |
| `content_placeholder` | 0081_round4_data_reporting.sql |
| `content_request` | 0082_round5_collaboration.sql |
| `control_monitoring_result` | 0080_round3_features.sql |
| `control_monitoring_rule` | 0080_round3_features.sql |
| `data_lineage_entry` | 0078_data_lineage.sql |
| `data_lineage_source` | 0078_data_lineage.sql |
| `data_link` | 0081_round4_data_reporting.sql |
| `data_validation_result` | 0081_round4_data_reporting.sql |
| `data_validation_rule` | 0081_round4_data_reporting.sql |
| `erm_sync_config` | 0091_erm_bridge_foundations.sql |
| `esef_filing` | 0084_round7_financial_reporting.sql |
| `eu_taxonomy_assessment` | 0079_round2_features.sql |
| `evidence_request` | 0080_round3_features.sql |
| `exception_report` | 0079_round2_features.sql |
| `inline_comment` | 0082_round5_collaboration.sql |
| `isms_corrective_action` | 0086_isms_corrective_actions.sql |
| `isms_nonconformity` | 0086_isms_corrective_actions.sql |
| `messaging_integration` | 0082_round5_collaboration.sql |
| `module_nav_item` | 0075_fix_missing_tables.sql |
| `narrative_instance` | 0081_round4_data_reporting.sql |
| `narrative_template` | 0081_round4_data_reporting.sql |
| `reminder_rule` | 0082_round5_collaboration.sql |
| `review_cycle` | 0082_round5_collaboration.sql |
| `review_decision` | 0082_round5_collaboration.sql |
| `risk_acceptance` | 0088_risk_acceptance.sql |
| `risk_acceptance_authority` | 0088_risk_acceptance.sql |
| `root_cause_analysis` | 0079_round2_features.sql |
| `sox_scoping` | 0080_round3_features.sql |
| `tag_definition` | 0077_global_tag_system.sql |
| `xbrl_tag` | 0084_round7_financial_reporting.sql |
| `xbrl_tagging_instance` | 0084_round7_financial_reporting.sql |
| `xbrl_taxonomy` | 0084_round7_financial_reporting.sql |