# Feature-Catalog

> **[ARCTOS-FULL-2026-08-31 / WP12 · S14-23] Korrekturlauf 2026-09-01.**
> Dieses Dokument stand in mehreren Punkten im direkten Widerspruch zu
> `CLAUDE.md` und zu `docs/STATUS.md` — 31 gegen 46 Frameworks, 401 gegen ~960
> Mappings, 160 gegen 99 gegen 111 TypeScript-Fehler —, und es führte ein
> vorhandenes Feature als fehlend (`docs/openapi.yaml` existiert seit Monaten).
> Ein Häkchen in der Sprint-Tabelle heißt ab jetzt: der Code ist da **und** tut,
> was der Name sagt. Wo das nicht zutrifft, steht es hier.

_Übersicht aller Module + Status. Stand: 2026-04-18 nach ADR-014 Phase 1+2._

## 10 Management-System-Gruppen (Sidebar)

| #   | Key               | Label                      | Module                                                                                                                                                                                                      | Stand |
| --- | ----------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `erm`             | Enterprise Risk Management | risks, kris, groups, appetite, fair, rcsa, predictive, heatmap, budget                                                                                                                                      | ✅    |
| 2   | `isms`            | Information Security       | isms, assets, protection-needs, threats, vulns, incidents, assessments, maturity, soa, cap, reviews, posture, certs, cve, playbooks, nis2, dora, ai-act                                                     | ✅    |
| 3   | `icsAudit`        | Controls & Audit           | controls, test-campaigns, control-findings, rcm, evidence, audit-universe, audit-plans, audit-executions, audit-findings (redirect), catalogs                                                               | ✅    |
| 4   | `bcms`            | Business Continuity        | bcms, bia, bcp, crisis, strategies, exercises, resilience                                                                                                                                                   | ✅    |
| 5   | `dpms`            | Data Protection            | privacy, ropa, dpia, dsr, breaches, tia, consent, retention                                                                                                                                                 | ✅    |
| 6   | `tprmContracts`   | Third Parties & Contracts  | tprm, vendors, lksg, scorecards, concentration, contracts, obligations, sla                                                                                                                                 | ✅    |
| 7   | `bpmArchitecture` | Processes & Architecture   | processes, governance, mining, kpis, maturity, eam, diagrams, capabilities, apps, tech-radar, data-flows, ea-governance, documents                                                                          | ✅    |
| 8   | `esg`             | ESG & Sustainability       | esg, materiality, datapoints, metrics, emissions, targets, report, tax-cms                                                                                                                                  | ✅    |
| 9   | `whistleblowing`  | Whistleblowing             | cases, statistics — **isolated, role-locked**                                                                                                                                                               | ✅    |
| 10  | `platform`        | Platform                   | dashboard, calendar, reports, copilot, marketplace, extensions, academy, import, executive, graph, search, regulatory, compliance-culture, assurance, settings, orgs, users, modules, audit-log, access-log | ✅    |

## Core Sprint Modules (1-9)

| Sprint | Modul                      | Status | Kernentitäten                                                            |
| ------ | -------------------------- | ------ | ------------------------------------------------------------------------ |
| 1      | Foundation                 | ✅     | organization, user, user_organization_role, audit_log, notification      |
| 1.2    | Task/Workflow + Email      | ✅     | task, task_comment                                                       |
| 1.3    | Module System              | ✅     | module_definition, module_config                                         |
| 1.4    | Assets + Work Items        | ✅     | asset, work_item, work_item_type, work_item_link                         |
| 2      | ERM (Risk Register + KRI)  | ✅     | risk, risk_assessment, risk_treatment, kri, risk_asset                   |
| 3      | BPMN Process Modeling      | ✅     | process, process_version, process_step, process_control                  |
| 4      | ICS + DMS                  | ✅     | control, control_test, finding, evidence, document                       |
| 4b     | Catalog & Framework        | ✅     | catalog, catalog_entry, org_active_catalog, org_risk_methodology         |
| 5a     | ISMS Assets + Incidents    | ✅     | protection_requirement, threat, vulnerability, incident                  |
| 5b     | ISMS Assessment + Maturity | ✅     | assessment_run, control_maturity, soa_entry, management_review           |
| 6      | BCMS                       | ✅     | bia_assessment, bcp, crisis_scenario, bc_exercise, continuity_strategy   |
| 7      | DPMS                       | ✅     | ropa_entry, dpia, dpia_risk, dpia_measure, dsr, data_breach, tia         |
| 8      | Audit Management           | ✅     | audit_universe_entry, audit_plan, audit, audit_checklist, audit_evidence |
| 9      | TPRM + Contracts           | ✅     | vendor, contract, contract_sla, vendor_due_diligence, lksg_assessment    |

## Extended Platform (Sprints 10-86)

