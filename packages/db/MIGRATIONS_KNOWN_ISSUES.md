# Migrations — Bekannte Schema-Drift-Altlasten

Stand: 2026-04-20 nach der Konsolidierung der beiden Migrationsordner. Dieser Report listet die Migrationen, die beim frischen `migrate-all`-Lauf nach drei Pässen noch fehlschlagen, kategorisiert nach Ursache. Jeder Eintrag ist ein **eigenes Ticket**, nicht ein Stub — der Fix erfordert pro-Datei-Archäologie.

Das Gesamtbild: Von 79 fehlschlagenden Migrationen (Stand 2026-04-20 früh) sind nach Bereinigung von Duplikaten, Index-Namens-Kollisionen, enum/type-Konflikten und schema-drift-Fixes noch **37 übrig**. Die DB wächst von 416 auf **483 Tabellen** — die verbleibenden 37 Migrationen erstellen überwiegend Nebenprodukte (Seeds, bridges) oder alter-Operationen auf Schemata, die seither umstrukturiert wurden.

## Kategorie A — Seed-Data-FK-Violations (6 Dateien)

Ursache: Die Migration versucht Demo-/Referenzdaten zu INSERT'en, die einen `org_id` verwenden, der in diesem Stand nicht existiert. Der Seed-Referenz-`org_id` war in einer älteren Seed-Pipeline fest.

| Datei                                            | Betroffene Tabelle                                      |
| ------------------------------------------------ | ------------------------------------------------------- |
| `0086_isms_corrective_actions.sql`               | `isms_nonconformity`                                    |
| `0087_isms_risk_scenarios.sql`                   | `risk_scenario`                                         |
| `0088_risk_acceptance.sql`                       | `risk_acceptance_authority`                             |
| `0091_erm_bridge_foundations.sql`                | `erm_sync_config`                                       |
| `0103_default_kri_templates.sql`                 | `kri` (ungültiges UUID `k1000...`)                      |
| `0104_default_compliance_calendar_templates.sql` | `compliance_calendar_template` (ON CONFLICT-Ziel fehlt) |

**Fix-Pattern**: Entweder Seed-INSERTs entfernen und in den `db:seed`-Scripts platzieren (sauberer), oder `ON CONFLICT DO NOTHING` + `WHERE EXISTS (SELECT 1 FROM organization WHERE id = ...)` vor dem INSERT.

## Kategorie B — Schema-Drift (Spalte existiert nicht, 9 Dateien)

Ursache: Die Migration referenziert einen Spaltennamen, der im aktuellen Schema anders heißt. Typischerweise wurde die Spalte in einer späteren Migration umbenannt oder aufgeteilt.

| Datei                                              | Erwartete Spalte                          | Vermutete aktuelle Entsprechung                     |
| -------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `0025_sprint14_rcsa.sql`                           | `polname`                                 | Interner `pg_policies`-Zugriff, Syntax-Update nötig |
| `0032_sprint20_sso_scim.sql`                       | `module_definition.key`                   | `module_definition.module_key`                      |
| `0039_sprint27_compliance_culture_performance.sql` | `effectiveness_rating`                    | Spalte umbenannt oder entfernt                      |
| `0042`, `0099`, `0100`, `0101` (Report Engine)     | `module_scope`                            | Column wurde in `reporting.ts` nicht übernommen     |
| `0053_sprint41_bcms_advanced.sql`                  | `scheduled_date`                          | Vermutlich `exercise_date` in `bc_exercise`         |
| `0061_sprint49_eam_visualizations.sql`             | `inherent_risk_level`                     | `risk_level` oder `inherent_score`                  |
| `0064_sprint52_eam_catalog.sql`                    | `name`                                    | Auf einer Tabelle die kein `name`-Feld hat          |
| `0071_predictive_risk_tables.sql`                  | `model_type`                              | Siehe `risk_prediction_model` schema                |
| `0092_tcfd_climate_risk_scenario.sql`              | `o.slug`                                  | Vermutlich `o.code` oder kein alias                 |
| `0102_f08_catalog_dedupe.sql`                      | `catalog_entry_reference.source_entry_id` | Tabelle umstrukturiert                              |

**Fix-Pattern**: Pro Datei die Ziel-Spalte identifizieren (Schema vs Migration), ALTER-Statement anpassen.

## Kategorie C — Relation existiert nicht (8 Dateien)

Ursache: Vorausgesetzte Tabelle wurde entweder umbenannt oder ist Teil eines abgebrochenen Features.

| Datei                                     | Erwartete Relation        | Anmerkung                                                |
| ----------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `0029_sprint17_compliance_calendar.sql`   | `rcsa_campaign`           | 0025 sollte diese anlegen, failed zuerst                 |
| `0050_sprint38_platform_advanced.sql`     | `incident`                | Vermutlich `isms_incident`                               |
| `0077_global_tag_system.sql`              | `search_index`            | Nie angelegt                                             |
| `0085_ai_act_complete.sql`                | `ai_gpai_model`           | Nie angelegt (in Schema deklariert aber keine Migration) |
| `0085_ai_act_full_compliance.sql`         | `ai_system`               | Abhängigkeit aus 0085                                    |
| `0090_ai_act_documentation_lifecycle.sql` | `ai_system`               | Abhängigkeit aus 0085                                    |
| `0093_rls_gap_closure.sql`                | `grc_report_template`     | Vermutlich `report_template`                             |
| `0105_phase3_rls_audit_triggers.sql`      | `ai_gpai_model`           | Abhängigkeit aus 0085                                    |
| `0124_seed_isms_bcm_dashboards.sql`       | `dashboard_widget_config` | Feature-Tabelle fehlt                                    |
| `0130_add_emergency_officer.sql`          | `bc_process`              | Abhängigkeit                                             |
| `0279_create_simulation_parameter.sql`    | `simulation_scenario`     | Failure-Kaskade aus 0278                                 |

