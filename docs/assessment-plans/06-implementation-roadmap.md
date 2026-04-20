# Implementation Roadmap — Assessment-Plan-Initiative

**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## Zweck

Aus den 4 Modul-Plaenen + Cross-Module-Integration die konkrete
Sprint-Reihenfolge und Team-Allocation ableiten.

## Gesamtaufwand (Summe der 4 Module + Cross)

| Modul             | Backend-h | Frontend-h | Test-h  | Doku/Legal-h | Total-h  | Personen-Wochen |
| ----------------- | --------- | ---------- | ------- | ------------ | -------- | --------------- |
| ISMS              | 100       | 120        | 50      | 25           | 295      | ~4              |
| BCMS              | 85        | 140        | 40      | 20           | 285      | ~4              |
| DPMS              | 140       | 190        | 60      | 30           | 420      | ~5              |
| AI-Act            | 165       | 210        | 70      | 40           | 485      | ~6              |
| Cross-Integration | 60        | 100        | 30      | 15           | 205      | ~3              |
| **Total**         | **550**   | **760**    | **250** | **130**      | **1690** | **~22**         |

Bei 1 FTE: **~22 Personen-Wochen**, realistisch mit 2 FTE: **~13 Wochen**
(ca. 3 Monate). Mit Review-Cycles, Incidents und Unplanned-Work: **5-6 Monate**.

## Priorisierungs-Strategie

Drei konkurrierende Achsen:

1. **Regulatorische Deadline**: AI-Act hat harte 2025/2026-Termine →
   koennte hoechste Prio kriegen
2. **Kundennutzen**: GRC-Dashboard + ISMS-Workflows bringen Sales-Vorteil
3. **Technische Abhaengigkeit**: Cross-Module-Integration ermoeglicht
   saubere Implementation der Einzel-Module

**Empfohlene Reihenfolge**: ISMS → BCMS → Cross-Integration-Core → DPMS → AI-Act.

Begruendung:

- ISMS bildet das technische Framework (Assessment-State-Machine, SoA-
  Pattern) das die anderen Module adaptieren
- BCMS ist kleinster Scope, schnelles Delivery → Momentum
- Cross-Integration als drittes, bevor DPMS+AI-Act auf der falschen
  Basis bauen
- DPMS vor AI-Act, weil AI-Act auf DPIA-Pattern + Consent-Pattern baut

## Sprint-Breakdown (jeweils 2-Wochen-Sprints)

### Epic 1: ISMS-Assessment-Workflow (5 Sprints, ~10 Wochen)

**Sprint 1.1: Assessment-Run-Foundation**

- [ ] State-Machine: `isms-assessment-states.ts` (Draft → Planning → ...)
- [ ] `POST /api/v1/isms/assessments/{id}/setup-wizard`
- [ ] UI: `/isms/assessments/new` (3-Step-Wizard)
- [ ] Gate G1 (Setup-Validation)
- [ ] Tests: RLS, State-Transitions, Zod-Schemas
- **Deliverable**: Users koennen strukturierte Assessment-Runs anlegen.

**Sprint 1.2: SoA-Initialization + Scope-Management**

- [ ] `POST /api/v1/isms/assessments/{id}/initialize-soa`
- [ ] SoA-Diff-View-Endpoint
- [ ] UI: Bulk-SoA-Init + Diff-View
- [ ] Gate G2 (SoA-Coverage-Check)
- [ ] Cross-Framework-Mapping in SoA
- **Deliverable**: SoA ist aus Katalog bulk-initialisierbar, Diff zu
  Vorversion sichtbar.

**Sprint 1.3: ISO 27005 Risk-Assessment-Flow**

- [ ] `POST /api/v1/isms/assessments/{id}/risk-assessment/generate-scenarios`
- [ ] UI: `/isms/risk-assessment-wizard` (5-Step)
- [ ] Asset → Threat → Vuln → Scenario → Decision
- [ ] Auto-Risk-Create via `erm_sync_config`
- [ ] Gate G3 (Alle Scenarios mit Decision != 'pending')
- **Deliverable**: 27005-konformer Risk-Assessment-Workflow.

**Sprint 1.4: Control-Evaluation + Maturity**

- [ ] `POST /api/v1/isms/assessments/{id}/generate-evaluations`
- [ ] Bulk-Edit-UI
- [ ] Peer-Review-Feature (4-Augen)
- [ ] Gate G4 + G5 (Coverage + Finding-Generation)
- [ ] `maturity_roadmap_action` UI
- **Deliverable**: Bulk-Control-Evaluations mit Maturity-Tracking.