| Range | Features                                                                                | Status                                                                                                                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10–15 | Module-System, Assets, Work-Items                                                       | ✅                                                                                                                                                                                                                                                              |
| 16–19 | Incident-Playbooks, Compliance-Calendar, Dashboards, Bulk-Import/Export                 | ✅                                                                                                                                                                                                                                                              |
| 20–23 | SSO/SCIM, Multi-Language-CMS, Where-Used, Risk-Appetite                                 | ✅                                                                                                                                                                                                                                                              |
| 24–27 | NIS2-Tracker, FAIR, ISMS-Intelligence, Compliance-Culture                               | ✅                                                                                                                                                                                                                                                              |
| 28–30 | Workflow-Automation, Knowledge-Graph, Report-Engine                                     | ✅                                                                                                                                                                                                                                                              |
| 31–33 | Regulatory-Simulator, Risk-Propagation, Audit-Analytics                                 | ✅                                                                                                                                                                                                                                                              |
| 34–37 | ABAC, GRC-Agents (MCP), EAM Foundation + Advanced                                       | ✅                                                                                                                                                                                                                                                              |
| 38–42 | Platform/ERM/ICS/BCMS/DPMS Advanced                                                     | ✅                                                                                                                                                                                                                                                              |
| 43–47 | Audit/TPRM/ESG/Whistleblowing/BPM Advanced                                              | ✅                                                                                                                                                                                                                                                              |
| 48–53 | EAM Dashboards, Visualizations, Data Architecture, AI, Catalog, Governance              | ✅                                                                                                                                                                                                                                                              |
| 54–56 | ERM Evaluation UX, GRC UX Enhancements, BPM Derived Views                               | ✅                                                                                                                                                                                                                                                              |
| 57–61 | API Platform, Plugin Architecture, Onboarding, Mobile, SaaS Metering                    | ✅                                                                                                                                                                                                                                                              |
| 62–66 | Evidence Connectors, Cloud/Identity/DevOps Connectors, Cross-Framework Mapping          | ⚠️ **Teilweise.** Schema, UI und API vorhanden; die Test-, Sync- und Health-Läufe erfanden bis 2026-09-01 ihre Ergebnisse und persistierten sie als Evidenz (S14-02, behoben durch WP9). Die Framework-Coverage-Heatmap zeigte Zufallszahlen (S14-01, behoben). |
| 67–71 | GRC Copilot, AI Evidence Review, Regulatory Change, Control Testing, Predictive Risk    | ⚠️ **Copilot seit WP6 echt.** Die GRC-Agents (MCP) aus der Sprint-34–37-Zeile sind **nicht** implementiert: MCP kommt im Code nicht vor, und `agents/[id]/run` liefert konstruktionsbedingt leere Empfehlungen (S05-17, S14-23/B8).                             |
| 72–76 | DORA, EU AI Act, Tax CMS, Horizon Scanner, Cert Wizard                                  | ✅ Code; DB seit ADR-014 Phase 2                                                                                                                                                                                                                                |
| 77–81 | BI Report Builder, Benchmarking, Risk Quantification, Data Sovereignty, Role Dashboards | ✅                                                                                                                                                                                                                                                              |
| 82–86 | Marketplace, Stakeholder Portals, GRC Academy, Simulation Engine, Community Edition     | ✅                                                                                                                                                                                                                                                              |

## Cross-Cutting (post-Sprint 86)

| Feature                                                                                 | Status                            |
| --------------------------------------------------------------------------------------- | --------------------------------- |
| Accordion-Sidebar + Horizontal Tab-Nav (118→35 items)                                   | ✅                                |
| EU AI Act Full Compliance (13 DB tables, 14 pages)                                      | ✅                                |
| ISMS IS-Risikoszenarien (ISO 27005)                                                     | ✅                                |
| ISMS CAP-Modul (ISO 27001 Kap. 10)                                                      | ✅                                |
| Risk Acceptance (ISO 27005 Kap. 10)                                                     | ✅                                |
| ISO 27005 Kataloge (31 Bedrohungen + 23 Schwachstellen)                                 | ✅                                |
| SoA mit 93 Annex A Kontrollen                                                           | ✅                                |
| Hierarchical Budget Model + Cost Fields                                                 | ✅                                |
| 46 Catalog Frameworks (`ls packages/db/sql/seed_catalog_*.sql`, 2026-09-01)             | ✅                                |
| Cross-Framework Mappings (Zahl nur in der DB belastbar, s. u.)                          | ✅                                |
| Normenbasierte Testpläne (ISO 27001/31000, COSO/IIA, ISO 22301, DSGVO, ISO 27036, CSRD) | ✅                                |
| **Audit-ERM Feedback-Loop**                                                             | ✅ Iter 1-3 (2026-04-18)          |
| **Schema-Drift-Health-Check**                                                           | ✅ F-18 (2026-04-17)              |
| **Audit-Trail Hash-Chain Integrity**                                                    | ✅ 2026-04-18                     |
| **RLS + Audit-Trigger Coverage-Audit-Tool**                                             | ✅ 2026-04-18                     |
| **Off-Site-Backup (B2)**                                                                | ⏸ Proposed ADR-015, Setup manuell |