**Fix-Pattern**: Voraussetzende Tabelle einzeln anlegen (mit Drizzle-Schema-Auszug), danach das Abhängigkeits-Migration rehydrieren.

## Kategorie D — Enum-Value-Mismatch (2 Dateien)

| Datei                                     | Enum                | Fehlender Wert                                                                       |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `0026_sprint15_policy_acknowledgment.sql` | `notification_type` | `system`                                                                             |
| `0096_additional_system_roles.sql`        | `user_role`         | `ciso` (unsichere Verwendung — ALTER TYPE ADD VALUE + Transaktion-Isolation-Problem) |

**Fix-Pattern**: `ALTER TYPE X ADD VALUE IF NOT EXISTS 'y'` in eigener Transaktion _vor_ dem INSERT.

## Kategorie E — Name-Kollision (1 Datei)

| Datei                                   | Problem                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `0046_sprint34_abac_simulation_dmn.sql` | Erstellt `simulation_result`, das bereits von `0006_friendly_the_spike.sql` angelegt wurde. Unterschiedliche Tabellen-Definitionen. |

**Fix**: Entscheiden, welche Definition die gültige ist. Dubletten-Migration um die doppelte CREATE-Anweisung bereinigen.

## Kategorie F — PostgreSQL-Feature fehlt (2 Dateien)

| Datei                           | Abhängigkeit                      | Status                                   |
| ------------------------------- | --------------------------------- | ---------------------------------------- |
| `0136_create_api_usage_log.sql` | TimescaleDB `create_hypertable()` | Extension nicht im Dev-Setup installiert |
| `0153_create_usage_meter.sql`   | TimescaleDB `create_hypertable()` | s.o.                                     |

**Fix**: Entweder TimescaleDB installieren (prod-Empfehlung, ADR-005) oder die `SELECT create_hypertable(...)`-Zeilen bedingt machen (`DO $$ IF ... THEN ... END IF; $$`).

## Kategorie G — Subquery-Cast-Restriction (1 Datei)

| Datei                                      | Problem                                                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0033_sprint21_multi_language_content.sql` | "Unteranfragen können in Umwandlungsausdrücken nicht verwendet werden" — eine CAST-Expression enthält eine SELECT. PostgreSQL 16+ striktere Regeln. |

**Fix**: Subquery in eine CTE auslagern, oder als Spalten-Default evaluieren.

## Was ist bereits gefixt (Overnight 2026-04-20)

Für Kontext — das folgende wurde in der Session _vorher_ bereits gelöst:

- ✅ `src/migrations/` archiviert nach `src/migrations-archive/` mit README
- ✅ 171 Sprint-Migrationen nach `drizzle/0113-0283` übertragen
- ✅ 18 byte-identische Duplikat-Files gelöscht (academy, framework*mapping, ai*\_, simulation\_\_, import_job, risk_appetite_threshold)
- ✅ `migrate-all.ts` mit echter `client.begin()`-Transaktion pro File — keine partielle Anwendung mehr möglich
- ✅ 11 Index-Namens-Kollisionen gefixt (`ar_*` → `agent_registration_*`, `ae_*` → `architecture_element_*` / `academy_enrollment_*`, `ac_*` → `academy_course_*`, `al_*` → `academy_lesson_*`, `cm_*` → `copilot_message_*`, `cte_*` → `control_test_execution_*`, `cts_*` → `control_test_script_*`, `ma_*` → `maturity_assessment_*`, `dr_*`/`rtc_*` → `data_region_*`/`region_tenant_config_*`, `rdc_*` → `role_dashboard_config_*`, `pc_*` → `portal_config_*`)
- ✅ `report_template`-TYPE vs `report_template`-TABLE-Kollision aufgelöst (TYPE in `branding_template_style` umbenannt)
- ✅ `crisis_severity::text`-Cast in 0091, um enum-vs-text Vergleich zu erlauben

## Messgrößen

| Metrik                               | Vorher                                 | Jetzt                    |
| ------------------------------------ | -------------------------------------- | ------------------------ |
| Tables in fresh DB via `migrate-all` | 416 (nur durch manuelles psql möglich) | **483**                  |
| Failing Migrations                   | 79                                     | **37**                   |
| Migrationsordner                     | 2                                      | **1 (drizzle/)**         |
| Byte-identische Duplikat-Files       | 18                                     | 0                        |
| Index-Namens-Kollisionen             | ≥11                                    | 0                        |
| Pipeline-Atomarität                  | ❌ silent errors                       | ✅ per-file transactions |