**Sprint 1.5: Finalize + Report + Management-Review**

- [ ] `POST /api/v1/isms/assessments/{id}/finalize`
- [ ] Report-Template-Engine (analog audit_report)
- [ ] Framework-Coverage-Generator
- [ ] `POST /api/v1/isms/assessments/{id}/management-review`
- [ ] Gate G6-G8
- [ ] Evidence-Pack-Generator
- **Deliverable**: Vollstaendiger ISMS-Assessment-Zyklus end-to-end.

### Epic 2: BCMS-Assessment-Workflow (4 Sprints, ~8 Wochen)

**Sprint 2.1: BIA-Workflow**

- [ ] BIA-Wizard 5-Step
- [ ] Process-Impact-Bulk-Edit
- [ ] Heatmap + Dependency-Graph
- [ ] Gate G1-G2

**Sprint 2.2: Strategy + BCP-Builder**

- [ ] Strategy-Comparison-View
- [ ] BCP-Builder mit Drag-Drop-Procedures
- [ ] BCP-PDF-Export (Offline-optimiert)
- [ ] Approval-Workflow-Integration
- [ ] Gate G3-G6

**Sprint 2.3: Exercise-Programm + War-Room-MVP**

- [ ] Exercise-Planning-Wizard
- [ ] Live-War-Room (MVP ohne WebSocket, polling-based)
- [ ] Inject-Queue
- [ ] Exercise-Report-Generator
- [ ] Gate G7-G8

**Sprint 2.4: Crisis-Management + DORA-Reporting**

- [ ] Crisis-Activation-Checklist
- [ ] Crisis-War-Room mit DORA-Timer
- [ ] Post-Mortem-Wizard
- [ ] DORA-Annual-Report-Export
- [ ] Performance-Report + Resilience-Dashboard
- [ ] Gate G9-G11

### Epic 3: Cross-Module-Integration-Core (3 Sprints, ~6 Wochen)

**Sprint 3.1: Finding-Unification + Risk-Sync**

- [ ] `finding.source`-Spalte + Migration (wenn fehlt)
- [ ] `erm_sync_config` in allen Modulen aktivieren
- [ ] `createOrUpdateLinkedRisk` Helper
- [ ] Dedup-Tests
- **Deliverable**: Ein integrierter Risk-Register + Finding-Register.

**Sprint 3.2: Event-Bus + Auto-Triggers**

- [ ] `event-bus`-Schema erweitern (falls noetig)
- [ ] Security-Incident → Breach Auto-Trigger
- [ ] AI-Incident → Breach Auto-Trigger
- [ ] Critical-Incident → Crisis-Activation-Suggestion
- [ ] ADR-028 dokumentieren

**Sprint 3.3: GRC-Executive-Dashboard**

- [ ] `GET /api/v1/integrated/compliance-score`
- [ ] Widgets: Compliance-Score, Risk-Heatmap, Next-30d-Deadlines, Budget-Util
- [ ] UI: `/dashboard` mit Role-based-Layout

### Epic 4: DPMS-Zyklus (6 Sprints, ~12 Wochen)

**Sprint 4.1: RoPA-Workflow + Process-Bootstrap**

- [ ] RoPA-Wizard 6-Step
- [ ] `POST /api/v1/dpms/ropa/from-process` (BPM-Bootstrap)
- [ ] DPIA-Trigger-Auto-Detection
- [ ] RoPA-DSK-Export
- [ ] Gate G1-G2

**Sprint 4.2: DPIA-Workflow**

- [ ] DPIA-Wizard 5-Step
- [ ] Template-Library
- [ ] Prior-Consultation-Package
- [ ] DPIA-Monitoring-Dashboard
- [ ] Gate G3-G5

**Sprint 4.3: DSR-Workflow + Public-Portal**

- [ ] DSR-Intake-Public-Page (kein Auth noetig)
- [ ] Identity-Verification-Flow
- [ ] 30-Tage-Countdown
- [ ] Data-Lookup-Connector-MVP
- [ ] Response-Template-Engine
- [ ] Gate G6-G8

**Sprint 4.4: Breach-Notification + 72h-Flow**

- [ ] Breach-Assessment-Wizard
- [ ] 72h-Countdown + Reminders
- [ ] Authority-Notification (DE-Landesbehoerden)
- [ ] Subject-Notification-Mass-Send
- [ ] Gate G9-G11

