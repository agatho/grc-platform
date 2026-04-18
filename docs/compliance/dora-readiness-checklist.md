# DORA (EU 2022/2554) Readiness Checklist

_Digital Operational Resilience Act — gilt seit 17. Januar 2025 für Finanzdienstleister + kritische ICT-Drittanbieter in der EU._

Diese Checkliste operationalisiert die 5 DORA-Pillars auf ARCTOS-Features + -Module. Kategorisiert nach DORA-Artikeln (Art. 5 Governance bis Art. 55 Oversight).

## Pillar 1 — ICT Risk Management (Art. 5-16)

| Art. | Anforderung | ARCTOS-Modul | Status |
|---|---|---|---|
| 5 | ICT Risk Management Framework dokumentiert | ERM + ISMS | ✅ SoA, Risk Register, 93 ISO 27001 Annex A |
| 6 | Rollen für ICT-Risk klar zugewiesen | RBAC (ADR-007) | ✅ `risk_manager`, `ciso`, `control_owner` |
| 7 | Classification assets + business impact | Assets + BIA | ✅ `protection_requirement`, `bia_assessment` |
| 8 | Protection + Prevention Controls dokumentiert | Controls + SoA | ✅ `control`, `soa_entry` |
| 9 | Detection (Anomalies, Threats) | SIEM-Integration, Threat-Feeds | ⚠️ Threat-Feed existiert, SIEM-Hooks tbd |
| 10 | Response + Recovery | Incidents + BCPs | ✅ `incident`, `bcp`, `crisis_scenario` |
| 11 | Testing ICT Risk Management annually | Exercises + Audits | ✅ `bc_exercise`, `audit` with annual plan |
| 12 | Learning (Post-Incident-Review) | Incident + Finding | ✅ `incident_timeline`, `finding` |
| 13 | Communication plans (Stakeholder) | Notifications + Crisis-Comms | ✅ `notification`, `crisis_scenario.communicationPlan` |
| 14 | ICT-related incidents — Policy | Incident-Playbooks | ✅ `incident_playbook` |
| 15 | Information sharing (Threat-Intel) | Threat-Feed-Sources | ✅ `threat_feed_source` |
| 16 | ICT Risk Management Review (Board) | Management Review | ✅ `management_review` |

## Pillar 2 — ICT-related Incident Reporting (Art. 17-23)

| Art. | Anforderung | ARCTOS-Modul | Status |
|---|---|---|---|
| 17 | Incident Classification (Major / Minor) | `incident.severityClassification` | ✅ |
| 18 | Initial Notification < 4h nach awareness | Incident Workflow | ⚠️ Timing-Trigger existiert, Behörden-Export tbd |
| 19 | Intermediate Report < 72h | Incident Status-Transitions | ⚠️ dto |
| 20 | Final Report binnen 1 Monat | Incident Close-Out | ⚠️ dto |
| 21 | Harmonised Reporting Templates (EBA, EIOPA, ESMA) | Reporting Engine | ❌ TBD — DORA-spezifische Templates noch nicht im Catalog |
| 22 | Threat Intelligence Sharing (voluntary) | `threat_feed_source` | ✅ |
| 23 | Follow-up Communications | Crisis-Comms | ✅ |

## Pillar 3 — Digital Operational Resilience Testing (Art. 24-27)

| Art. | Anforderung | ARCTOS-Modul | Status |
|---|---|---|---|
| 24 | Testing Programme (Risk-Based) | Audit-Plans + Test-Campaigns | ✅ `audit_plan`, `control_test_campaign` |
| 25 | Range of Tests (VA, Scenario, TLPT) | Controls + Vulnerability | ✅ vulnerability, scenario_engine (Sprint 85) |
| 26 | Advanced Testing — TLPT (only significant entities) | tbd | ❌ TBD — TLPT-Workflow nicht modelliert |
| 27 | Finding Remediation | Finding + Treatment | ✅ `finding`, `risk_treatment`, F-21 UI |

## Pillar 4 — ICT Third-Party Risk (Art. 28-44)

| Art. | Anforderung | ARCTOS-Modul | Status |
|---|---|---|---|
| 28 | TPRM Strategy + Register of Arrangements | TPRM + Contracts | ✅ `vendor`, `contract` |
| 29 | Pre-contract DD (Criticality Analysis) | Due Diligence | ✅ `vendor_due_diligence` |
| 30 | Contract Provisions (specific DORA clauses) | Contracts | ⚠️ Klausel-Templates fehlen |
| 31 | Register updates + Regulatory-Reporting | `contract` + Report Engine | ⚠️ Report-Template fehlt |
| 32 | Exit Plans for Critical Vendors | Exit-Plans | ✅ `vendor_exit_plan` |
| 33 | Sub-Outsourcing Chain | Sub-Processors | ✅ `sub_processor_agreement` |
| 34-35 | Critical ICT Third-Party Designation + Oversight Framework | EU-Behörden, N/A für Platform | N/A |
| 36-44 | ICT-Third-Party-Oversight (Penalties, Recommendations) | N/A (Behörden) | N/A |

## Pillar 5 — Information Sharing Arrangements (Art. 45)

| Art. | Anforderung | ARCTOS-Modul | Status |
|---|---|---|---|
| 45 | Cyber Threat Information Sharing | Threat-Feeds | ✅ |

## Cross-cutting

| Item | Status | Notiz |
|---|---|---|
| EU DORA Katalog im System | ✅ | 53 Einträge via `seed_catalog_dora.sql` |
| DORA ↔ ISO 27001 Mapping | ✅ | 25 Cross-Framework-Mappings |
| DORA-Dashboard-Seite | ✅ | `/isms/dora` mit Compliance-Scorecard |
| DORA-Reporting-Templates (Art. 21) | ❌ | Harmonisierte EBA/EIOPA/ESMA-Formate tbd |
| TLPT-Workflow (Art. 26) | ❌ | Threat-Led Pen-Testing Nachweis-Flow tbd |
| Sub-Outsourcing-Kette-Visualisierung | ⚠️ | Daten da, UI-Graph fehlt |

## Scoring-Logik für Compliance-Dashboards

```
DORA-Readiness = (Anzahl ✅ / (Anzahl ✅ + Anzahl ⚠️ + Anzahl ❌)) * 100
Current: 22 ✅ / 29 bewertbar ≈ 76%
```

(`N/A` zählt nicht, das sind Behörden-Themen.)

## Gap-Prioritäten

1. **P0 — Art. 21 Reporting-Templates**: harmonized reporting in maschinenlesbarem Format ist DORA-Pflicht-Output. Template-Engine (Sprint 30) kann das tragen, nur fehlt die Template-Definition.
2. **P1 — Art. 30 DORA-Contract-Clauses**: KI-gestützte Klausel-Prüfung existiert (EU AI Act Module), lässt sich auf Contracts übertragen.
3. **P2 — Art. 26 TLPT-Workflow**: Advanced-Testing betrifft nur "significant entities". Nicht jede Org muss das haben.

## Referenzen

- EU Verordnung 2022/2554 (DORA)
- EBA/EIOPA/ESMA Joint Guidelines
- ARCTOS: `packages/db/sql/seed_catalog_dora.sql`, `docs/ADR-*.md`