## Outstanding / Known Gaps

| Gap                                             | Severity | Owner / ADR                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~132 Tables ohne RLS-Policy~~                  | —        | **Widersprach `docs/STATUS.md`** (dort seit 2026-07-20: 0 RLS_MISSING). Maßgeblich ist der RLS-Coverage-Report; diese Zeile war eine veraltete statische Analyse.                                                                                                                                                   |
| ~~52 Tables ohne audit_trigger~~                | —        | dito — `docs/STATUS.md`: AUDIT_MISSING 0, 4 dokumentierte Ausnahmen.                                                                                                                                                                                                                                                |
| 83 extra DB-Tabellen ohne Drizzle-Schema-Export | P2       | ADR-014 Phase 3 (Schema-Export nachziehen)                                                                                                                                                                                                                                                                          |
| ~~Copilot nicht vernetzt~~                      | —        | **Seit WP6 vernetzt**: echter, richtliniengebundener Aufruf mit RAG-Kontext statt eines Echos der Nutzereingabe. Diese Zeile stand im direkten Widerspruch zum Häkchen für Sprint 67–71 in `CLAUDE.md`, das seinerseits nicht stimmte (S14-23/B12).                                                                 |
| ~~160 pre-existing TypeScript errors~~          | —        | **0 in allen 12 Workspaces** (2026-09-01). Für dieselbe Größe waren drei Zahlen im Umlauf: 160 hier, 99 in `docs/STATUS.md`, 111 in `docs/perf/ts-errors-report.md` (S14-23/A21–A23). CI prüft jetzt jedes Paket; die bewusst abgeschalteten Strengeflags sind in `packages/*/tsconfig.json` mit Zahl dokumentiert. |
| ~~OpenAPI 3.1 Spec nicht generiert~~            | —        | **Falsch — sie existiert.** `docs/openapi.yaml`, erzeugt von `scripts/generate-openapi.mjs`, 1,4 MB, über 1.300 Pfade. Seit 2026-09-01 zusätzlich `docs/API_REFERENCE.md`, ebenfalls generiert. (S14-23/B11 — inverse Drift: ein vorhandenes Feature als fehlend geführt.)                                          |

## Integration-Status nach Framework

| Framework              | Katalog         | Audit-Checklist | KRI | Dashboard   |
| ---------------------- | --------------- | --------------- | --- | ----------- |
| ISO 27001:2022 Annex A | ✅ 97 Einträge  | ✅ generierbar  | ✅  | ✅          |
| ISO 27002:2022         | ✅ 97 Einträge  | ✅              | ✅  | ✅          |
| CIS Controls v8        | ✅ 35 Einträge  | ✅              | ✅  | ✅          |
| NIST CSF 2.0           | ✅ 131 Einträge | ✅              | ✅  | ✅          |
| BSI IT-Grundschutz     | ✅ 160 Einträge | ✅              | ✅  | ✅          |
| TISAX / VDA ISA 6.0    | ✅ 110 Einträge | ✅              | ✅  | ✅          |
| EU DORA (2022/2554)    | ✅ 53 Einträge  | ✅              | ✅  | ✅          |
| EU NIS2 (2022/2555)    | ✅ 50 Einträge  | ✅              | ✅  | ✅          |
| EU AI Act (2024/1689)  | ✅ 63 Einträge  | ✅              | ✅  | ✅ 14 Pages |
| EU GDPR (2016/679)     | ✅ 106 Einträge | ✅              | ✅  | ✅          |
| EU CSRD / ESRS         | ✅ 96 Einträge  | ✅              | ✅  | ✅          |
| ISO 22301:2019 BCMS    | ✅ 32 Einträge  | ✅              | ✅  | ✅          |
| COSO ERM 2017          | ✅ 25 Einträge  | ✅              | ✅  | ✅          |
| COBIT 2019             | ✅ 45 Einträge  | ✅              | ✅  | ✅          |
| IDW PS 980/981/982/986 | ✅ 30 Einträge  | ✅              | ✅  | ✅          |
| IIA Standards 2024     | ✅ 34 Einträge  | ✅              | ✅  | ✅          |
| ISAE 3402 / SOC 2      | ✅ 51 Einträge  | ✅              | ✅  | ✅          |
| OWASP ASVS 4.0.3       | ✅ 106 Einträge | ✅              | ✅  | ✅          |

Cross-framework mappings: siehe `packages/db/sql/seed_cross_framework_mappings*.sql`.

> **[WP12 · S14-23/A15]** Hier stand 401, in `CLAUDE.md` rund 960 — für dieselbe
> Größe, Faktor 2,4 auseinander, und keine der beiden Zahlen war aus dem
> Repository reproduzierbar. Eine dritte Schätzung wäre keine Verbesserung. Wer
> die Zahl braucht, zählt sie in der Datenbank:
> `SELECT count(*) FROM cross_framework_mapping;`
