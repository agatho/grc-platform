# ISMS Assessment Plan

**Frameworks:** ISO/IEC 27001:2022 + NIST CSF 2.0 + ISO/IEC 27005:2022
**Iteration:** 1
**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## 1. Scope + Framework-Landschaft

Das ISMS-Modul ist das groesste und komplexeste der 4 Module. Es vereint
drei parallel anwendbare Frameworks mit ueberlappendem Scope:

| Framework | Fokus | In ARCTOS-Katalog |
|---|---|---|
| **ISO/IEC 27001:2022** | Management-System + 93 Annex-A-Controls | #16 (97 Entries) |
| **ISO/IEC 27002:2022** | Implementation-Guidance fuer 27001-Controls | #4 (97 Entries, 1:1 Mapping) |
| **ISO/IEC 27005:2022** | Risk-Management-Methodik (Threat × Vuln × Asset) | #30 Threats (31) + #31 Vulns (23) |
| **NIST CSF 2.0** | 6 Funktionen: Govern, Identify, Protect, Detect, Respond, Recover | #5 (131 Subcategories) |
| **BSI Grundschutz** | Katalog deutscher Baustein-Anforderungen | #15 (160 Bausteine) |
| **TISAX 6.0** | Automotive-ISMS, basiert auf 27001 | #18 (110 Entries) |
| **CIS Controls v8** | Prioritized control list, IG1/2/3 | #6 (35 Controls) |

Cross-Framework-Mappings (existierend):
- ISO 27001 Annex A ↔ ISO 27002 (93, 1:1)
- ISO 27001 ↔ BSI Grundschutz (64)
- ISO 27001 ↔ TISAX (44)
- ISO 27001 ↔ NIS2 (33)
- NIST CSF ↔ ISO 27002 (89)

Das bedeutet: **Ein einzelnes Assessment kann bis zu 4 Frameworks
gleichzeitig belegen**, wenn die Mappings im Assessment-Run explizit
gepflegt sind.

## 2. Standards-driven Workflow-Map

### ISO/IEC 27001 Clauses → Workflow-Phases

| Clause | Anforderung | Workflow-Phase | ARCTOS-Entity |
|---|---|---|---|
| 4.1 | Context | Setup | `assessment_run.scope_filter.context_factors` |
| 4.2 | Interested Parties | Setup | `stakeholder_portal` + `contract.vendor` |
| 4.3 | Scope | Setup | `assessment_run.scope_filter` + SoA |
| 4.4 | ISMS Establishment | Setup | Platform-weite Aktivierung via `module_config` |
| 5.1 | Leadership | Governance | `management_review.attendees` + Board-Report |
| 5.2 | Policy | Documentation | `document` (Kategorie: `policy`) |
| 5.3 | Roles + Authorities | Governance | `user_organization_role` + `rci_matrix` |
| 6.1.1 | Risks + Opportunities | Risk | `risk`, `risk_assessment` |
| 6.1.2 | Risk Assessment | Risk | **ISO 27005** Workflow (siehe §3.3) |
| 6.1.3 | Risk Treatment | Risk | `risk_treatment`, `risk_acceptance` + Authority |
| 6.2 | Objectives | Governance | `management_review.objectives` |
| 6.3 | Change Planning | Governance | `approval_workflow`, `approval_request` |
| 7.1 | Resources | Budget | `grc_budget` |
| 7.2 | Competence | Awareness | `academy.course`, `certification` |
| 7.3 | Awareness | Awareness | `compliance_culture.campaign` |
| 7.4 | Communication | Governance | `notification`, `incident.communication` |
| 7.5 | Documented Info | Documentation | `document` + Versionierung |
| 8.1 | Operational Control | Execution | `control_test_campaign`, `checklist_instance` |
| 8.2 | Risk Assessment (Op) | Risk | Recurring `risk_assessment` (Worker-Job) |
| 8.3 | Risk Treatment | Risk | `risk_treatment` Execution-Tasks |
| 9.1 | Monitoring + KPI | Analytics | `kri`, `control_maturity`, `control_monitoring_rule` |
| 9.2 | Internal Audit | Audit | Audit-Modul (Sprint 8) |
| 9.3 | Management Review | Governance | `management_review` |
| 10.1 | Nonconformity + CAP | CAP | `isms_nonconformity` + `isms_corrective_action` |
| 10.2 | Improvement | CAP | CAP-Effectiveness-Review |

### NIST CSF 2.0 Funktionen → Workflow-Coverage

| Funktion | Subcategories | ARCTOS-Coverage |
|---|---|---|
| **GV** (Govern) | 31 | `management_review`, `risk_appetite`, `process.governance` |
| **ID** (Identify) | 21 | `asset`, `protection_requirement`, Threat-Landscape, `risk_scenario` |
| **PR** (Protect) | 27 | `control`, `control_test`, Training, Access-Management |
| **DE** (Detect) | 10 | `security_incident`, CVE-Feed, Monitoring-Rules, SIEM-Connector |
| **RS** (Respond) | 19 | Incident-Response, `isms_corrective_action`, Playbooks |
| **RC** (Recover) | 13 | BCMS-Modul (Cross-Link), `bcp` |

Total: **131 Subcategories**, davon ca. 65 direkt durch 27001 Annex A
abgedeckt (via Mapping). Restliche 66 brauchen NIST-spezifische Checks.

