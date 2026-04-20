# ADR-014 Phase 3 — Abgeschlossen (2026-04-18)

55 Tabellen aus `packages/db/drizzle/*.sql` sind jetzt in 11 Domain-
Dateien integriert und ueber `packages/db/src/index.ts` exportiert. Damit
ist die Schema-Luecke (F-18 `extraInDb`) fuer diese Tabellen geschlossen.

## Domain-Files (neu)

| Datei                   | Tabellen                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-act-extended.ts`    | ai_gpai_model, ai_incident, ai_corrective_action, ai_authority_communication, ai_penalty, ai_prohibited_screening, ai_provider_qms          |
| `approval-workflow.ts`  | approval_workflow, approval_request, approval_decision, review_cycle, review_decision, attestation_campaign, attestation_response           |
| `audit-extras.ts`       | audit_sample, board_report, exception_report                                                                                                |
| `checklist.ts`          | checklist_template, checklist_instance                                                                                                      |
| `connector.ts`          | connector_type_definition, connector_instance, connector_field_mapping, connector_sync_log                                                  |
| `content-narrative.ts`  | content_placeholder, content_request, narrative_template, narrative_instance                                                                |
| `control-monitoring.ts` | control_monitoring_rule, control_monitoring_result                                                                                          |
| `data-governance.ts`    | data_lineage_source, data_lineage_entry, data_link, data_validation_rule, data_validation_result                                            |
| `esef-xbrl.ts`          | xbrl_taxonomy, xbrl_tag, xbrl_tagging_instance, esef_filing, consolidation_group, consolidation_entry, eu_taxonomy_assessment               |
| `isms-cap.ts`           | isms_nonconformity, isms_corrective_action, root_cause_analysis                                                                             |
| `risk-acceptance.ts`    | risk_acceptance, risk_acceptance_authority, erm_sync_config                                                                                 |
| `phase3-extras.ts`      | catalog_entry_mapping, evidence_request, inline_comment, messaging_integration, module_nav_item, reminder_rule, sox_scoping, tag_definition |

Summe: 7+7+3+2+4+4+2+5+7+3+3+8 = **55 Tabellen** ✅

## FK-Wireup

Wo die Ziel-Tabelle im Schema existiert, wurden echte
`.references(() => ...)`-Calls eingesetzt. Importe aus:

- `platform.ts` (organization, user)
- `ai-act.ts` (aiSystem)
- `catalog.ts` (catalogEntry)
- `module.ts` (moduleDefinition)
- `control.ts` (control, evidence)
- `audit-mgmt.ts` (audit)
- `document.ts` (document)
- `risk.ts` (risk)
- Intra-File-Refs (z. B. ai_incident → ai_gpai_model)

Self-Referentials (`xbrl_tag.parent_id`, `inline_comment.parent_id`)
nutzen `AnyPgColumn` Forward-Reference-Pattern.

## Abgrenzung

- `ai_prohibited_screening.has_prohibited_practice` ist in der DB eine
  `BOOLEAN GENERATED ALWAYS AS (OR der 8 Booleans) STORED`-Spalte.
  Drizzle kann sie nicht schreiben -- im Code beim INSERT weglassen.
- `ai_penalty.imposed_at DEFAULT CURRENT_DATE` und einige andere
  PostgreSQL-spezifische Defaults muessen beim Insert explizit gesetzt
  werden (Drizzle-kit generiert sie nicht auto).
- `tags TEXT[]`-Spalten (in isms_nonconformity, isms_corrective_action)
  werden als `jsonb` typisiert -- Drizzle-Clients muessen an DB-Seite
  auf Array-Kompatibilitaet achten.

## Nicht erledigt

- Relations-Blocks (`relations(x, ({ one, many }) => ({ ... }))`) fuer
  die Phase-3-Tabellen -- der Drizzle-Query-Builder kann sie auch ohne
  nutzen, aber zur Komfort-Verbesserung sollten sie nachgereicht werden,
  wenn die erste echte Consumer-Route entsteht
- `audit_trigger` und RLS-Policies fuer die 55 Tabellen -- die sind in
  den ursprungs-Migrationen bereits enthalten, aber `scripts/audit-rls-coverage.mjs`
  sollte gegen-pruefen und ggf. ADR-014-Follow-up-Migration (0105\_\*) schreiben

## Generator-Script

`scripts/generate-schema-stubs.mjs` bleibt als Werkzeug. Wenn in Zukunft
eine neue Tabelle ueber drizzle-kit generiert wird, ohne dass das
zugehoerige `pgTable()` im TS-Schema-File existiert, liefert es einen
Start-Draft zum Ueberarbeiten. Der Stub-Output wird bewusst NICHT ins
Repo committed -- Review + Integration soll sofort passieren, nicht "irgendwann spaeter".