**Sprint 4.5: TIA + Consent + Retention**

- [ ] TIA-Wizard mit Schrems-II-Logik
- [ ] Country-Risk-Dashboard
- [ ] SCC-Generator
- [ ] Consent-Banner-Builder
- [ ] Retention-Calendar + Auto-Deletion
- [ ] Gate G12-G13

**Sprint 4.6: AVV + PbD + Annual-Report**

- [ ] AVV-Template-Engine
- [ ] Sub-Processor-Portal
- [ ] PbD-Questionnaire
- [ ] Annual-DPMS-Report-Generator
- [ ] Gate G14-G15

### Epic 5: AI-Act-Zyklus (7 Sprints, ~14 Wochen)

**Sprint 5.1: AI-System-Inventory + Classification**

- [ ] Registration-Wizard 6-Step
- [ ] Prohibited-Screening (Hard-Stop)
- [ ] Classification-Decision-Tree-UI
- [ ] GPAI-Auto-Detection
- [ ] Gate G1

**Sprint 5.2: QMS + Risk-Management**

- [ ] QMS-Setup-Wizard
- [ ] Policy-Template-Pack
- [ ] ISO-42001-Gap-Analysis
- [ ] AI-Risk-Dashboard
- [ ] Bias-Metrics-Tracking

**Sprint 5.3: Data-Governance + Tech-Doc**

- [ ] Data-Governance-Assessment-Wizard
- [ ] Model-Card-Generator
- [ ] Annex-IV-Wizard (9-Step)
- [ ] EU-DB-Registration-Tracker

**Sprint 5.4: Operational-Logging + Oversight**

- [ ] `ai_operational_log` Schema + Worker
- [ ] Log-Query + Export
- [ ] Oversight-Metrics-Dashboard
- [ ] Override-Rate-Analysis

**Sprint 5.5: Conformity-Assessment + Declaration**

- [ ] Conformity-Assessment-Wizard 9-Step
- [ ] EU-Declaration-Generator (PDF + Signatur)
- [ ] Substantial-Change-Detection
- [ ] Gate G2-G4

**Sprint 5.6: FRIA + Post-Market-Monitoring**

- [ ] FRIA-Wizard 8-Step
- [ ] Harm-Taxonomy-Library
- [ ] Post-Market-Monitoring-Dashboard
- [ ] Incident-Decision-Tree + 2/10/15-Tage-Timer
- [ ] Gate G5-G7

**Sprint 5.7: GPAI + Annual-Report**

- [ ] Training-Data-Summary-Template
- [ ] Annex-XI-Doc-Generator
- [ ] Code-of-Practice-Tracker
- [ ] AI-Act-Annual-Report
- [ ] Evidence-Pack
- [ ] Gate G8-G10

### Epic 6: Cross-Module-Advanced (2 Sprints, ~4 Wochen)

**Sprint 6.1: Compliance-Matrix + Evidence-Pool**

- [ ] Compliance-Matrix-Dashboard
- [ ] Evidence-Pool-Refactor (Join-Table)
- [ ] Integrated-Risk-Register
- [ ] Treatment-Portfolio-Dashboard

**Sprint 6.2: Certification-Bundles**

- [ ] `POST /api/v1/integrated/certification-bundle`
- [ ] Core-GRC-Bundle (ISO 27001 + 22301 + GDPR)
- [ ] Financial-Services-Bundle
- [ ] AI-Ready-Bundle
- [ ] Combined-Evidence-Pack-Generator

## Gesamt-Timeline (2 FTE)

```
Sprint:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27
Woche:   1  3  5  7  9 11 13 15 17 19 21 23 25 27 29 31 33 35 37 39 41 43 45 47 49 51 53

Epic 1 ISMS    [====|====|====|====|====]
Epic 2 BCMS                              [====|====|====|====]
Epic 3 Cross-Core                                            [====|====|====]
Epic 4 DPMS                                                              [====|====|====|====|====|====]
Epic 5 AI-Act                                                                                       [====|====|====|====|====|====|====]
Epic 6 Cross-Adv                                                                                                                    [====|====]

              Q1                        Q2                        Q3                        Q4
```

**Realistische Annahme bei 2 FTE**: ~54 Wochen = **13 Monate** end-to-end,
inkl. Sommer-Pause, Deployment-Sprints und Incident-Follow-ups.

## Quality-Gates pro Sprint