### ISO/IEC 27005 Risk-Workflow

Kern: **Risk-Szenario = Threat × Vulnerability × Asset → Impact/Likelihood → Risk-Score**.

```
    ┌─────────┐      ┌───────────────┐      ┌─────────┐
    │ Threat  │ ───▶ │ Vulnerability │ ───▶ │  Asset  │
    └─────────┘      └───────────────┘      └─────────┘
         │                   │                    │
         └───────────┬───────┘                    │
                     ▼                            │
            ┌────────────────┐                    │
            │ Risk-Scenario  │ ◀──────────────────┘
            └────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ Risk-Assessment│  (inherent, current, residual)
            └────────────────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
    ┌───────────┐       ┌─────────────┐
    │ Treatment │       │ Acceptance  │
    └───────────┘       └─────────────┘
```

Entity-Mapping (alles bereits vorhanden):
- `threat` (Catalog #30 + Custom)
- `vulnerability` (Catalog #31 + Custom + CVE-Feed via `cve_feed_item`)
- `asset` (Custom, mit `asset_cpe` fuer CVE-Match)
- `risk_scenario` (verknuepft threat+vuln+asset)
- `risk` (ERM-Hauptentity)
- `risk_assessment` (mehrfach pro Risk, Zeitreihe)
- `risk_treatment` (Mitigation-Actions)
- `risk_acceptance` + `risk_acceptance_authority` (formelle Akzeptanz)
- `soa_entry` (Statement of Applicability)

## 3. Vollstaendiger Assessment-Zyklus

### 3.1 Phase 1 — SETUP (Scope + Team + Framework)

**Trigger**: Neuer Assessment-Zyklus (jaehrlich / nach Incident / nach
Org-Change)

**Aktoren**: admin, risk_manager

**Inputs**:
- Vorheriger Assessment-Run (optional)
- Aktuelle Org-Struktur
- Geschaefts-Kontext (CSRD-Materialitaet, Branche, Regulatorik)

**Outputs**:
- `assessment_run` mit `status='planning'`, `framework=<iso27001|nist_csf|combined>`
- Scope-Filter (Asset-Typen, Geschaeftseinheiten, Standorte, Prozesse)
- Team-Mapping (Lead-Assessor + Control-Owner + DPO)
- Timeline (period_start, period_end)
- Budget-Allocation

**Workflow-States**:
```
[create] → planning → ready_to_execute → in_progress → under_review → completed
                                                               ↘ cancelled
```

**Akzeptanz-Kriterien**:
- [ ] Lead-Assessor zugewiesen
- [ ] Scope-Statement dokumentiert (min. 200 Zeichen)
- [ ] Mindestens ein Katalog via `org_active_catalog` referenziert
- [ ] period_end >= period_start + 14 Tage

**Existierend**:
- ✅ `assessment_run` Tabelle
- ✅ `/api/v1/isms/assessments` CRUD
- 🟡 UI: Create-Wizard fehlt (derzeit nur Liste + Detail)

**Gap**:
- 🔴 Setup-Wizard (3-Step): Name+Framework → Scope-Filter → Team+Timeline
- 🔴 Pre-Setup-Check: "Haben Sie eine gueltige ISMS-Policy?" (Link auf `document`)
- 🔴 Template-basiertes Erstellen (aus Vorjahres-Run)

### 3.2 Phase 2 — FRAMEWORK-SELECTION + SoA-INITIALIZATION

**Trigger**: `assessment_run.status = 'planning'` und Setup-Wizard abgeschlossen

**Aktoren**: admin, risk_manager, auditor

**Inputs**:
- Scope-Statement aus Phase 1
- Org-Context-Flags (Finanzsektor → DORA overlay, Automotive → TISAX)

**Outputs**:
- Per ausgewaehltem Katalog alle catalog_entries → `soa_entry` mit
  applicability='applicable|not_applicable|partially_applicable'
- Default-Applicability-Rules aus `soa_ai_suggestion` (ML-based, falls
  aktiviert)
- Cross-Framework-Mapping gepinnt (ein SoA-Entry kann N Katalog-Entries
  referenzieren via `catalog_entry_mapping`)

**Akzeptanz-Kriterien**:
- [ ] Jeder Annex-A-Control hat expliziten Applicability-Status
- [ ] Jeder "not_applicable" braucht `applicability_justification` (min. 50 Zeichen)
- [ ] Risk-Treatment referenziert existierende Controls

**Existierend**:
- ✅ `soa_entry` Tabelle + UNIQUE(org_id, catalog_entry_id)
- ✅ `/api/v1/isms/soa` CRUD
- ✅ UI unter `/isms/soa`
- ✅ `soa_ai_suggestion` fuer AI-gestuetzte Befuellung

**Gap**:
- 🔴 Bulk-SoA-Initialization aus aktiviertem Katalog (heute per Hand pro Entry)
- 🔴 SoA-Diff-View gegenueber vorheriger Version (Changed-Applicability)
- 🔴 SoA-Export als ISO-27001-konformer Statement (PDF, strukturiert nach Annex-Sektionen)

### 3.3 Phase 3 — ISO 27005 RISK-ASSESSMENT

**Trigger**: SoA initialisiert, Assessment-Run in `ready_to_execute`

**Aktoren**: risk_manager (primary), control_owner (evidence)

**Workflow (Step-by-Step)**:

**3.3.1 — Asset-Inventory-Review**
- Liste aller Assets im Scope mit Protection-Requirements (CIA-Triade)
- `asset_classification` muss vorliegen fuer jeden In-Scope-Asset
- CPE-Match gegen `cve_feed_item` triggert automatische `vulnerability`-Eintraege

**3.3.2 — Threat-Landscape-Mapping**
- Aus Catalog #30 (31 ISO-27005-Threats) + #3 (47 BSI-Elementargefaehrdungen)
- Threat-Category + Wahrscheinlichkeit initialisieren
- Org-spezifische Custom-Threats im gleichen `threat`-Schema

**3.3.3 — Vulnerability-Assessment**
- Aus Catalog #31 (23 ISO-27005-Vulns) + CVE-Feed + Pentest-Findings
- `vulnerability.severity` (cvss-basiert wenn CVE)
- Link auf betroffene Assets via `asset_cpe` / `vulnerability.affected_assets`

**3.3.4 — Risk-Scenario-Generation**
- Fuer jede relevante (Threat × Vuln × Asset)-Kombination: ein
  `risk_scenario`
- AI-Assist: `/api/v1/isms/risk-scenarios/suggest` (existierend?)
- Inherent-Risk-Score berechnet: likelihood × impact ohne Controls
- Link auf existierende `risk`-Entitaet (1:1) oder Auto-Create

**3.3.5 — Current-Risk-Evaluation**
- Fuer jedes `risk_scenario`: `assessment_risk_eval` erzeugen
- `residual_likelihood` / `residual_impact` = Scoring mit aktiven Controls
- `decision`-Enum: accept | mitigate | transfer | avoid | pending

**3.3.6 — Risk-Appetite-Check**
- Vergleich mit `risk_appetite_statement` (aus Sprint 23)
- Wenn residual > appetite → Treatment Pflicht
- Wenn residual ≤ appetite → Akzeptanz moeglich (via `risk_acceptance`)

**3.3.7 — Treatment-Plan-Design**
- Fuer mitigate-Entscheidungen: `risk_treatment` mit Controls,
  Budget, Timeline
- Fuer accept-Entscheidungen: `risk_acceptance` mit
  `risk_level_at_acceptance`, Authority-Check via
  `risk_acceptance_authority`-Matrix

**Existierend**:
- ✅ Alle Entitaeten (threat, vulnerability, asset, risk_scenario, risk, risk_assessment, risk_treatment, risk_acceptance)
- ✅ APIs: `/isms/threats`, `/isms/vulnerabilities`, `/isms/risk-scenarios`
- ✅ UI: `/isms/threats`, `/isms/vulnerabilities`, `/isms/risks`
- ✅ CVE-Feed + Asset-CPE-Matching (`cve_asset_match`)
- ✅ `risk_acceptance` + `risk_acceptance_authority` (Phase-3 neu)

**Gap**:
- 🔴 Guided-Risk-Assessment-Wizard: Asset waehlen → relevante Threats
  aus Katalog + Custom laden → Vulnerabilities matchen → Scenario-Gen
- 🔴 Auto-Threat-Linkage per Asset-Typ (asset_type_risk_recommendation
  ist vorhanden, aber keine UI)
- 🔴 Heatmap-View: alle Risk-Scenarios aus einem Assessment auf Matrix
- 🔴 Risk-Appetite-Check als hartes Gate in Treatment-Creation

### 3.4 Phase 4 — CONTROL-EVALUATION

**Trigger**: Risk-Assessment abgeschlossen, Treatment-Plan fixiert

**Aktoren**: control_owner (primary), risk_manager (review)

**Workflow**:

**3.4.1 — Evaluation-Item-Generation**
- Fuer jeden `soa_entry` mit applicability='applicable' → automatisch
  ein `assessment_control_eval` in `assessmentRun`
- Alternativ per Control-Typ filtern (z. B. nur physical-security-Controls)
- Cross-Asset-Evaluation: ein Control kann mehrfach bewertet werden,
  einmal pro Asset (z. B. "Verschluesselung at-rest" je Datenbank)

**3.4.2 — Per-Item-Bewertung**
- `evalResult`-Enum: effective | partially_effective | ineffective |
  not_applicable | not_evaluated
- Evidence-Attachment: `evidenceDocumentIds[]`
- Interview-Notes (neues Feld?): wen befragt, was gesagt
- Maturity-Score (CMMI 0-5): `currentMaturity`, `targetMaturity`

**3.4.3 — Control-Testing-Kampagne**
- Fuer Key-Controls: `control_test_campaign` starten
- Test-Procedures aus Catalog
- Sampling (audit_sample-Pattern, Sprint 79)
- Findings automatisch erzeugen bei "ineffective"

**3.4.4 — Maturity-Score-Aggregation**
- `control_maturity` wird aus n-Assessments berechnet (average,
  weighted by criticality)
- Trend-Analyse: current vs. previous run

**Existierend**:
- ✅ `assessment_control_eval`
- ✅ `control_maturity`
- ✅ `control_test_campaign`
- ✅ `control_monitoring_rule` (Phase-3 neu, continuous monitoring)
- ✅ `audit_sample` (Phase-3 neu)

**Gap**:
- 🟡 Bulk-Evaluation-UI (heute per Hand pro Item)
- 🔴 Evaluation-Templates pro Framework (z. B. alle Phys-Controls in einem Template)
- 🔴 Peer-Review auf Evaluation (4-Augen-Prinzip vor Run-Finalize)
- 🔴 Maturity-Roadmap-Planner (ist `maturityRoadmapAction` vorhanden,
  aber UI fehlt)

### 3.5 Phase 5 — GAP-ANALYSIS + FINDING-GENERATION

**Trigger**: Assessment-Run hat min. 80 % `completedEvaluations` /
`totalEvaluations`

**Aktoren**: lead_assessor (auto + manual review)

**Outputs**:

**3.5.1 — Automatische Finding-Generation**
- Fuer jede Control-Eval mit `result='ineffective'` → neues `finding`
  (shared entity) mit source='isms_assessment'
- Finding-Severity aus: Control-Criticality × Residual-Risk-Score
- Auto-Link: `finding.assessment_run_id`, `finding.soa_entry_id`,
  `finding.risk_scenario_id` (optional)

**3.5.2 — Maturity-Gap-Heatmap**
- Pro Control: currentMaturity vs. targetMaturity
- Gap-Groesse = (target - current)
- Aggregiert pro Annex-A-Kategorie (Organizational, People, Physical, Technological)

**3.5.3 — Framework-Coverage-Report**
- Per Framework: % der Requirements die als "effective" bewertet sind
- Trend gegen Vorjahr
- Cross-Mapping-Nutzung: wenn ein Control-Eval 3 Frameworks abdeckt,
  zaehlt es 3x in der Coverage-Matrix

**3.5.4 — Risk-Impact-Analysis**
- Welche `risk_scenario`s sind betroffen wenn bewertete Controls
  "ineffective" sind
- Re-Scoring der `risk_assessment.residualImpact` auf Basis der
  aktuellen Controls

**Existierend**:
- ✅ `finding` (shared entity)
- 🟡 Auto-Finding-Generation (Finding-Generator-Route fehlt)
- 🔴 Gap-Heatmap UI
- 🔴 Framework-Coverage-Report-Generator

**Gap**:
- 🔴 API: `POST /api/v1/isms/assessments/{id}/finalize` → generiert Findings,
  berechnet Maturity-Gaps, triggert Framework-Coverage-Report
- 🔴 UI: Heatmap-Widget fuer Control-Maturity-Gap
- 🔴 UI: Framework-Coverage-Dashboard (per-Framework-Progress)

### 3.6 Phase 6 — RISK-TREATMENT + CAP

**Trigger**: Gap-Analysis abgeschlossen

**Aktoren**: risk_manager (treatment), control_owner (CAP-Execution)

**Workflow**:

**3.6.1 — Treatment-Plan-Erstellung**
- Pro high-severity Finding: `risk_treatment` mit:
  - Target-Control (neu oder bestehend)
  - Owner (control_owner)
  - Due-Date
  - Budget via `grc_budget`
  - Expected-Maturity-Gain
- Treatment-Stratgie: new_control | enhance_existing | accept | transfer

**3.6.2 — CAP-Erstellung fuer ISO 27001 Clause 10**
- Pro Nonconformity (= ineffective Control mit Finding):
  - `isms_nonconformity` (Pflicht wenn `severity >= 'major'`)
  - `isms_corrective_action` verknuepft
  - `root_cause_analysis` nach 5-Why-Methode
  - Verification + Effectiveness-Review-Date (ISO 10.1 e + f)

**3.6.3 — Risk-Acceptance-Dokumentation**
- Fuer residual-Risks die unter Risk-Appetite liegen:
  - `risk_acceptance`-Record mit `risk_level_at_acceptance` (Snapshot)
  - Authority-Check: Role matching `risk_acceptance_authority.maxScore >= residual_score`
  - Revoke-Flow falls spaeter Re-Assessment einen hoeheren Score liefert

**Existierend**:
- ✅ `risk_treatment`, `isms_nonconformity`, `isms_corrective_action`, `root_cause_analysis`
- ✅ `risk_acceptance` + Authority-Matrix

**Gap**:
- 🟡 Treatment-Plan ↔ Control-Implementation-Link (heute implizit)
- 🔴 Effectiveness-Review-Reminder-Job (via `reminder_rule`)
- 🔴 Treatment-Budget-vs-Actual-Tracking (heute nur Budget-Plan)
- 🔴 RACI-Matrix fuer CAP-Tasks (Responsible/Accountable/Consulted/Informed)

### 3.7 Phase 7 — REPORTING + MANAGEMENT REVIEW

**Trigger**: Treatments alle geplant (status='planned' → kein pending)

**Aktoren**: lead_assessor (Report-Autor), admin (Management-Review-Host)

**Outputs**:

**3.7.1 — Assessment-Report (strukturiert)**
- **Executive Summary** (1-Seite): Maturity-Score, #Findings, Top-3-Risks
- **Scope + Methodologie** (ISO 27001 Kap. 4)
- **Per-Framework-Coverage** (27001 / NIST / BSI separat + aggregiert)
- **Per-Annex-A-Kategorie Maturity-Scoring**
- **Top-10 Findings** (by Severity × Coverage-Impact)
- **Risk-Landscape-Delta** (current vs. previous assessment)
- **Treatment-Plan-Summary** (Budget, Timeline, Owner)
- **Appendix**: Full Control-Eval-List + Evidence-Register + Interview-Log

**3.7.2 — Management-Review (ISO 27001 Clause 9.3)**
- `management_review`-Record mit:
  - Input-Items: Assessment-Report + KRI-Trends + Audit-Findings + Customer-Complaints
  - Attendees (Board + CISO + DPO + Process-Owner)
  - Decisions: Approved / Conditional / Rejected
  - Follow-up-Actions (Tasks)
- Mandatory-Felder nach ISO: Context-Changes, Performance, Nonconformities, Resources, Communications, Opportunities

**3.7.3 — Board-Report (falls mandatiert)**
- `board_report` (Phase-3) mit Aggregat-Sektionen
- Signed-Off-By + Presented-To Zitat

**3.7.4 — Framework-spezifische Zertifikats-Dokumente**
- ISO 27001: Statement of Applicability + Risk-Treatment-Plan
- NIST CSF: Target Profile + Current Profile + Gap Analysis
- BSI Grundschutz: Referenzdokument A (Strukturanalyse)

**Existierend**:
- ✅ `management_review` (mit Attendees + Decisions)
- ✅ `board_report` (Phase-3)
- 🟡 `narrative_template` + `narrative_instance` (Phase-3, fuer Generated-Report-Sections)
- 🟡 PDF-Export-Engine (Sprint 30 `packages/reporting`)

**Gap**:
- 🔴 Report-Template fuer ISMS-Assessment (analog zu Audit-Report)
- 🔴 Framework-Coverage-Section-Generator
- 🔴 Maturity-Roadmap-Section (naechste 12-36 Monate)
- 🔴 Automatische Report-Regeneration bei Treatment-Update (wenn
  jemand einen Control nachreicht)
- 🔴 Management-Review-Template (Pflichtfelder-Formular nach ISO 9.3)
- 🔴 Certification-Wizard (`cert-wizard.ts` Schema existiert, aber Spec fehlt)

### 3.8 Phase 8 — FOLLOW-UP + NEXT-CYCLE

**Trigger**: Zyklisch (Standard: jaehrlich fuer 27001 Surveillance)

**Aktoren**: lead_assessor + alle Owner

**Workflow**:
- Effectiveness-Review der CAP-Actions nach 90 Tagen (ISO 10.1 f)
- CVE-Feed-Delta seit letztem Run → neue Vulnerabilities
- Reassessment-Bedarf-Check:
  - Neue Assets (seit letztem Run)?
  - Neue Threats (Regulatory-Change, Horizon-Scanner)?
  - Control-Drift (monitoring-rule-Alerts > threshold)?
  - Incident > critical seit letztem Run?

**Output**:
- Neuer `assessment_run` mit `previous_run_id` (wenn bereits existent, sonst neu)
- Delta-Report gegenueber letztem Run

**Gap**:
- 🔴 `assessment_run.previous_run_id` Spalte (heute fehlt)
- 🔴 Worker-Job `isms-reassessment-reminder` (derived aus compliance-calendar 0104)
- 🔴 Delta-Report-Generator

## 4. Entity-Katalog (ISMS-Modul nach Plan)

### 4.1 Vorhanden + OK

| Entity | Tabelle | Verwendung |
|---|---|---|
| Assessment-Run | `assessment_run` | Meta + Scope |
| Asset-Classification | `asset_classification` | CIA-Scoring pro Asset |
| Threat | `threat` | Bedrohungs-Katalog-Entries + Custom |
| Vulnerability | `vulnerability` | Schwachstellen (CVE + manual) |
| Risk-Scenario | `risk_scenario` | Threat × Vuln × Asset |
| Control-Eval | `assessment_control_eval` | Per-Control-Bewertung im Run |
| Risk-Eval | `assessment_risk_eval` | Per-Scenario-Bewertung im Run |
| Control-Maturity | `control_maturity` | CMMI-Scoring (aggregate) |
| SoA-Entry | `soa_entry` | Statement of Applicability |
| Management-Review | `management_review` | ISO 9.3 Dokumentation |
| Security-Incident | `security_incident` | Incident-Lifecycle |
| CVE-Feed | `cve_feed_item` | Externe Vulnerability-Quelle |
| Asset-CPE | `asset_cpe` | CPE-Strings fuer CVE-Match |
| CVE-Asset-Match | `cve_asset_match` | Verknuepfung |
| SoA AI-Suggestion | `soa_ai_suggestion` | AI-Vorschlag fuer Applicability |
| Maturity-Roadmap-Action | `maturity_roadmap_action` | Geplante Maturity-Verbesserungen |
| ISMS-Nonconformity | `isms_nonconformity` | CAP-Input (ISO 10.1) |
| ISMS-Corrective-Action | `isms_corrective_action` | CAP-Output |
| Root-Cause-Analysis | `root_cause_analysis` | 5-Why etc. |

### 4.2 Neu (benoetigt fuer vollstaendigen Zyklus)

| Entity | Zweck | Priorisierung |
|---|---|---|
| `assessment_scope` | Strukturierte Scope-Definition (statt nur scope_filter JSON) | Medium |
| `assessment_team_member` | Role-im-Assessment (lead, evaluator, observer) mit Berechtigung-Scope | Medium |
| `interview_note` | Interview-Dokumentation pro Eval (wie audit_evidence, aber speziell fuer Interviews) | Low |
| `assessment_report` | Snapshot-Container fuer generierten Report-Inhalt | High |
| `framework_coverage_snapshot` | Pro Framework % der Requirements als erfuellt | High |
| `assessment_delta` | Diff-View zwischen 2 Runs | Low |
| `evaluation_template` | Vorlage fuer haeufig wiederholte Evaluations (z. B. "All Phys-Controls") | Low |

## 5. API-Surface (neu + existierend)

### 5.1 Existierend

```
GET    /api/v1/isms/assessments
POST   /api/v1/isms/assessments
GET    /api/v1/isms/assessments/{id}
PATCH  /api/v1/isms/assessments/{id}
DELETE /api/v1/isms/assessments/{id}
GET    /api/v1/isms/assessments/{id}/evaluations
POST   /api/v1/isms/assessments/{id}/evaluations
PATCH  /api/v1/isms/assessments/{id}/evaluations/{evalId}

GET    /api/v1/isms/threats
POST   /api/v1/isms/threats
GET    /api/v1/isms/vulnerabilities
POST   /api/v1/isms/vulnerabilities
GET    /api/v1/isms/risk-scenarios
POST   /api/v1/isms/risk-scenarios
GET    /api/v1/isms/soa
POST   /api/v1/isms/soa
GET    /api/v1/isms/maturity
GET    /api/v1/isms/incidents
POST   /api/v1/isms/incidents
GET    /api/v1/isms/reviews
POST   /api/v1/isms/reviews
GET    /api/v1/isms/dashboard
GET    /api/v1/isms/cve
GET    /api/v1/isms/nonconformities
POST   /api/v1/isms/nonconformities
```

### 5.2 Neu benoetigt

```
POST   /api/v1/isms/assessments/{id}/setup-wizard
       Body: { name, framework, scope, team, timeline }
       Effekt: assessment_run + initial soa_entries aus Katalog

POST   /api/v1/isms/assessments/{id}/scope
       Body: { scope_type, scope_filter: { asset_ids, process_ids, unit_ids, location_ids } }

POST   /api/v1/isms/assessments/{id}/initialize-soa
       Body: { catalog_ids: [...], default_applicability }
       Effekt: Bulk-Create soa_entry fuer jeden Katalog-Entry

POST   /api/v1/isms/assessments/{id}/generate-evaluations
       Body: { scope: 'all_applicable' | 'selected_controls', control_ids?: [...] }
       Effekt: Bulk-Create assessment_control_eval

POST   /api/v1/isms/assessments/{id}/risk-assessment/generate-scenarios
       Body: { include_catalog_threats, include_cve_feed, asset_filter }
       Effekt: Bulk-Create risk_scenario + assessment_risk_eval

POST   /api/v1/isms/assessments/{id}/finalize
       Effekt: Auto-generate findings, compute maturity, create report snapshot, trigger management_review

GET    /api/v1/isms/assessments/{id}/report
       Returns: Structured assessment_report JSON + attached evidence hashes

GET    /api/v1/isms/assessments/{id}/framework-coverage
       Returns: { "iso27001": {total, evaluated, effective, %}, "nist_csf": {...}, ... }

GET    /api/v1/isms/assessments/{id}/delta/{previousId}
       Returns: { added_findings, closed_findings, maturity_delta, new_risks, ... }

POST   /api/v1/isms/assessments/{id}/management-review
       Body: { attendees, input_items, decisions, follow_up_tasks }
       Effekt: management_review-Record + optional Tasks

POST   /api/v1/isms/assessments/{id}/board-report
       Body: { sections, data_snapshots }
       Effekt: board_report-Record

GET    /api/v1/isms/maturity/roadmap
       Returns: Aktive maturity_roadmap_action + Prio-Ranking

POST   /api/v1/isms/risk-scenarios/{id}/treatment
       Body: { treatment_type, controls, budget, timeline, owner }
       Effekt: risk_treatment-Record verknuepft

POST   /api/v1/isms/risk-scenarios/{id}/accept
       Body: { justification, revoke_on }
       Effekt: risk_acceptance-Record, Authority-Check automatisch
```

### 5.3 API-Level Middleware-Chain (Pflicht)

```typescript
const ctx = await withAuth("admin", "risk_manager", "auditor");
if (ctx instanceof Response) return ctx;
const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
if (moduleCheck) return moduleCheck;
// Zod-Validation
// DB-Operation in withAuditContext(ctx, async (tx) => {...})
```

## 6. UI-Surface

### 6.1 Existierend

- `/isms` — Overview
- `/isms/assessments` — Run-List
- `/isms/assessments/[id]` — Run-Detail (Evaluations)
- `/isms/soa` — Statement-of-Applicability
- `/isms/threats`, `/isms/vulnerabilities`, `/isms/risks`
- `/isms/incidents`, `/isms/playbooks`
- `/isms/maturity`, `/isms/posture`
- `/isms/cap` — Nonconformities + Corrective Actions
- `/isms/certifications` — Cert-Status (ISO/BSI/TISAX)
- `/isms/nis2`, `/isms/cve`
- `/isms/attack-paths`, `/isms/threat-landscape`

### 6.2 Neu benoetigt

- `/isms/assessments/new` — **3-Step-Wizard** (Setup)
  - Step 1: Name + Framework-Auswahl (Multi-Select) + Reference-Framework-Map
  - Step 2: Scope (Asset-Selector, Process-Selector, Unit-Filter)
  - Step 3: Team + Timeline + Budget-Allocation
- `/isms/assessments/[id]/scope` — Scope-Definition-Manager
- `/isms/assessments/[id]/risk-assessment` — 27005-Flow-Wizard
  (Assets → Threats → Vulns → Scenarios → Decisions)
- `/isms/assessments/[id]/evaluations/bulk` — Bulk-Edit-UI
  (Multi-Select-Controls, Apply-Template-Button)
- `/isms/assessments/[id]/finalize` — Finalization-Dashboard
  (alle Checks vor Finalize, Generate-Report-Button)
- `/isms/assessments/[id]/report` — Report-Viewer (mit Sections-Nav, Download-PDF-Button)
- `/isms/assessments/[id]/delta/[prevId]` — Delta-Viewer (What-Changed)
- `/isms/management-review/new` — Management-Review-Form (Pflichtfelder)
- `/isms/dashboard/framework-coverage` — Cross-Framework-Heatmap
- `/isms/dashboard/maturity-roadmap` — Gantt-Chart der Roadmap-Actions
- `/isms/risk-assessment-wizard` — Standalone-Wizard (ausserhalb eines Runs)

### 6.3 UI-Komponenten (Shared)

- `<MaturityRadar>` — Spider-Chart 27001-Kategorien
- `<FrameworkCoverageMatrix>` — Table pro Framework × Maturity
- `<RiskHeatmap>` — 5x5 Matrix Likelihood × Impact
- `<SoADiffView>` — Changed Applicability gegenueber Vorversion
- `<EvidenceUploader>` — wiederverwendet aus Audit-Modul
- `<ControlEvalCard>` — kompakter Eval-Record mit Inline-Edit
- `<FindingPreviewCard>` — Shared mit Audit-Modul

## 7. Integrations-Points (Cross-Module)

### 7.1 Mit Audit-Modul

- **Internal Audit fuer 27001 Clause 9.2**: Audit-Plan erzeugt `audit`-Records,
  deren Findings koennen automatisch `isms_nonconformity` erzeugen
  (wenn severity >= 'major')
- **Evidence-Sharing**: audit_evidence kann als assessment_control_eval.evidence
  verwendet werden (via evidence_document_ids)

### 7.2 Mit ERM-Modul

- **Risk-Create/Update**: Assessment-Risk-Eval → Auto-Create/Update in `risk`
  via `erm_sync_config` (Phase-3 neu)
- **Risk-Treatment-Loop**: Findings mit `riskId` → `risk_treatment` (Audit-ERM-Loop, bereits implementiert)
- **Risk-Acceptance-Authority**: Matrix wird pro-org konfiguriert,
  Assessment-Run prueft gegen `max_score`

### 7.3 Mit BCMS-Modul

- **BIA → ISMS-Asset-Scoring**: BIA-Impact-Scores koennen
  Asset-Protection-Requirements aktualisieren
- **Incident-Response**: security_incident triggert BCMS-Crisis-Scenario
  wenn severity >= 'critical'

### 7.4 Mit DPMS-Modul

- **GDPR Art. 32 TOMs**: Catalog #24 (56 TOMs) ist aktivierbar und
  wird Teil der SoA
- **Data-Breach-Notification**: `security_incident.is_data_breach=true`
  startet `data_breach`-Flow im DPMS-Modul

### 7.5 Mit AI-Act-Modul

- **Asset-Inventory-Overlap**: `asset` kann `ai_system` referenzieren
  (wenn Asset ein AI-System ist)
- **ISO 42001 Overlay** (zukuenftig): AI-Management-System als
  ISMS-Subset

## 8. Workflow-Gates (Mandatorisch)

| Gate | Trigger | Check | Wenn Fehler |
|---|---|---|---|
| **G1** | Setup → Framework-Select | Scope-Statement >= 200 chars, Lead-Assessor zugewiesen, period >= 14d | BlockTransition |
| **G2** | Framework-Select → Execution | SoA initialisiert, mind. 80 % Applicability gesetzt | BlockTransition |
| **G3** | Risk-Assessment → Control-Evaluation | Jeder `risk_scenario` hat `decision != 'pending'` | BlockTransition |
| **G4** | Control-Eval → Gap-Analysis | `completedEvaluations / totalEvaluations >= 0.8` | BlockTransition |
| **G5** | Gap-Analysis → Treatment | Jeder `finding.severity >= 'major'` hat `risk_treatment` | BlockTransition |
| **G6** | Treatment → Reporting | Jedes `risk_treatment.status != 'proposed'` | BlockTransition |
| **G7** | Reporting → Management-Review | `assessment_report` generiert, alle Sections populated | BlockTransition |
| **G8** | Management-Review → Archive | `management_review.status='completed'`, Follow-up-Tasks erzeugt | BlockTransition |

Implementation: Zustaendig-Transitions als State-Machine in
`packages/shared/src/state-machines/isms-assessment.ts`. Jeder State-
Transition-Check gibt Response-Objekt mit `blockers: []` zurueck.

## 9. Compliance-Evidence-Pack

Nach erfolgreichem Zyklus muss ARCTOS ein "Evidence-Pack" liefern koennen,
das Tenant-Auditor/Zertifizierer als Nachweis akzeptiert:

| Dokument | Quelle | Format |
|---|---|---|
| Scope-Statement | `assessment_run.scope_filter` + Free-Text | PDF |
| ISMS-Policy | `document` (category='isms_policy') | PDF (user-uploaded) |
| SoA | `soa_entry` + catalog-Name-Join | PDF strukturiert nach Annex-Kategorien |
| Risk-Assessment-Report | `assessment_risk_eval` aggregated | PDF mit Heatmap |
| Risk-Treatment-Plan | `risk_treatment` aggregated | PDF mit Timeline + Budget |
| Control-Evaluation | `assessment_control_eval` + evidence | PDF + ZIP (Evidence-Attachments) |
| Management-Review-Minutes | `management_review` + attendees | PDF |
| CAP-Register | `isms_nonconformity` + `isms_corrective_action` | PDF |
| Audit-Trail-Integrity-Proof | `/api/v1/audit-log/integrity` Response-Snapshot | JSON + Hash |
| Certification-Cross-Reference | `catalog_entry_mapping` angewendet | HTML/PDF |

**Report-Generator-Orchestrierung**:

```
POST /api/v1/isms/assessments/{id}/evidence-pack
  → Spawn Worker-Job
  → Sammelt alle obigen Dokumente
  → Generiert ZIP mit Manifest.json (SHA-256 pro File)
  → Upload zu `document`-Tabelle (category='evidence_pack')
  → Notification an lead_assessor
```

## 10. Quality-Gates (QA-Review innerhalb des Assessments)

Analog zu Audit-Modul's `audit_qa_review`:

| Check | Ausloeser | Kriterium |
|---|---|---|
| Evidence-Completeness | Jeder Eval mit `result='effective'` | evidence != null OR evidence_document_ids nicht leer |
| Interview-Completeness | Jede Control-Eval mit specific types | Mindestens 1 `interview_note` |
| Scope-Consistency | Finalize | Jeder evaluator-Eval liegt im Scope-Filter |
| Maturity-Sanity | Finalize | `currentMaturity <= targetMaturity` fuer alle |
| Evidence-Provenance | Finalize | Jede evidence_document_id verweist auf existierendes `document` |
| Cross-Framework-Consistency | Finalize | Wenn ein Control in 2 Frameworks, ist Bewertung konsistent |

Implementation: `POST /api/v1/isms/assessments/{id}/qa-check` liefert
pro-Check-Status + blocker-Liste.

## 11. KPIs + Metriken (fuer Dashboard)

Platform-seitige KRIs die pro-Org berechnet werden:

| KRI | Formel | Quelle | Frequenz |
|---|---|---|---|
| ISMS-Maturity-Index | avg(control_maturity.currentMaturity) weighted | assessment_control_eval | pro Run + daily-roll-up |
| Open-Nonconformities | count(isms_nonconformity WHERE status != 'closed') | `isms_nonconformity` | real-time |
| Overdue-CAP-Rate | count(isms_corrective_action WHERE due_date < now AND status != 'closed') / total CAP | `isms_corrective_action` | daily |
| Unresolved-Critical-Risks | count(risk WHERE severity='critical' AND status='open') | `risk` (ERM) | real-time |
| CVE-Match-Rate | count(vulnerability WHERE source='cve_feed' AND age > 30d AND patched=false) | `vulnerability` | daily |
| Control-Test-Pass-Rate | count(control_test WHERE result='pass') / total control_tests | `control_test` | weekly |
| Incident-MTTD | avg(incident.detected_at - incident.occurred_at) | `security_incident` | weekly |
| Incident-MTTR | avg(incident.closed_at - incident.detected_at) | `security_incident` | weekly |
| Framework-Coverage-Score | per-framework % effective / applicable | `soa_entry` + `assessment_control_eval` | pro Run |

Alle bereits in KRI-Template-Katalog (0103) vorgeschlagen oder implizit.

## 12. Session-Outcome + Next-Iteration

**Dieses Dokument (Iter 1)**:
- ✅ ISMS-Assessment-Plan in End-to-End-Struktur mit 8 Phasen
- ✅ Entity-Katalog + Gap-List
- ✅ API-Surface neu/existierend
- ✅ UI-Surface neu/existierend
- ✅ Cross-Module-Integrations
- ✅ Workflow-Gates + Quality-Gates
- ✅ Compliance-Evidence-Pack-Definition
- ✅ KPIs + Metriken

**Geschaetzter Implementation-Aufwand** (vorlaeufig, ohne Sprint-Breakdown):
- Backend (APIs neu + State-Machine + Report-Generator): 80-120 Stunden
- Frontend (Wizards + Dashboards + Report-Viewer): 100-140 Stunden
- Testing (Unit + RLS + E2E): 40-60 Stunden
- Doku + ADRs + Training-Material: 20-30 Stunden
- **Total: ~300 Stunden (etwa 4-5 Personen-Wochen)**

**Offen fuer naechste Sessions** (Iterationen):
- **Iter 2**: Detail-Specs fuer Phasen 1-3 (Setup-Wizard, SoA-Init, 27005-Risk-Flow)
- **Iter 3**: Detail-Specs fuer Phasen 4-5 (Control-Eval, Gap-Analysis)
- **Iter 4**: Detail-Specs fuer Phasen 6-8 (Treatment, Reporting, Follow-up)
- **Iter 5**: State-Machine-Implementation-Spec
- **Iter 6**: Evidence-Pack-Generator-Spec

**Deliverables dieser Iteration abgeschlossen**.
