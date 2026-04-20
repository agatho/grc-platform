# BCMS Assessment Plan

**Framework:** ISO/IEC 22301:2019 + DORA Art. 11-12 (Overlay fuer Finanzsektor)
**Iteration:** 1
**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## 1. Scope + Framework-Landschaft

Das BCMS-Modul hat eine **duale Natur**: Es kombiniert **strategisches
Lifecycle-Management** (BIA → Strategy → BCP → Exercise) mit
**operativem Crisis-Management** (Activation → Communication → Recovery →
Post-Mortem).

| Framework              | Fokus                                  | In ARCTOS-Katalog        |
| ---------------------- | -------------------------------------- | ------------------------ |
| **ISO/IEC 22301:2019** | Societal security — BCMS requirements  | #27 (32 Entries)         |
| **ISO 22313:2020**     | Guidance on ISO 22301 (Implementation) | n/a (als ADR)            |
| **ISO 22317:2021**     | BIA-Guidelines                         | in ARCTOS BIA-Wizard     |
| **DORA Art. 11-12**    | ICT Business Continuity (Finanzsektor) | #14 (53 Entries) Overlay |
| **NIST SP 800-34**     | Contingency Planning (US)              | n/a, optional Overlay    |
| **BSI 200-4**          | Business Continuity Management (DE)    | in BSI Grundschutz #15   |

Cross-Framework-Mappings:

- ISO 22301 ↔ ISO 27001 (6 Mappings — BCMS als Teil des ISMS)
- DORA ↔ ISO 22301 (implizit via DORA-Kapitel V "ICT-related incident management")

## 2. Standards-driven Workflow-Map

### ISO 22301 Clauses → Workflow-Phases

| Clause  | Anforderung                              | Workflow-Phase | ARCTOS-Entity                                                                                                    |
| ------- | ---------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 4.1     | Context                                  | Setup          | `bia_assessment.scope_notes` + `stakeholder_portal`                                                              |
| 4.2     | Interested Parties                       | Setup          | `contract.vendor` + `stakeholder_portal`                                                                         |
| 4.3     | Scope                                    | Setup          | `bia_assessment.scope_filter` + `essential_process` list                                                         |
| 5.1/5.2 | Leadership + Policy                      | Governance     | `document` (category='bcm_policy') + `approval_workflow`                                                         |
| 5.3     | Roles + Responsibilities                 | Governance     | `crisis_team_member` + `user_organization_role`                                                                  |
| 6.1     | Risks + Opportunities                    | Risk           | ERM-Modul + `crisis_scenario`                                                                                    |
| 6.2     | Objectives                               | Governance     | RTO/RPO-Ziele in `bia_process_impact.mtpd` + `rpo`                                                               |
| 6.3     | Changes to BCMS                          | Governance     | `approval_request`                                                                                               |
| 7.1     | Resources                                | Budget         | `grc_budget` + `bcp_resource`                                                                                    |
| 7.2     | Competence                               | Training       | `academy.course` + `crisis_team_member.training_completed_at`                                                    |
| 7.3     | Awareness                                | Awareness      | `compliance_culture.campaign`                                                                                    |
| 7.4     | Communication                            | Crisis-Mgmt    | `crisis_contact_tree` + `crisis_communication_log`                                                               |
| 7.5     | Documented Info                          | Documentation  | `document` + BCP-Versionierung                                                                                   |
| **8.2** | **Business Impact Analysis**             | **BIA**        | `bia_assessment` + `bia_process_impact` + `bia_supplier_dependency`                                              |
| **8.2** | **Risk Assessment**                      | **Risk**       | `crisis_scenario` + Risk-Modul                                                                                   |
| **8.3** | **Business Continuity Strategies**       | **Strategy**   | `continuity_strategy`                                                                                            |
| **8.4** | **Business Continuity Plans/Procedures** | **BCP**        | `bcp` + `bcp_procedure` + `bcp_resource` + `recovery_procedure` + `recovery_procedure_step`                      |
| **8.5** | **Exercising + Testing**                 | **Exercise**   | `bc_exercise` + `bc_exercise_scenario` + `bc_exercise_inject_log` + `bc_exercise_finding` + `bc_exercise_lesson` |
| 8.6     | Evaluation of BCMS Documentation         | Evaluation     | Internal-Audit (Audit-Modul)                                                                                     |
| 9.1     | Monitoring + Measurement                 | Analytics      | `resilience_score_snapshot` + KRI                                                                                |
| 9.2     | Internal Audit                           | Audit          | Audit-Modul (Sprint 8)                                                                                           |
| 9.3     | Management Review                        | Governance     | `management_review`                                                                                              |
| 10.1    | Nonconformity + CAP                      | CAP            | `bc_exercise_finding` → `isms_nonconformity` (shared)                                                            |
| 10.2    | Continual Improvement                    | Improvement    | `bc_exercise_lesson` → Next-Iteration-Input                                                                      |

### DORA Art. 11-12 Overlay (fuer Finanzsektor)

| DORA-Artikel  | Anforderung                                | ARCTOS-Entity                                              |
| ------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Art. 11(1)    | ICT BC-Policy                              | `document` (category='dora_bc_policy')                     |
| Art. 11(2)(a) | Recovery-Plans fuer kritische ICT-Services | `bcp` + `bcp_procedure` mit `is_ict_critical` Flag         |
| Art. 11(2)(b) | Backup-Policies                            | `continuity_strategy` + Link auf ADR-015 (B2 Backup)       |
| Art. 11(3)    | Independent Testing                        | `bc_exercise.is_independent_test` + External-Auditor-Share |
| Art. 12       | BC-Strategy + Testing-Methoden             | `continuity_strategy` + `bc_exercise_scenario`             |