Jeder Sprint muss erfuellen bevor er als "done" markiert wird:

- [ ] Alle geplanten Deliverables implementiert
- [ ] Unit-Tests Coverage >= 80 % (Backend), >= 60 % (Frontend)
- [ ] RLS-Tests fuer alle neuen Tabellen
- [ ] E2E-Test-Scenario abdeckt den Haupt-Workflow
- [ ] Zod-Schemas fuer alle neuen Inputs
- [ ] i18n DE+EN fuer alle neuen UI-Texte
- [ ] Changelog-Entry
- [ ] ADR-Update wenn Design-Entscheidungen
- [ ] Schema-Drift-Report clean
- [ ] Staging-Deploy validiert (manual smoke-test)

## Risiken + Mitigations

| Risiko                                                        | Wahrsch. | Impact | Mitigation                                                |
| ------------------------------------------------------------- | -------- | ------ | --------------------------------------------------------- |
| ML/AI-Expertise fehlt fuer AI-Act-Module                      | Medium   | High   | Frueh externe Consultants (AI-Act-Experte) einplanen      |
| Legal-Review der Templates dauert zu lang                     | High     | Medium | Parallele Legal-Partnerschaft fruehzeitig                 |
| Schrems-III / EU-AI-Act-Delegated-Acts aendern Scope          | Medium   | Medium | Regulatory-Change-Modul integriert, Quarterly-Review      |
| Frontend-Aufwand zu hoch (viele Wizards)                      | High     | Medium | Wizard-Komponente als Shared-Lib mit StateMachine-Pattern |
| Connector-Integrationen (SaaS-Systems) komplexer als erwartet | Medium   | High   | Connector-Framework-Refactor in Epic 3                    |
| DPIA/FRIA-Templates nicht juristisch belastbar                | Medium   | High   | Partnerschaft mit Datenschutz-Kanzlei fuer Reviews        |
| Dependabot-Vulnerabilities blockieren Deploys                 | Low      | Medium | Quartalsweise Dependency-Update-Sprints                   |
| Context-Window-Limits in AI-Worker bei Bulk-Evaluations       | Low      | Low    | Batching + Streaming-Pattern nutzen                       |

## Sign-Off-Matrix

| Epic         | Sponsor        | Reviewer                        | Customer                     |
| ------------ | -------------- | ------------------------------- | ---------------------------- |
| 1 ISMS       | CISO           | Architect + Compliance          | CWS ISO-27001-Zertifizierer  |
| 2 BCMS       | BCM-Manager    | Architect + Crisis-Expert       | CWS Business-Continuity-Lead |
| 3 Cross-Core | Architect      | Lead-Dev + Security             | Internal                     |
| 4 DPMS       | DPO            | Architect + Datenschutz-Kanzlei | DPO + externe Pruefung       |
| 5 AI-Act     | CISO + AI-Lead | AI-Act-Rechtsanwalt + Architect | Board (wegen Deadlines)      |
| 6 Cross-Adv  | Architect      | Full-Team                       | Exec-Sponsor                 |

## Next-Steps nach Session-Cluster

Nach Abschluss aller 6 Assessment-Plan-Dokumente:

1. **Review-Workshop** mit Team (2h): Feedback + Priorisierungs-Adjustment
2. **Budget-Approval** durch Management (Epic-Level)
3. **Hiring/Contracting**: AI-Act-Experte + DPMS-Consultant
4. **Sprint-0**: Tooling-Setup (TypeScript-State-Machine-Lib, Wizard-Shared-Lib)
5. **Sprint 1.1** Start

## Definition-of-Done fuer Gesamt-Initiative

Alle 6 Epics abgeschlossen, wenn:

- [ ] Jedes Modul hat End-to-End-Workflow von Setup bis Report
- [ ] Alle 15 Assessment-Plan-Gates (ISMS) + 11 (BCMS) + 15 (DPMS) + 10 (AI-Act) aktiv
- [ ] Cross-Module-Dashboards live
- [ ] Evidence-Packs per-Modul + integriert generierbar
- [ ] Mindestens 1 Tenant (CWS) macht einen vollstaendigen Zyklus durch
- [ ] Rueckmeldung aus Audit-Preparation (externe Zertifizierer) eingearbeitet
- [ ] Alle 5 neuen ADRs (026-030) Accepted
- [ ] Compliance-Checklisten (ISO 27001, NIS2, GDPR, DORA) auf 95 %+ Coverage
