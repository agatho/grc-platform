# ISO/IEC 27001:2022 — ARCTOS Readiness Checklist

_Stand: 2026-04-18_

Zweck: ueber die Plattform-Features hinweg pruefen, welche ISO-27001-Clauses
durch ARCTOS direkt unterstuetzt werden, wo manuelle Evidenz noetig ist,
und wo Lueken bestehen. Selbst-Einschaetzung, keine Zertifizierungs-Zusage.

**Legende**: ✅ abgedeckt · ◑ teilweise · ☐ Luecke · n/a ausserhalb ARCTOS

## Kontext

- Scope: ARCTOS als ISMS-Plattform fuer die **eigene** CWS/Haniel-Installation. Dies ist keine Dokumentation fuer den Tenant, der ARCTOS nutzt — Tenants brauchen ihr eigenes Scope-Statement.
- Gueltig fuer: ISO 27001:2022 Clauses 4–10 + Annex A (93 Kontrollen)

## Clause 4 — Context of the Organization

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 4.1 Internal/External issues | Module `esg.materiality`, `platform.regulatory-change` | ✅ |
| 4.2 Interested parties | `contract.vendor`, `stakeholder_portal` | ✅ |
| 4.3 Scope (Statement of Applicability Basis) | `isms.soa_entry` (93 Annex A + custom) | ✅ |
| 4.4 ISMS establishment | Platform itself + `isms.management_review` | ✅ |

## Clause 5 — Leadership

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 5.1 Leadership & commitment | Management-Review-Dashboard, `isms.maturity` | ✅ |
| 5.2 Policy | `document` + `process.governance` | ◑ — Policy-Template-Pack fehlt |
| 5.3 Roles, responsibilities, authorities | RBAC + LoD + `rci_matrix` | ✅ |

## Clause 6 — Planning

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 6.1.1 Actions to address risks/opportunities | `erm.risk`, `risk_appetite` | ✅ |
| 6.1.2 Risk assessment | `risk_assessment` (qualitative + FAIR) | ✅ |
| 6.1.3 Risk treatment | `risk_treatment` mit budget_id + ROI | ✅ |
| 6.2 Objectives | `isms.management_review.objectives` | ✅ |
| 6.3 Change planning | `approval_workflow`, `approval_request` | ✅ |

## Clause 7 — Support

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 7.1 Resources | Budget-Modul `grc_budget`, `grc_cost_entry` | ✅ |
| 7.2 Competence | `academy` (Sprint 84) | ◑ — Trainings-Tracking manuell |
| 7.3 Awareness | `compliance_culture.campaign` | ✅ |
| 7.4 Communication | `notification`, `incident.communication` | ✅ |
| 7.5 Documented information | `document`, `process_version` mit Versionierung | ✅ |

## Clause 8 — Operation

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 8.1 Operational planning & control | `control_test.campaign`, `checklist_template` | ✅ |
| 8.2 Risk assessment (operational) | `risk_assessment` recurring | ✅ |
| 8.3 Risk treatment implementation | `risk_treatment` mit Tasks + Dependencies | ✅ |

## Clause 9 — Performance Evaluation

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 9.1 Monitoring, measurement, analysis | `kri`, `control_maturity`, Dashboards | ✅ |
| 9.2 Internal audit | Audit-Mgmt-Modul (Sprint 8) mit Universe/Plan/Execution | ✅ |
| 9.3 Management review | `management_review` mit Findings + Actions | ✅ |

## Clause 10 — Improvement

| Requirement | ARCTOS-Support | Status |
|---|---|---|
| 10.1 Continual improvement | ISMS-CAP-Modul mit 8-Schritt-Workflow | ✅ |
| 10.2 Nonconformity & corrective action | `finding` + `risk_treatment` Feedback-Loop (Iter 1-3) | ✅ |

## Annex A — 93 Kontrollen

Kataloge seeded in ARCTOS:
- **ISO 27001:2022 Annex A** (Catalog #16, 97 Entries inkl. Sub-Kontrollen)
- **ISO 27002:2022** (Catalog #4, 97 Entries — 1:1-Mapping)
- Cross-Framework-Mappings: Annex A ↔ ISO 27002 (93), Annex A ↔ BSI (64), Annex A ↔ TISAX (44), Annex A ↔ NIS2 (33), Annex A ↔ DORA (25)

### A.5 Organizational (37 Kontrollen)
Abgedeckt durch: `isms.soa_entry`, `document` (Policies), `process` (Operating Procedures)

### A.6 People (8 Kontrollen)
Abgedeckt durch: `user`, `user_organization_role`, Training-Tracking (◑)

### A.7 Physical (14 Kontrollen)
**☐ Luecke**: kein dedizierter Facility-/Asset-Location-Tracker. Derzeit ueber `asset.location_note` Textfeld dokumentierbar.

### A.8 Technological (34 Kontrollen)
Abgedeckt durch: `asset` + `isms.vulnerability` + `isms.incident`, Connectors (Sprints 62–66), MFA via Auth.js, RLS, Audit-Trigger.

## Luecken-Zusammenfassung

| Luecke | Severity | Vorschlag |
|---|---|---|
| Policy-Template-Pack | Medium | ISO-27001-Annex-A-Policy-Templates als Catalog-Seed in `document_template` |
| Facility/Physical-Asset-Tracking | Low | Erweitern `asset.location_id` mit eigener Tabelle; oder explizit out-of-scope dokumentieren |
| Kompetenz-Nachweis pro Person | Medium | `training_record` + `certification` Entitaeten (Academy hat aktuell Kurse, aber keine Tracking-Ebene) |

## Zertifizierungs-Pfad (Selbst-Einschaetzung)

- Stage 1 (Documentation Review): **schlecht bis gut** — Platform-interne Doku umfassend, SoA+Policies fuer Tenant sind Tenant-Aufgabe
- Stage 2 (Evidence Review): **gut** — Audit-Trail (SHA-256-Chain), automatische Log-Integrity, RBAC-Trace
- Surveillance-Fitness: **sehr gut** — Hash-Chain + Access-Log + Maturity-Tracking decken externe Audit-Erwartungen

**Einschaetzung**: Platform ist zu ~90 % ISO-27001-ready. Fehlende 10 % sind Tenant-spezifische Policies/Trainings, die ausserhalb der Plattform dokumentiert werden (ODER in ARCTOS als Tenant-Content geseedet werden).