### Crisis-Management-Lifecycle (Event-driven, nicht Cycle-driven)

Parallel zum Assessment-Zyklus existiert ein Event-Flow fuer reale Krisen:

```
   ┌────────────┐
   │  Monitor   │
   └─────┬──────┘
         │ Severity >= level_2_emergency
         ▼
   ┌────────────┐         ┌──────────────┐
   │  Activate  │────────▶│ Crisis-Log   │
   └─────┬──────┘         └──────────────┘
         │
         ▼
   ┌────────────────────────┐
   │ Activate Contact-Tree  │
   │ + Communication-Log    │
   └─────┬──────────────────┘
         │
         ▼
   ┌────────────────────────┐
   │ Execute Recovery-Plan  │
   │ (per BCP + Procedures) │
   └─────┬──────────────────┘
         │
         ▼
   ┌────────────┐
   │  Resolve   │
   └─────┬──────┘
         │
         ▼
   ┌────────────┐
   │Post-Mortem │──────▶ Lessons → Next-BIA-Input
   └────────────┘
```

## 3. Vollstaendiger BCMS-Zyklus

### 3.1 Phase 1 — SETUP (Scope + Policy + Team)

**Trigger**: Neuer BCMS-Zyklus (jaehrlich / nach Org-Change / nach
Merger&Acquisition)

**Aktoren**: admin, risk_manager

**Inputs**:

- Vorheriger BCMS-Zyklus (optional)
- Branchenkontext (Finanzsektor → DORA-Overlay)
- Kritische Prozesse aus Sprint-3-BPM-Katalog

**Outputs**:

- BCM-Policy als `document` (category='bcm_policy') mit Signoff
- `bia_assessment` mit `status='draft'`, Scope definiert
- Crisis-Team-Roster via `crisis_team_member`
- Contact-Tree-Strukturen (`crisis_contact_tree` + Nodes)

**Akzeptanz-Kriterien**:

- [ ] BCM-Policy unterschrieben + versioniert
- [ ] Mindestens 1 Crisis-Team pro Severity-Level
- [ ] Essential-Processes-Liste aus BPM-Modul referenziert (`essential_process.processId`)
- [ ] Primary + Backup-Contact pro Team-Rolle

**Existierend**:

- ✅ `essential_process`, `crisis_team_member`, `crisis_contact_tree`, `crisis_contact_node`
- ✅ `/api/v1/bcms/contact-trees`
- 🟡 UI fuer Crisis-Team-Management fehlt teilweise

**Gap**:

- 🔴 BCMS-Setup-Wizard (4-Step): Policy-Upload → Scope → Team → Contact-Tree
- 🔴 Essential-Process-Selector (Multi-Select aus `process.isCritical=true`)
- 🔴 Contact-Tree-Graph-View (visuell hierarchisch)
- 🔴 Policy-Template-Download (ISO-22301-konformes Muster)

### 3.2 Phase 2 — BUSINESS IMPACT ANALYSIS (ISO 22301 Clause 8.2.2)

**Trigger**: Setup abgeschlossen, BCMS-Policy approved

**Aktoren**: risk_manager (primary), process_owner (Input-Provider)

**Workflow**:

**3.2.1 — Process-Inventory + Criticality-Screening**

- Liste aller Prozesse aus `process`-Tabelle (Sprint 3)
- Per Prozess: `essential_process`-Record mit
  - `criticality_rank` (1=critical, 5=optional)
  - `max_tolerable_period_of_disruption_hours` (MTPD)
  - `recovery_time_objective_hours` (RTO)
  - `recovery_point_objective_hours` (RPO)
  - `minimum_business_continuity_objective` (MBCO)

**3.2.2 — Impact-Assessment je Dimension**

- `bia_process_impact` pro Prozess mit:
  - Finanziell: Impact nach 1h, 4h, 24h, 72h, 1w, 1m
  - Operativ: Anzahl Kunden betroffen, Anzahl Mitarbeiter betroffen
  - Reputational: Press-Coverage-Risk, Customer-Trust-Loss
  - Legal/Compliance: Regulatorische Meldepflichten (GDPR-Breach-72h etc.)
  - Health/Safety: Gefaehrdung von Leben oder Umwelt

**3.2.3 — Dependencies-Mapping**

- Upstream: `bia_supplier_dependency` (kritische Zulieferer + Exit-Plan)
- Downstream: welche abhaengigen Prozesse leiden
- IT-Systeme: `asset` + `application_portfolio` (EAM-Overlap)
- Personal: Key-People + Single-Points-of-Failure

**3.2.4 — Resource-Requirements**

- Per essential_process: benoetigte Ressourcen fuer Resumption
- `bcp_resource` vorbereiten: People, IT, Facilities, Suppliers, Info

**3.2.5 — MTPD / RTO / RPO / MBCO Validierung**

- 4-Augen-Prinzip: process_owner + risk_manager bestaetigen
- Vergleich mit IT-Capabilities (kann die IT-Infra das liefern?)
- Discovery-Delta: Ist-Recovery-Zeit vs. Soll-RTO

**Existierend**:

- ✅ `bia_assessment`, `bia_process_impact`, `bia_supplier_dependency`
- ✅ `essential_process`
- ✅ `/api/v1/bcms/bia`
- ✅ UI: `/bcms/bia`
- 🟡 MTPD/RTO/RPO-Validierung (Felder existieren)

**Gap**:

- 🔴 BIA-Wizard (5-Step: Process-Select → Impact-Dimensions → Dependencies → Resources → Validate)
- 🔴 Heatmap: Criticality × MTPD (zeigt "hot spots")
- 🔴 Dependency-Graph-Visualisierung (wer haengt von wem ab)
- 🔴 BIA-Template-Library (Banking, Manufacturing, Healthcare vorgefertigt)
- 🔴 IT-Capability-Check: `bcp_resource` ↔ `asset.cia_rto_actual` (falls vorhanden)

### 3.3 Phase 3 — RISK + THREAT-ASSESSMENT (ISO 22301 Clause 8.2.3)

**Trigger**: BIA hat mindestens 10 essential_processes bewertet

**Aktoren**: risk_manager (primary), process_owner (Input)

**Workflow**:

**3.3.1 — Threat-Landscape-Import**

- Aus `crisis_scenario`-Katalog (Catalog #8: 7 Crisis-Scenario-Templates)
- Custom-Scenarios: Pandemic, Cyber-Incident, Supplier-Failure, Facility-Loss, Key-Person-Loss, Utility-Outage, Regulatory-Enforcement
- Org-spezifische Threats aus ERM-Modul (existierende `risk` mit category='continuity')

**3.3.2 — Scenario-Likelihood-Assessment**

- Per `crisis_scenario` + `essential_process`:
  - Likelihood (annual occurrence probability)
  - Impact (uebernommen aus BIA-Process-Impact)
  - Risk-Score = L × I

**3.3.3 — ISMS-Integration**

- Cross-Link mit `risk` in ERM-Modul (ein BCM-Szenario = ein Risk mit
  category='business_continuity')
- Nutzung der ISMS-Threats (Katalog #3 BSI Elementargefaehrdungen)

**Existierend**:

- ✅ `crisis_scenario` Tabelle
- ✅ Katalog #8 (Crisis-Scenario-Templates)

**Gap**:

- 🔴 Scenario-Library-UI mit Import-Button aus Katalog
- 🔴 Scenario-Template-Gallery (Pandemic, Cyber, Supplier, etc. vorformatiert)
- 🔴 Probability-Table: Industry-Benchmarks fuer Base-Rates

### 3.4 Phase 4 — CONTINUITY-STRATEGY-SELECTION (ISO 22301 Clause 8.3)

**Trigger**: BIA + Risk-Assessment abgeschlossen

**Aktoren**: risk_manager, IT-Lead, Facility-Manager

**Workflow**:

**3.4.1 — Strategy-Options pro essential_process**

- Per Prozess: mehrere Strategien pruefen
- `continuity_strategy.type`-Enum:
  - `active_active` (beide Sites live, instant failover)
  - `active_passive_hot` (Passive Hot-Standby, Sekunden-Failover)
  - `active_passive_warm` (Warm-Standby, Minuten-Failover)
  - `cold_standby` (Equipment steht, Stunden-Recovery)
  - `manual_recovery` (Procedures-Driven, Tage-Recovery)
  - `external_provider` (3rd-Party-DR-Service)
  - `workaround_process` (Manual-Fallback fuer IT-Prozesse)
  - `controlled_cessation` (bewusste Dienst-Einstellung bis Recovery)

**3.4.2 — Cost-vs-Benefit-Analysis**

- Pro Strategy: CapEx + OpEx + implementation_duration_days
- Benefit = vermeidener Schaden aus BIA-Impact
- ROI = (Avoided Loss - Strategy Cost) / Strategy Cost
- Decision: strategy-Auswahl mit Begruendung

**3.4.3 — Gap-Analysis**

- Ist-Zustand (aktuelle IT + Org-Capabilities)
- Soll-Zustand (gewaehlte Strategie)
- Investition-Roadmap mit Phasen

**Existierend**:

- ✅ `continuity_strategy` Tabelle
- ✅ `/api/v1/bcms/strategies`
- ✅ UI: `/bcms/strategies`

**Gap**:

- 🔴 Strategy-Selector-Matrix (Entscheidungs-Hilfe pro RTO-Bucket)
- 🔴 Cost-Benefit-Calculator mit Budget-Modul-Integration
- 🔴 Strategy-Comparison-View (Side-by-Side)
- 🔴 Implementation-Roadmap-Gantt (Multi-Year)

### 3.5 Phase 5 — BCP-DEVELOPMENT (ISO 22301 Clause 8.4)

**Trigger**: Continuity-Strategy approved fuer essential-Prozess

**Aktoren**: process_owner (primary), risk_manager (review)

**Workflow**:

**3.5.1 — BCP-Creation**

- Ein `bcp` pro essential_process ODER pro Crisis-Scenario
- `bcp`-Felder:
  - `activation_criteria` (wann wird der Plan aktiviert?)
  - `rto_hours`, `rpo_hours` (Ziele, muessen <= BIA-Werte sein)
  - `team_roles` (JSON)
  - `communication_plan` (Link auf `crisis_contact_tree`)
  - `recovery_steps` (`bcp_procedure`-Liste)
  - `required_resources` (`bcp_resource`-Liste)
  - `status_enum`: draft → in_review → approved → published → archived → superseded

**3.5.2 — Procedures-Detail**

- Per BCP: sequenzielle + parallele `bcp_procedure`s
- Felder: sequence_number, role_responsible, expected_duration_minutes,
  success_criteria, rollback_instructions

**3.5.3 — Resource-Requirements**

- Per BCP: benoetigte `bcp_resource`s
- Typen: `people_role`, `it_system`, `facility`, `supplier`, `info_document`
- Link auf konkrete Assets / Vertraege / Dokumente

**3.5.4 — Recovery-Procedure-Details**

- `recovery_procedure` + `recovery_procedure_step`
- Granularer als `bcp_procedure`, fuer IT-spezifische Recovery (z. B.
  "Restore DB aus Backup")

**3.5.5 — Approval + Publishing**

- `approval_workflow` (Phase-3 generic)
- Sign-Off durch Risk-Manager + Process-Owner + CISO (bei IT-kritisch)
- Publishing: Status-Change + Notification an Team
- Distribution: PDF-Export + Print + Offline-Storage-Hinweis

**Existierend**:

- ✅ `bcp`, `bcp_procedure`, `bcp_resource`
- ✅ `recovery_procedure`, `recovery_procedure_step`
- ✅ `/api/v1/bcms/plans`, `/api/v1/bcms/recovery-procedures`
- ✅ UI: `/bcms/plans`
- ✅ `approval_workflow` (Phase-3)

**Gap**:

- 🔴 BCP-Template-Engine (pre-filled Steps je Szenario-Typ)
- 🔴 BCP-Builder-UI (drag-drop Procedure-Reorder)
- 🔴 BCP-Dependency-View (welche Plans referenzieren dieselben Resources)
- 🔴 BCP-PDF-Export mit Offline-Layout (grosser Font, klare Steps, Kontakte)
- 🔴 BCP-Versionierung (git-like diff zwischen Versionen)
- 🔴 Physical-Storage-Reminder (wo liegen Print-Outs?)

### 3.6 Phase 6 — EXERCISE-PROGRAMM (ISO 22301 Clause 8.5)

**Trigger**: BCP published oder neues Fiscal-Year

**Aktoren**: risk_manager (exercise-lead), Crisis-Team-Members

**Workflow**:

**3.6.1 — Exercise-Planning**

- `bc_exercise` mit:
  - `exercise_type`-Enum: tabletop | walkthrough | functional | full_simulation
  - Tied-To-BCP (`bcpId`) oder Standalone
  - Participants (crisis_team_member-Liste)
  - Duration-Estimate
  - Objectives (JSON array)
  - Success-Criteria (JSON array)
  - is_independent_test (DORA Art. 11(3))

**3.6.2 — Scenario-Selection**

- Aus `bc_exercise_scenario`-Katalog (Phase-3)
- Scenario-Type: Cyber-Attack, Ransomware, Supplier-Failure,
  Physical-Disaster, Pandemic, Key-Person-Loss
- Inject-Plan: Zeit-codierte Events die waehrend der Uebung injiziert werden

**3.6.3 — Exercise-Execution**

- `bc_exercise.status` → 'executing'
- `bc_exercise_inject_log`: pro Inject Zeitstempel, wen informiert, wer reagiert
- Live-Observer-Notes (Rolle: 'observer')
- Participants fuegen eigene Actions hinzu

**3.6.4 — Evaluation**

- Nach Exercise: `bc_exercise.status` → 'evaluation'
- Per Objective: Achieved / Partially-Achieved / Not-Achieved
- Findings erzeugen: `bc_exercise_finding` (shared mit `finding`-Entity?
  Ja, via finding.source='bc_exercise')
- `bc_exercise_lesson`: Lessons-Learned-Entries (descriptive + action)

**3.6.5 — RTO/RPO-Validation**

- Actual-RTO vs Target-RTO
- Actual-RPO vs Target-RPO (aus BIA)
- Gap-Score = (actual - target) / target

**3.6.6 — Feedback-Loop in BIA**

- Wenn Actual-RTO > Target-RTO: BIA anpassen ODER Strategie erweitern
- `finding.riskId` Link fuer Risk-Reassessment

**Existierend**:

- ✅ `bc_exercise`, `bc_exercise_finding`
- ✅ `bc_exercise_scenario`, `bc_exercise_inject_log`, `bc_exercise_lesson` (Phase-3)
- ✅ `/api/v1/bcms/exercises`
- ✅ UI: `/bcms/exercises`

**Gap**:

- 🔴 Exercise-Wizard (4-Step: Plan → Scenario → Execute → Evaluate)
- 🔴 Live-Exercise-Mode (mit Timer, Inject-Triggers, Observer-View)
- 🔴 Post-Exercise-Report-Generator (automatische Lessons-Aggregation)
- 🔴 Exercise-Kalender (quartalsweise Auto-Planning aus Compliance-Calendar-Templates 0104)
- 🔴 Multi-Participant-Chat (fuer funktional+full-simulation Exercises)

### 3.7 Phase 7 — CRISIS-MANAGEMENT (Event-Driven, ISO 22301 Clause 8.4.4)

Parallel zum Zyklus, aber integraler Teil des BCMS.

**Trigger**: Crisis-Detection (manuell oder via Monitoring-Rule)

**Aktoren**: crisis_team_member (roles: commander, liaison, logistics, comms)

**Workflow**:

**3.7.1 — Activation-Decision**

- Severity-Einschaetzung: level_1_incident → level_4_catastrophe
- Activation-Criteria-Check (aus BCP)
- `crisis_log.activatedAt` gesetzt
- Notification an Crisis-Team via `crisis_contact_tree` Kaskade

**3.7.2 — Initial-Assessment**

- `crisis_log`-Entries:
  - 'initial_assessment': Was ist passiert, Scope, Impact-Schaetzung
  - 'resources_mobilized': welches Team, welche Infra
  - 'key_decisions': erste Entscheidungen mit Begruendung

**3.7.3 — Communication-Plan-Execution**

- `crisis_communication_log`:
  - internal: CEO → Team
  - external: Customers, Regulators (DORA-Meldefristen!), Press, Insurance
- Templates pro Audience (pre-approved fuer Schnelligkeit)
- Authority-Matrix: Wer darf was kommunizieren
- DORA-Meldepflicht: 4h Early-Warning, 72h Detail, 1m Final-Report

**3.7.4 — Recovery-Execution**

- `bcp` + zugehoerige `bcp_procedure`s werden durchlaufen
- Per Procedure: completion-Time tracken
- `recovery_procedure_step.actual_duration_minutes` fuer Post-Mortem

**3.7.5 — Resolution**

- `crisis_log.resolvedAt` gesetzt
- `crisis_log.status` → 'resolved'
- Summary-Statement pflichtig

**3.7.6 — Post-Mortem (ISO 22301 10.2)**

- `root_cause_analysis` (5-Why, Fishbone etc.)
- Findings aus Crisis: `finding` mit source='crisis'
- Lessons: `bc_exercise_lesson` (mit `exerciseId=null`, `crisisLogId` gesetzt)
- Improvement-Actions: `isms_corrective_action`
- BIA-Delta: Did actual-RTO exceed target? → BIA-Update

**Existierend**:

- ✅ `crisis_log`, `crisis_team_member`, `crisis_contact_tree`,
  `crisis_communication_log`
- ✅ `/api/v1/bcms/crisis`
- ✅ UI: `/bcms/crisis`
- 🟡 Crisis-Activation UI-Flow unvollstaendig

**Gap**:

- 🔴 Crisis-War-Room UI (Full-Screen-Dashboard mit Timer, Live-Log,
  Team-Chat, Action-Tracker)
- 🔴 SMS/Email-Gateway fuer Contact-Tree-Notifications
- 🔴 Crisis-Activation-Checklist (Pre-flight vor Level-3+ Activation)
- 🔴 DORA-Meldefristen-Timer (4h / 72h / 1m mit Countdown)
- 🔴 External-Communication-Template-Library (pre-approved Press-Statements)
- 🔴 Post-Mortem-Template (ISO-22301-konform)

### 3.8 Phase 8 — PERFORMANCE-EVALUATION + MANAGEMENT-REVIEW

**Trigger**: Jaehrlich + nach jedem Level-3+ Crisis

**Aktoren**: risk_manager, Board

**Outputs**:

**3.8.1 — Resilience-Score-Snapshot**

- `resilience_score_snapshot` (Phase-3) aus:
  - % essential_processes mit aktuellem BIA
  - % BCPs im Status 'approved'
  - % BCPs in den letzten 12 Monaten getestet (durch Exercise)
  - Avg Actual-RTO vs Target-RTO
  - Crisis-Count nach Severity
  - Open-Exercise-Findings

**3.8.2 — BCMS-Performance-Report**

- Structured Sections:
  - **Executive Summary** (1-Seite)
  - **BIA-Coverage** (% von essential_processes)
  - **BCP-Coverage** (% mit aktuellem approved Plan)
  - **Exercise-Coverage** (% getestet in 12 Monaten)
  - **Resilience-Trend** (Resilience-Score-Timeseries)
  - **Lessons-Learned-Aggregate** (top Themes aus exercises + crises)
  - **Improvement-Backlog** (open `isms_corrective_action`)
  - **Appendix**: Full BIA + BCPs + Exercise-Reports

**3.8.3 — Management-Review (ISO 22301 Clause 9.3)**

- `management_review.review_type='bcms'`
- Pflicht-Inputs: Performance-Report + Exercise-Lessons + Crisis-Log-Summaries + External-Party-Feedback
- Decisions: Updated Objectives, Resource-Allocation, Strategy-Changes

**3.8.4 — DORA-Reporting (falls Finanzsektor)**

- Art. 11(4): Annual BC-Testing-Report an Aufsichtsbehoerde
- Art. 11(5): Post-Test-Remediation-Timeline
- Format: regulator-spezifisch (BaFin/EBA/ESMA)

**Existierend**:

- ✅ `resilience_score_snapshot`
- ✅ `management_review` (shared ISMS)

**Gap**:

- 🔴 Resilience-Dashboard-Widget (Timeseries + Peer-Benchmark falls vorhanden)
- 🔴 BCMS-Report-Template
- 🔴 DORA-Reporting-Export
- 🔴 Management-Review-Form fuer BCMS-Context

## 4. Entity-Katalog (BCMS-Modul nach Plan)

### 4.1 Vorhanden + OK (~23 Entitaeten)

| Entity                    | Tabelle                     | Zweck                             |
| ------------------------- | --------------------------- | --------------------------------- |
| BIA                       | `bia_assessment`            | Meta-Record der BIA-Durchfuehrung |
| BIA-Process-Impact        | `bia_process_impact`        | Per-Process Impact-Scoring        |
| BIA-Supplier-Dep          | `bia_supplier_dependency`   | Zulieferer-Abhaengigkeit          |
| Essential-Process         | `essential_process`         | Mapping Prozess → Criticality     |
| BCP                       | `bcp`                       | Plan-Container                    |
| BCP-Procedure             | `bcp_procedure`             | Schritt-fuer-Schritt              |
| BCP-Resource              | `bcp_resource`              | Ressourcen-Anforderung            |
| Continuity-Strategy       | `continuity_strategy`       | Strategy-Auswahl                  |
| Crisis-Scenario           | `crisis_scenario`           | Scenario-Typ                      |
| Crisis-Team-Member        | `crisis_team_member`        | Team-Roster                       |
| Crisis-Log                | `crisis_log`                | Event-Log im Crisis               |
| BC-Exercise               | `bc_exercise`               | Uebungs-Meta                      |
| BC-Exercise-Finding       | `bc_exercise_finding`       | Uebungs-Findings                  |
| Crisis-Contact-Tree       | `crisis_contact_tree`       | Eskalations-Struktur              |
| Crisis-Contact-Node       | `crisis_contact_node`       | Tree-Nodes                        |
| Crisis-Communication-Log  | `crisis_communication_log`  | Comms-Trail                       |
| BC-Exercise-Scenario      | `bc_exercise_scenario`      | Exercise-Templates                |
| BC-Exercise-Inject-Log    | `bc_exercise_inject_log`    | Inject-Events                     |
| BC-Exercise-Lesson        | `bc_exercise_lesson`        | Lessons-Learned                   |
| Recovery-Procedure        | `recovery_procedure`        | IT-Recovery-Playbook              |
| Recovery-Procedure-Step   | `recovery_procedure_step`   | Playbook-Step                     |
| Resilience-Score-Snapshot | `resilience_score_snapshot` | KPI-Timeseries                    |

### 4.2 Neu (benoetigt fuer vollstaendigen Zyklus)

| Entity                        | Zweck                                            | Prio             |
| ----------------------------- | ------------------------------------------------ | ---------------- |
| `bcms_policy_reference`       | Strukturierte Policy-Meta (statt nur Doc-Upload) | Low              |
| `bia_version`                 | BIA-Versionierung mit Diff                       | Medium           |
| `bcp_version`                 | BCP-Versionierung mit Diff                       | Medium           |
| `crisis_activation_checklist` | Pre-flight pro Severity                          | Medium           |
| `dora_bc_report`              | DORA-Art-11-spezifischer Report (falls aktiv)    | Medium (bedingt) |
| `resilience_benchmark`        | Industry-Benchmarks fuer Vergleich               | Low              |
| `bcp_dependency_link`         | BCP-to-BCP-Referenzen (shared Resources)         | Low              |
| `crisis_drill_simulation`     | Virtuelle Drill-Playouts fuer Trainings          | Low              |

## 5. API-Surface (neu + existierend)

### 5.1 Existierend

```
GET    /api/v1/bcms/bia
POST   /api/v1/bcms/bia
GET    /api/v1/bcms/bia/{id}
PATCH  /api/v1/bcms/bia/{id}
POST   /api/v1/bcms/bia/{id}/process-impact
POST   /api/v1/bcms/bia/{id}/supplier-dependency

GET    /api/v1/bcms/plans
POST   /api/v1/bcms/plans
GET    /api/v1/bcms/plans/{id}
PATCH  /api/v1/bcms/plans/{id}
POST   /api/v1/bcms/plans/{id}/procedures
POST   /api/v1/bcms/plans/{id}/resources
POST   /api/v1/bcms/plans/{id}/approve
POST   /api/v1/bcms/plans/{id}/publish

GET    /api/v1/bcms/crisis
POST   /api/v1/bcms/crisis
POST   /api/v1/bcms/crisis/{id}/activate
POST   /api/v1/bcms/crisis/{id}/resolve
POST   /api/v1/bcms/crisis/{id}/log-entry
GET    /api/v1/bcms/crisis/{id}/communication-log
POST   /api/v1/bcms/crisis/{id}/communicate

GET    /api/v1/bcms/exercises
POST   /api/v1/bcms/exercises
GET    /api/v1/bcms/exercises/{id}
POST   /api/v1/bcms/exercises/{id}/start
POST   /api/v1/bcms/exercises/{id}/inject
POST   /api/v1/bcms/exercises/{id}/complete
POST   /api/v1/bcms/exercises/{id}/findings

GET    /api/v1/bcms/strategies
POST   /api/v1/bcms/strategies
GET    /api/v1/bcms/contact-trees
POST   /api/v1/bcms/contact-trees
GET    /api/v1/bcms/recovery-procedures
GET    /api/v1/bcms/resilience
GET    /api/v1/bcms/dashboard
```

### 5.2 Neu benoetigt

```
POST   /api/v1/bcms/setup-wizard
       Body: { policy_doc_id, scope, team_members, contact_tree }

POST   /api/v1/bcms/bia/{id}/process-impact/bulk
       Body: { process_ids: [...], template: { impacts_by_dimension } }

POST   /api/v1/bcms/bia/{id}/finalize
       Effekt: status → 'approved', locks process_impacts, triggers strategy phase

GET    /api/v1/bcms/bia/{id}/heatmap
       Returns: criticality x mtpd matrix

POST   /api/v1/bcms/strategies/compare
       Body: { strategy_ids: [...] }
       Returns: side-by-side CapEx/OpEx/RTO/RPO-vergleich

POST   /api/v1/bcms/plans/{id}/export-pdf
       Returns: offline-geeignetes PDF mit Contact-Info

POST   /api/v1/bcms/exercises/{id}/war-room/join
       Body: { participant_role }
       Returns: WebSocket-Token fuer Live-Session

POST   /api/v1/bcms/exercises/{id}/war-room/inject
       Body: { inject_id, target_role, payload }

POST   /api/v1/bcms/crisis/{id}/post-mortem
       Body: { root_cause_analysis, lessons, improvement_actions }
       Effekt: Erzeugt isms_corrective_action, rca, bc_exercise_lesson

GET    /api/v1/bcms/crisis/{id}/dora-timeline
       Returns: 4h/72h/1m Countdown mit Deadlines

POST   /api/v1/bcms/crisis/{id}/regulator-notification
       Body: { regulator_type: 'bafin'|'eba'|'esma'|'bsi', report_type }

GET    /api/v1/bcms/performance/report/{year}
       Returns: structured yearly report

POST   /api/v1/bcms/performance/report/{year}/pdf
       Returns: PDF Download

GET    /api/v1/bcms/dora/annual-report/{year}
       Returns: DORA-Article-11-conformes Reporting (fuer Finanzsektor)

GET    /api/v1/bcms/resilience/timeseries
       Params: from, to, granularity
       Returns: Resilience-Score-Timeseries

GET    /api/v1/bcms/lessons-aggregate
       Returns: Top-Themes aus exercises + crises, clustered
```

### 5.3 Middleware-Chain (identisch zu ISMS)

```typescript
const ctx = await withAuth("admin", "risk_manager", "auditor");
const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
```

## 6. UI-Surface

### 6.1 Existierend

- `/bcms` — Overview
- `/bcms/bia` — BIA-Liste + Detail
- `/bcms/plans` — BCP-Liste + Detail
- `/bcms/crisis` — Crisis-Liste + Detail (mit Activate-Button)
- `/bcms/exercises` — Exercise-Liste + Detail
- `/bcms/strategies` — Strategy-Liste
- `/bcms/resilience` — Resilience-Dashboard (basic)

### 6.2 Neu benoetigt

- `/bcms/setup-wizard` — 4-Step Onboarding
- `/bcms/bia/new` — **5-Step BIA-Wizard**
  - Step 1: Process-Select (Multi-Select aus essential)
  - Step 2: Impact-Dimensions (4 Spalten: Financial/Ops/Reputation/Legal)
  - Step 3: Dependencies (Upstream + Downstream)
  - Step 4: Resources
  - Step 5: Validate + Approve
- `/bcms/bia/[id]/heatmap` — Criticality × MTPD Heatmap
- `/bcms/bia/[id]/dependency-graph` — Netzwerk-Visualisierung
- `/bcms/strategies/compare` — Side-by-Side-Compare
- `/bcms/plans/new` — BCP-Builder mit Drag-Drop-Procedures
- `/bcms/plans/[id]/offline-pdf` — Print-optimierte PDF-Preview
- `/bcms/plans/[id]/versions` — Git-like Version-Diff
- `/bcms/exercises/new` — Exercise-Planning-Wizard
- `/bcms/exercises/[id]/war-room` — **Live-War-Room** (Full-Screen, Timer, Inject-Queue, Team-Chat, Action-Tracker)
- `/bcms/exercises/[id]/report` — Post-Exercise-Report
- `/bcms/crisis/new` — Activation-Checklist (Pre-Flight)
- `/bcms/crisis/[id]/war-room` — **Live-Crisis-War-Room** (wie Exercise-War-Room, aber mit echten DORA-Timern)
- `/bcms/crisis/[id]/dora-timer` — 4h / 72h / 1m Deadline-Anzeige
- `/bcms/crisis/[id]/post-mortem` — Post-Mortem-Wizard
- `/bcms/reports/annual/[year]` — Jahres-Performance-Report
- `/bcms/reports/dora/[year]` — DORA-Reporting-View
- `/bcms/lessons` — Lessons-Library (cross-exercise + cross-crisis)
- `/bcms/contact-tree-editor` — Visueller Editor fuer Tree-Hierarchie

### 6.3 UI-Komponenten (Shared/Neu)

- `<BIAHeatmap>` — 2D-Matrix
- `<DependencyGraph>` — Vis.js/D3 Netzwerk
- `<BCPBuilder>` — Drag-Drop Procedure-Sequence
- `<WarRoom>` — Live-Kollaborations-Container
- `<DORATimer>` — Countdown-Widget
- `<LessonCluster>` — Topic-Modeling-Ergebnisse visualisiert
- `<ContactTreeGraph>` — Hierarchisches Tree-Diagram mit Kontakt-Info

## 7. Cross-Module-Integrationen

### 7.1 Mit ISMS-Modul

- **Finding-Sharing**: BC-Exercise-Findings werden zu `isms_nonconformity` wenn Major
- **Threat-Overlap**: ISMS-Threats (Cyber) sind haeufig BCMS-Scenarios (Ransomware)
- **Incident-Escalation**: `security_incident.severity=critical` kann Crisis auslösen

### 7.2 Mit ERM-Modul

- **Risk-Creation**: BCM-Scenario → neue `risk` mit category='business_continuity'
- **Treatment-Loop**: BCP = Treatment fuer Continuity-Risks

### 7.3 Mit BPM-Modul

- **Process-Linkage**: `essential_process.processId` → `process` in BPM
- **Process-Criticality**: BIA aktualisiert `process.isCritical` + `process.criticality_score`
- **Process-Dependencies**: BPM-Process-Flow → `bia_process_impact` Downstream-Mapping

### 7.4 Mit TPRM-Modul

- **Supplier-Dependency**: `bia_supplier_dependency.vendorId` → `vendor`
- **Exit-Plan-Overlap**: TPRM-Exit-Plan = BCMS-Workaround bei Supplier-Failure
- **Concentration-Risk**: TPRM-Concentration-Analysis fliesst in BIA

### 7.5 Mit DORA-Modul

- **Art. 11 Reporting**: `dora_bc_report` aggregiert BCMS-Performance
- **Art. 25 Testing**: `bc_exercise.is_independent_test` fuer DORA-Threat-Led-Penetration-Testing (TLPT)

### 7.6 Mit Audit-Modul

- **BCMS-Audit**: ISO 22301 Clause 9.2 als Audit-Universe-Entry
- **Evidence-Sharing**: BIA + BCP + Exercise-Reports sind Audit-Evidence

## 8. Workflow-Gates (Mandatorisch)

| Gate    | Transition                        | Kriterium                                                                   |
| ------- | --------------------------------- | --------------------------------------------------------------------------- |
| **G1**  | Setup → BIA                       | Policy approved, Team staffed, Contact-Tree populated                       |
| **G2**  | BIA → Strategy                    | mind. 5 `essential_process` haben BIA, alle `criticality_rank` gesetzt      |
| **G3**  | Strategy → BCP                    | Jeder critical-Process (rank=1) hat `continuity_strategy.status='selected'` |
| **G4**  | BCP-Draft → Review                | Mindestens 3 procedures, alle Resources gelinkt                             |
| **G5**  | BCP-Review → Approved             | 2 Reviewer-Signoff (process_owner + risk_manager)                           |
| **G6**  | Approved → Published              | PDF-Export generiert, Physical-Storage-Location dokumentiert                |
| **G7**  | Exercise-Plan → Execute           | Participants bestaetigt, Scenario finalisiert                               |
| **G8**  | Exercise → Close                  | Alle Objectives bewertet, mindestens 1 Lesson erfasst                       |
| **G9**  | Crisis-Activate                   | Severity-Assessment + Authority-Check                                       |
| **G10** | Crisis-Resolve                    | Alle `crisis_log` Entries, RCA erfasst, Comms-Log vollstaendig              |
| **G11** | Annual-Report → Management-Review | Performance-Report generiert, alle Sections populated                       |

## 9. Compliance-Evidence-Pack (ISO 22301 Zertifizierung)

| Dokument                            | Quelle                                             | Format                       |
| ----------------------------------- | -------------------------------------------------- | ---------------------------- |
| BCM-Policy                          | `document` (category='bcm_policy')                 | PDF (user-uploaded)          |
| Scope-Statement                     | `bia_assessment.scope_filter`                      | PDF                          |
| BIA-Report                          | `bia_assessment` + `bia_process_impact` aggregated | PDF mit Heatmap              |
| Continuity-Strategy-Document        | `continuity_strategy` per process                  | PDF                          |
| BCPs (alle approved)                | `bcp` + `bcp_procedure` + `bcp_resource`           | PDF pro Plan + Offline-Print |
| Exercise-Plan (Multi-Year)          | `bc_exercise` scheduled                            | PDF                          |
| Exercise-Reports (letzte 12 Monate) | `bc_exercise` completed + `bc_exercise_lesson`     | PDF pro Exercise             |
| Crisis-Log-Register                 | `crisis_log` last 24 months                        | CSV + PDF                    |
| Management-Review-Minutes           | `management_review` (bcms-type)                    | PDF                          |
| Nonconformity-Register              | `isms_nonconformity` BCM-sourced                   | CSV + PDF                    |
| Audit-Trail-Integrity-Proof         | `/api/v1/audit-log/integrity` snapshot             | JSON + Hash                  |
| DORA Annual-Report (falls FS)       | `dora_bc_report`                                   | Regulator-spezifisch         |

**Generator**: `POST /api/v1/bcms/evidence-pack` (analog ISMS)

## 10. KPIs + Metriken

| KRI                          | Formel                                                                        | Frequenz    |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------- |
| BCMS-Maturity-Index          | Composite aus BIA-Coverage + BCP-Coverage + Exercise-Coverage + RTO-Adherence | pro-Quartal |
| BIA-Coverage                 | count(essential_process WHERE latestBiaAt < 365d) / total                     | daily       |
| BCP-Coverage                 | count(bcp WHERE status='approved' AND approvedAt < 365d) / critical_processes | daily       |
| Exercise-Coverage            | count(bcp WHERE lastExercisedAt < 365d) / total_bcps                          | daily       |
| RTO-Adherence-Rate           | avg(1 - (actual_rto - target_rto) / target_rto) fuer alle Exercises last-12m  | monthly     |
| Crisis-MTTR                  | avg(crisis.resolvedAt - crisis.activatedAt)                                   | quarterly   |
| Crisis-Frequency-by-Severity | count(crisis WHERE severity >= ?) per Jahr                                    | annually    |
| Lessons-Implementation-Rate  | count(lesson.action_status='closed') / total_lessons                          | monthly     |
| Resilience-Score (Composite) | weighted avg all KRIs                                                         | monthly     |
| DORA-Report-Timeliness       | count(crisis WHERE regulator_reported_on_time) / total_reportable             | monthly     |

Alle relevanten KRIs sind Candidates fuer die `kri`-Tabelle und als
Default-Templates in 0103 erweiterbar.

## 11. Session-Outcome + Next-Iteration

**Dieses Dokument (Iter 1)**:

- ✅ BCMS-Plan mit 8 Phasen inkl. Crisis-Management-Lifecycle
- ✅ Entity-Katalog (23 vorhanden, 8 neu)
- ✅ API-Surface (32+ existierend, 17 neu)
- ✅ UI-Surface (7 Pages existierend, 20+ neu/erweitert)
- ✅ DORA-Overlay fuer Finanzsektor
- ✅ Crisis-War-Room-Konzept
- ✅ 11 Workflow-Gates
- ✅ 10-dokumentiges Evidence-Pack
- ✅ 10 KPIs

**Geschaetzter Implementation-Aufwand**:

- Backend: 70-100 Stunden
- Frontend (+War-Room ist komplex): 120-160 Stunden
- Testing: 30-50 Stunden
- Doku + ADRs: 15-25 Stunden
- **Total: ~270 Stunden (~3-4 Personen-Wochen)**

**Offen fuer naechste Sessions**:

- Iter 2: Detail-Specs fuer Phasen 1-3 (Setup, BIA, Risk)
- Iter 3: Detail-Specs fuer Phasen 4-6 (Strategy, BCP, Exercise)
- Iter 4: Detail-Specs fuer Phase 7 (Crisis-War-Room-UX)
- Iter 5: Detail-Specs fuer Phase 8 (Reporting, DORA)

**Besonderheit vs. ISMS**: BCMS hat die **Event-driven Crisis-Management-Schiene**, die in ISMS fehlt. Der War-Room braucht eigene UX-Betrachtung (ggf. separates ADR fuer Real-Time-Kollaborations-Architektur mit WebSockets).
