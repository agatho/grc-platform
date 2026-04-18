# AI-Act Assessment Plan

**Framework:** EU Artificial Intelligence Act (Regulation 2024/1689)
**Iteration:** 1
**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## 1. Scope + Framework-Landschaft

Das AI-Act-Modul ist das **juengste und regulatorisch anspruchsvollste**
Modul. EU AI Act kombiniert Produkt-Sicherheits-Recht (Konformitaet,
CE-Kennzeichnung-aehnlich) mit Grundrechte-Schutz (FRIA, Transparenz).

| Framework | Fokus | In ARCTOS-Katalog |
|---|---|---|
| **EU AI Act 2024/1689** | 6 AI-Risiko-Kategorien + GPAI-Regime | #13 (63 Entries) |
| **ISO/IEC 42001:2023** | AI-Management-System (AIMS) | n/a, ADR-Referenz |
| **NIST AI RMF 1.0** | Risk-Management-Framework | n/a, als Cross-Mapping |
| **ISO/IEC 23894:2023** | AI Risk-Management-Guidance | n/a |
| **ISO/IEC 42005** (Draft) | FRIA-Guidance | n/a, fuer spaeter |
| **EU AI Code of Practice** | Fuer GPAI Providers | `ai_gpai_model.code_of_practice_notes` |

**Zeitschiene (AI-Act-Anwendungsdaten)**:
- **2. Februar 2025** — Prohibited-Practices (Art. 5) gelten
- **2. August 2025** — GPAI-Obligations + Penalties (Art. 99-101)
- **2. August 2026** — High-Risk-Systems gelten voll (Annex III)
- **2. August 2027** — High-Risk-Systems in Produkt-Sicherheits-Regulationen

**ARCTOS-Fokus**: Ab 2026 muessen Tenants vollstaendige
Conformity-Assessments, Post-Market-Monitoring, Human-Oversight-Logs,
FRIAs und Transparenz-Dokumentation fuehren.

## 2. AI-Act-Struktur → Workflow-Map

### Risk-Kategorien + zugehoerige Workflows

| Risiko-Stufe | Beispiele | ARCTOS-Workflow |
|---|---|---|
| **Prohibited** (Art. 5) | Social-Scoring, Subliminale Manipulation, Biometric Categorization | Screening via `ai_prohibited_screening` → Block |
| **High-Risk** (Annex III) | Biometric-ID, Critical-Infra, Education, Employment, Law-Enforcement | Vollstaendig: QMS, Risk-Mgmt, Data-Gov, Docs, Logs, Human-Oversight, Conformity-Assessment |
| **Limited-Risk** (Art. 50) | Chatbots, Emotion-Recognition, Deep-Fakes | Transparenz-Pflichten via `ai_transparency_entry` |
| **Minimal-Risk** | Video-Games, Spam-Filter | Voluntary Codes-of-Conduct |
| **GPAI** (Art. 51-55) | Foundation Models (GPT, Claude, Llama) | `ai_gpai_model`-Register, Code-of-Practice, Training-Data-Summary |
| **GPAI-SR** (Systemic Risk) | Ueber 10^25 FLOPs | Zusaetzlich: Adversarial-Testing, Incident-Reporting |

### AI-Act-Kapitel → ARCTOS-Entity

| Kap. | Inhalt | ARCTOS-Entity |
|---|---|---|
| I | General Provisions | Platform-Setup |
| II | Prohibited-Practices (Art. 5) | `ai_prohibited_screening` |
| III | High-Risk-Systems | |
| III.1 (Art. 6-7) | Classification | `ai_system.risk_category` |
| III.2 (Art. 8-17) | Requirements for High-Risk | 10 Provider-Requirements |
| III.3 (Art. 16-27) | Obligations | Provider + Deployer Roles |
| III.4 (Art. 28-39) | Notified Bodies + Conformity | `ai_conformity_assessment` |
| III.5 (Art. 40-42) | Standards + Common Specs | `ai_framework_mapping` |
| IV | Transparency (Art. 50) | `ai_transparency_entry` |
| V | GPAI (Art. 51-55) | `ai_gpai_model` |
| VI | Innovation | Sandbox-Teilnahme (optional) |
| VII | Governance | AI-Office + National Authorities |
| VIII | EU-Database | Registration in EU-DB (wenn Provider) |
| IX | Post-Market-Monitoring + Incidents | `ai_incident` + `ai_corrective_action` |
| X | Codes-of-Conduct | `ai_gpai_model.code_of_practice_notes` |
| XI | Delegation + Enforcement | `ai_penalty` + `ai_authority_communication` |
| XII | Penalties | `ai_penalty` (tracking, nicht assessment) |

## 3. Vollstaendiger AI-Act-Zyklus

### 3.1 Phase 1 — AI-SYSTEM-INVENTORY + CLASSIFICATION

**Trigger**: Neues AI-System-Deployment ODER Annual-Re-Classification

**Aktoren**: ai_product_owner, risk_manager, dpo

**Workflow**:

**3.1.1 — AI-System-Registrierung**
- `ai_system`-Record pro AI-System:
  - `name`, `version`, `description`
  - `intended_purpose` (kritisch fuer Klassifikation)
  - `role`: provider | deployer | importer | distributor
  - `development_stage`: research | prototype | production | retired
  - `deployment_context` (Intern, Kunden-facing, EU-only, Global)
  - `data_sources` (Training + Production)
  - `model_type`: classical_ml | deep_learning | gpai_foundation | rule_based | hybrid

**3.1.2 — Prohibited-Practices-Screening (Art. 5)**
- `ai_prohibited_screening` pro System (**PFLICHT** vor Production):
  - 8 Boolean-Checks:
    - `subliminal_manipulation` (Art. 5(1)(a))
    - `exploitation_vulnerable` (Art. 5(1)(b))
    - `social_scoring` (Art. 5(1)(c))
    - `predictive_policing_individual` (Art. 5(1)(d))
    - `facial_recognition_scraping` (Art. 5(1)(e))
    - `emotion_inference_workplace` (Art. 5(1)(f))
    - `biometric_categorization` (Art. 5(1)(g))
    - `real_time_biometric_public` (Art. 5(1)(h))
  - `has_prohibited_practice` (GENERATED AS OR)
  - Bei `true`: **HARD-STOP** — System darf nicht deployed werden
  - `exception_applied` + `exception_justification` (z. B. Law-Enforcement-Exception)

**3.1.3 — High-Risk-Classification (Art. 6-7 + Annex III)**
- Decision-Tree:
  - Annex I (Produkt-Sicherheits-Listen) Product + Safety-Component → High-Risk
  - Annex III (8 Use-Case-Kategorien):
    1. Biometrics (Identification, Categorization)
    2. Critical Infrastructure (Energy, Transport)
    3. Education + Vocational Training
    4. Employment, Worker-Management
    5. Access to Essential Services + Welfare
    6. Law Enforcement
    7. Migration, Asylum, Border Control
    8. Justice + Democratic Processes
  - Art. 6(3) Ausnahmen (wenn nur Hilfs-Aufgabe / nicht ergebnis-beeinflussend)
- `ai_system.risk_category`: prohibited | high_risk | limited_risk | minimal_risk | gpai | gpai_sr

**3.1.4 — GPAI-Identification (Art. 51-55)**
- Falls `model_type='gpai_foundation'`:
  - `ai_gpai_model`-Record anlegen
  - `systemic_risk_justification` (>= 10^25 FLOPs → GPAI-SR)
  - `computational_resources`, `training_data_summary`

**3.1.5 — Role-Assignment**
- Provider (Entwickler) oder Deployer (Nutzer)?
- Bei multi-role: mehrere `ai_system`-Records oder Role-Array

**Existierend**:
- ✅ `ai_system`, `ai_prohibited_screening`, `ai_gpai_model`
- ✅ `/api/v1/ai-act/systems`, `/api/v1/ai-act/prohibited`, `/api/v1/ai-act/gpai`
- ✅ UI: `/ai-act/systems`, `/ai-act/prohibited`, `/ai-act/gpai`

**Gap**:
- 🔴 **AI-System-Registration-Wizard** (6-Step: Info → Prohibited-Check →
  Classification → Role → GPAI-Check → Finalize)
- 🔴 Classification-Decision-Tree-UI (interaktiv, mit Tooltips je Annex-III-Kategorie)
- 🔴 AI-System-Inventory-Dashboard (counts per risk_category + Trends)
- 🔴 Prohibited-Practice-Hard-Stop (API + UI blocks Transition zu 'production')
- 🔴 GPAI-Automatic-Detection (wenn Model-Paper/Vendor-Data verfuegbar)

### 3.2 Phase 2 — PROVIDER-QMS (Art. 17, fuer High-Risk)

**Trigger**: AI-System als high_risk klassifiziert UND Rolle = provider

**Aktoren**: ai_system_owner, compliance_manager

**Workflow**:

**3.2.1 — QMS-Setup (Quality Management System)**
- `ai_provider_qms` pro AI-System (oder shared ueber mehrere Systeme):
  - 10 Procedure-Checks (alle required):
    - `risk_management_procedure`
    - `data_governance_procedure`
    - `technical_documentation_procedure`
    - `record_keeping_procedure`
    - `transparency_procedure`
    - `human_oversight_procedure`
    - `accuracy_robustness_procedure`
    - `cybersecurity_procedure`
    - `incident_reporting_procedure`
    - `third_party_management_procedure`
  - `overall_maturity` (Composite, 0-100)
  - `last_audit_date`, `next_audit_date`
  - `responsible_id` (person)

**3.2.2 — Policy-Document-Creation**
- Pro Procedure: verlinktes `document`
- Templates vorausgefuellt nach ISO 42001 + AI-Act-Anforderungen
- Approval-Flow via `approval_workflow`

**3.2.3 — Continuous-Maturity-Assessment**
- Quartalsweise: Gap-Check vs ISO 42001
- `maturity_roadmap_action` fuer Verbesserungen

**Existierend**:
- ✅ `ai_provider_qms`
- ✅ `/api/v1/ai-act/qms`
- ✅ UI: `/ai-act/qms`

**Gap**:
- 🔴 QMS-Setup-Wizard (ein Procedure pro Step)
- 🔴 Policy-Template-Pack (10 Templates vorbereitet)
- 🔴 ISO-42001-Gap-Analysis
- 🔴 QMS-Maturity-Trend-Dashboard

### 3.3 Phase 3 — RISK-MANAGEMENT (Art. 9)

**Trigger**: High-Risk-System in Development-/Production

**Aktoren**: ai_risk_manager, ml_engineer, domain_expert

**Workflow**:

**3.3.1 — Risk-Identification**
- Pro AI-System: systematische Risk-Identification
- Inputs:
  - Use-Case-Analysis (welche Harms sind moeglich?)
  - Data-Bias-Analysis (diskriminierende Outputs?)
  - Adversarial-Attacks (Robustness-Testing-Results)
  - Model-Card (Limitations des Modells)
- Output: `risk`-Entities mit `category='ai_act'` + `ai_system_id` Link

**3.3.2 — Iterative-Risk-Estimation**
- Pro Risk: Likelihood + Impact
- Impact-Dimensionen: Discrimination, Privacy-Harm, Physical-Safety,
  Property-Damage, Financial-Loss, Reputation, Democratic-Process
- Inherent + Residual nach Measures

**3.3.3 — Risk-Treatment**
- Measures-Design analog ISMS-27005-Flow
- Typen: Technical (bias-correction, adversarial-training) + Operational
  (human-oversight, escalation-procedures)
- Link auf `risk_treatment` im ERM-Modul

**3.3.4 — Testing + Validation**
- Pre-Market: Training-Test-Validation-Split mit Bias-Metriken
- Operational-Metrics: Accuracy, Robustness, Fairness, Explainability
- Per-Cohort-Analyse (Demographic-Slicing)
- Evidence: Test-Reports als `document`

**Existierend**:
- ✅ `ai_system` Cross-Link zu `risk` via `aiSystemId`
- Re-use ERM-Modul fuer `risk`, `risk_assessment`, `risk_treatment`

**Gap**:
- 🔴 AI-Risk-Taxonomy (Preset-Risks je Use-Case)
- 🔴 Bias-Metriken-Tracking-Dashboard
- 🔴 Adversarial-Testing-Playbook
- 🔴 Model-Card-Template + Generator
- 🔴 Per-Cohort-Analyse-UI

### 3.4 Phase 4 — DATA-GOVERNANCE (Art. 10)

**Trigger**: High-Risk-System mit Training-Data

**Aktoren**: data_scientist, dpo, ai_compliance

**Workflow**:

**3.4.1 — Training-Data-Documentation**
- Per AI-System:
  - Data-Sources (welche Datasets, wer Owner, wie erworben)
  - Data-Collection-Process
  - Labeling-Process (wer labelte, welches Schema)
  - Data-Cleaning-Steps
  - Dataset-Size + Statistics
  - Demographic-Coverage (Fairness-Baseline)

**3.4.2 — Data-Quality-Checks**
- Relevance: passt das Training-Data zum Use-Case?
- Representativeness: sind alle Subgroups vertreten?
- Errors: Labelling-Errors-Rate
- Biases: Statistical-Tests auf Protected-Attributes
- Completeness: Missing-Data-Rate

**3.4.3 — Data-Governance-Documentation**
- Neues `document` mit `category='ai_data_governance'`
- Referenziert in `ai_provider_qms.data_governance_procedure`

**3.4.4 — DPIA-Cross-Link** (wenn Personal-Data)
- Wenn Training-Data personenbezogen: DPIA-Pflicht
- Link auf `dpia`-Record im DPMS-Modul

**Existierend**:
- Keine dedizierten Tables, nutzt `document` + Cross-Links

**Gap**:
- 🔴 Data-Governance-Assessment-Wizard
- 🔴 Bias-Testing-Framework-Integration (oder Self-Service)
- 🔴 Data-Sheet-Generator (Mitchell et al. Standard)
- 🔴 Training-Data-Lineage (mit `data_lineage_entry` Phase-3-Integration)

### 3.5 Phase 5 — TECHNICAL-DOCUMENTATION (Art. 11, Annex IV)

**Trigger**: Before Placing-on-Market oder Putting-into-Service

**Aktoren**: ai_system_owner, ml_engineer, legal

**Workflow**:

**3.5.1 — Annex-IV-Dokumentation**
Pflicht-Inhalte (9 Sektionen):
1. General description of the AI system
2. Detailed description of elements + development process
3. Information on monitoring, functioning, and control
4. Description of appropriateness of performance metrics
5. Detailed description of risk management system
6. Description of changes during lifecycle
7. List of harmonised standards applied
8. Copy of EU declaration of conformity
9. Description of post-market monitoring plan

**3.5.2 — Implementation**
- Neues `document` mit `category='ai_technical_documentation'`
- Strukturierte Sektionen (Wizard mit 9 Steps)
- Versionierung pflicht
- Upload aller referenzierten Sub-Documents

**3.5.3 — EU-Database-Registration (Art. 49)**
- Wenn high-risk AND in Markt eingeführt:
  - Registration in EU-Database (extern, aber ARCTOS traegt Referenz)
  - `ai_system.eu_db_registration_id`

**Gap (gesamt neu)**:
- 🔴 `ai_technical_documentation` Entity (dediziert, nicht nur `document`)
- 🔴 Annex-IV-Wizard (9-Step)
- 🔴 Auto-Population aus `ai_system` + `ai_conformity_assessment`
- 🔴 EU-Database-Registration-Tracker

### 3.6 Phase 6 — RECORD-KEEPING + LOGGING (Art. 12)

**Trigger**: Continuous waehrend Production

**Aktoren**: automated + ai_system_operator

**Workflow**:

**3.6.1 — Automatic-Logging-Config**
- Pro AI-System konfigurierbar:
  - Input-Data-Sample (bei Privacy-Concerns: hashed oder opt-out)
  - Output-Data
  - Confidence-Scores
  - Model-Version (fuer Reproduzierbarkeit)
  - Context (User-ID bei decision-assisting, System-State)

**3.6.2 — Log-Retention**
- Mindestens 6 Monate (Art. 12(3))
- Cross-Link zu `retention_schedule` (DPMS)
- Audit-Trail via `audit_log`-Chain

**3.6.3 — Query-Interface**
- Bei Incident/Audit: Logs durchsuchbar
- Export fuer Behoerden-Anfragen

**Gap (meist neu)**:
- 🔴 `ai_operational_log` Entity (event-stream, moeglicherweise TimescaleDB)
- 🔴 Log-Configuration-UI pro System
- 🔴 Log-Query-Dashboard
- 🔴 Log-Export-API

### 3.7 Phase 7 — TRANSPARENCY (Art. 13)

**Trigger**: Deployment-Stage

**Aktoren**: ai_product_owner, ux_designer

**Workflow**:

**3.7.1 — Instructions-for-Use**
- Pflicht-Dokumentation fuer Deployers:
  - Identitaet Provider + Contact
  - Intended-Purpose
  - Level of Accuracy + Limitations
  - Known Foreseeable Misuse
  - Training-Data-Characteristics (high-level)
  - Human-Oversight-Measures
  - Changes over time
  - Maintenance-Instructions

**3.7.2 — Transparency-Entries (Art. 50, fuer Limited-Risk + Deepfakes)**
- `ai_transparency_entry` pro Transparenz-Pflicht:
  - Chatbot-Label "Sie sprechen mit einer KI"
  - Emotion-Recognition-Info
  - Biometric-Categorization-Info
  - Deepfake-Watermark

**3.7.3 — Multi-Language Support**
- Pflicht: mindestens Amtssprachen der EU-Mitgliedstaaten wo eingeführt

**Existierend**:
- ✅ `ai_transparency_entry`
- ✅ `/api/v1/ai-act/transparency-entries`

**Gap**:
- 🔴 Instructions-for-Use-Template
- 🔴 Transparency-Label-Generator (HTML-Snippet fuer Website-Integration)
- 🔴 Watermark-Integration-Guide

### 3.8 Phase 8 — HUMAN-OVERSIGHT (Art. 14)

**Trigger**: High-Risk-Deployment active

**Aktoren**: human_operator, ai_system_operator

**Workflow**:

**3.8.1 — Oversight-Design**
- Pre-Deployment:
  - Interface-Design ermoeglicht menschliche Intervention
  - Operator-Training (log in `crisis_team_member`-aehnlich)
  - Escalation-Procedures

**3.8.2 — Oversight-Operation**
- `ai_human_oversight_log` pro Override-/Review-Event:
  - `ai_system_id`, `operator_id`
  - `event_type`: review_decision | override_decision | halt_system | resume_system
  - `ai_recommendation` + `human_decision`
  - `justification`
  - `confidence_before`, `confidence_after`
  - `outcome` (wenn bekannt)

**3.8.3 — Periodic-Oversight-Review**
- Quartalsweise: Aggregat-Review
- Patterns: wo werden AI-Entscheidungen haeufig overridden? (Bias-Signal)
- Updates zu Oversight-Procedures

**Existierend**:
- ✅ `ai_human_oversight_log`
- ✅ `/api/v1/ai-act/oversight-logs`
- ✅ UI: `/ai-act/oversight-logs`

**Gap**:
- 🔴 Oversight-Design-Checklist
- 🔴 Oversight-Metrics-Dashboard (Override-Rate, Decision-Confidence-Gaps)
- 🔴 Operator-Training-Tracking

### 3.9 Phase 9 — ACCURACY + ROBUSTNESS + CYBERSECURITY (Art. 15)

**Trigger**: Continuous

**Aktoren**: ml_engineer, cybersecurity_analyst

**Workflow**:

**3.9.1 — Accuracy-Metrics**
- Pre-Deployment: Test-Set-Metriken (Accuracy, F1, AUC, Per-Cohort-Metrics)
- Post-Deployment: Continuous-Monitoring (Drift-Detection)
- Link auf `control_monitoring_rule` (Phase-3 Monitoring)

**3.9.2 — Robustness-Testing**
- Adversarial-Robustness (FGSM, PGD, etc.)
- Distribution-Shift-Handling
- Documented in Risk-Management-Process

**3.9.3 — Cybersecurity-Measures**
- Model-Integrity-Protection (Signing, Versioning)
- Data-Poisoning-Protection
- Prompt-Injection-Protection (bei LLMs)
- Link auf ISMS-Controls + TOMs

**Gap**:
- 🔴 Accuracy-Metrics-Dashboard
- 🔴 Robustness-Test-Catalog
- 🔴 Model-Drift-Detection-Worker

### 3.10 Phase 10 — CONFORMITY-ASSESSMENT (Art. 43, fuer High-Risk)

**Trigger**: Before Placing-on-Market (erstmalig + bei Substantial-Change)

**Aktoren**: ai_product_owner, notified_body (extern), legal

**Workflow**:

**3.10.1 — Assessment-Path-Wahl**
- Annex VI (Internal Control) — fuer die meisten High-Risk
- Annex VII (Quality-Management + Technical-Doc + Notified-Body)
  — fuer Biometric-ID ohne harmonisierte Standards

**3.10.2 — `ai_conformity_assessment`-Record**
- `ai_system_id`
- `assessment_type`: internal_control | third_party_nb
- `assessment_date`, `assessor_name`, `assessor_type`
- Structure (9 Sections analog Annex IV)
- `conformity_declared` (Boolean)
- `ce_marking_affixed` (Boolean, bei positivem Outcome)
- `notified_body_id` (wenn external)
- `next_reassessment_due`

**3.10.3 — EU-Declaration-of-Conformity**
- Document-Artifact mit Annex-V-Inhalten:
  - AI-System-Identification
  - Provider-Info
  - List of harmonised standards
  - Date of declaration
  - Signatory

**3.10.4 — CE-Marking**
- Bei positivem Conformity-Assessment
- Affixing auf System (Product-UI, Website, Docs)

**3.10.5 — Substantial-Change-Reassessment**
- Was = Substantial-Change? Update bei Training-Data, Functionality, etc.
- Workflow: Trigger-Event → Re-Assessment

**Existierend**:
- ✅ `ai_conformity_assessment`
- ✅ `/api/v1/ai-act/conformity-assessments`
- ✅ UI: `/ai-act/conformity-assessments`

**Gap**:
- 🔴 Conformity-Assessment-Wizard (9-Step)
- 🔴 EU-Declaration-Generator (PDF mit digitaler Signatur)
- 🔴 CE-Marking-Artifact-Manager
- 🔴 Substantial-Change-Detection + Re-Assessment-Trigger
- 🔴 Notified-Body-Register (externe Datenquelle + Contact-Info)

### 3.11 Phase 11 — FUNDAMENTAL-RIGHTS-IMPACT-ASSESSMENT (FRIA, Art. 27)

**Trigger**: Deployer von High-Risk-System im Public-Sector ODER
Private-Sector mit Public-Service-Erbringung

**Aktoren**: deployer_compliance, legal, dpo

**Workflow**:

**3.11.1 — FRIA-Creation**
- `ai_fria` pro Deployment:
  - `ai_system_id`
  - `deployer_context` (welche Rolle, welcher Kontext)
  - `deployment_purpose`
  - `affected_persons_categories`
  - `affected_persons_count_estimate`
  - `use_frequency` (e.g. daily, monthly)
  - `duration_of_use`
  - `potential_harms` (JSON array)
  - `mitigation_measures`
  - `human_oversight_plan`
  - `complaint_mechanism`
  - `data_subjects_notification_plan` (DSGVO-Link)

**3.11.2 — Risk-Categories**
- Per harm-category:
  - Non-discrimination (Age, Gender, Race, etc.)
  - Privacy
  - Freedom of expression
  - Freedom of assembly
  - Right to good administration
  - Access to effective remedy
  - Presumption of innocence
  - Rights of the child

**3.11.3 — Market-Surveillance-Authority-Notification**
- Submission bei zustaendiger Behoerde
- Acknowledgment-Tracking

**3.11.4 — Periodic-Review**
- Nach Deployment: jaehrliche Review
- Bei Incidents: out-of-cycle Review

**Existierend**:
- ✅ `ai_fria`
- ✅ `/api/v1/ai-act/frias`
- ✅ UI: `/ai-act/frias`

**Gap**:
- 🔴 FRIA-Wizard (8-Step)
- 🔴 Harm-Taxonomy-Library (EU-FRA-Standards)
- 🔴 Market-Surveillance-Authority-Registry
- 🔴 FRIA-Template-Pack per Public-Service-Typ (Social-Welfare,
  Law-Enforcement, Education)

### 3.12 Phase 12 — POST-MARKET-MONITORING + INCIDENT-REPORTING (Art. 72-73)

**Trigger**: Continuous nach Deployment

**Aktoren**: ai_system_operator, legal

**Workflow**:

**3.12.1 — Post-Market-Monitoring-Plan**
- Analog ISO 14971 Medical-Device-Monitoring
- Continuous-Data-Collection:
  - Real-World-Performance
  - User-Feedback
  - Observed-Harms
  - Drift-Detection (Model + Data)

**3.12.2 — Serious-Incident-Reporting (Art. 73)**
- `ai_incident`-Record bei:
  - Death or serious injury
  - Breach of fundamental rights
  - Serious damage to property or environment
  - Serious malfunction
- Meldepflicht:
  - 2 Tage bei "widespread infringement"
  - 10 Tage regulaer
  - 15 Tage bei serious malfunction Non-Death

**3.12.3 — Incident-Details**
- `ai_incident`:
  - `is_serious` (Boolean)
  - `serious_criteria` (JSON)
  - `authority_deadline` (2/10/15-Tage-Timer)
  - `affected_persons_count`
  - `harm_type`, `harm_description`
  - `root_cause`, `remediation_actions`

**3.12.4 — Corrective-Actions**
- `ai_corrective_action` fuer Incident-Follow-up:
  - Recall? Withdrawal?
  - Patches / Updates
  - Communication to Users
  - Authority-Reference

**3.12.5 — Authority-Communication**
- `ai_authority_communication` fuer alle offiziellen Meldungen
- Trail: Draft → Sent → Acknowledged → Responded

**Existierend**:
- ✅ `ai_incident`, `ai_corrective_action`, `ai_authority_communication`
- ✅ `/api/v1/ai-act/incidents`, `/api/v1/ai-act/corrective-actions`, `/api/v1/ai-act/authority`
- ✅ UI: `/ai-act/incidents`, `/ai-act/corrective-actions`, `/ai-act/authority`

**Gap**:
- 🔴 Post-Market-Monitoring-Dashboard
- 🔴 Incident-Deadline-Timer (2/10/15-Tage-Countdown)
- 🔴 Recall-/Withdrawal-Workflow
- 🔴 Serious-Incident-Decision-Tree (wann ist es serious?)

### 3.13 Phase 13 — GPAI-SPECIFIC-OBLIGATIONS (Art. 51-55)

**Trigger**: AI-System klassifiziert als GPAI oder GPAI-SR

**Aktoren**: ai_provider, compliance

**Workflow** (NUR fuer GPAI-Providers):

**3.13.1 — Training-Data-Summary (Art. 53(1)(d))**
- Hoch-Level-Beschreibung der Trainingsdaten
- Public: ggf. auf Website
- Copyright-Respekt: Opt-Out-Mechanismus

**3.13.2 — Technical-Documentation (Art. 53(1)(a))**
- Annex XI Informationen
- Model-Architecture, Training-Details
- Share mit Downstream-Deployers (wenn kein Open-Source-License)

**3.13.3 — Copyright-Compliance (Art. 53(1)(c))**
- Opt-Out-Respect (Art. 4(3) DSM-Directive)
- Rights-Management-Policy

**3.13.4 — GPAI-SR-Zusatzpflichten (Art. 55)**
- Model-Evaluations (inkl. Adversarial)
- Risk-Assessment + Mitigation
- Incident-Reporting (zusaetzlich)
- Cybersecurity-Measures
- Code-of-Practice-Adherence (bis EU-Harmonised-Standards)

**Existierend**:
- ✅ `ai_gpai_model` mit allen relevanten Feldern

**Gap**:
- 🔴 GPAI-Training-Data-Summary-Template
- 🔴 Annex-XI-Doc-Generator
- 🔴 Copyright-Opt-Out-Management (Crawl-Settings, Robots.txt)
- 🔴 Adversarial-Testing-Results-Repository
- 🔴 Code-of-Practice-Tracker

### 3.14 Phase 14 — PENALTIES + ENFORCEMENT (Art. 99-101)

**Trigger**: Regulatorisches Enforcement-Event

**Aktoren**: legal, admin

**Workflow**:

**3.14.1 — Penalty-Record**
- `ai_penalty`:
  - `ai_system_id`, `authority_name`
  - `penalty_type`: fine | withdrawal | restriction | cease_and_desist
  - `article_reference`
  - `fine_amount` + `fine_currency` (default EUR)
  - `fine_percentage_turnover` (Art. 99(3) — 7 % Worldwide-Turnover)
  - `penalty_bracket`: minor | moderate | serious | gravest (max 7%)
  - `appeal_filed`, `appeal_status`

**3.14.2 — Appeal-Management**
- Falls eingelegt:
  - `appeal_deadline`
  - `appeal_court`
  - Tracking bis Entscheidung

**3.14.3 — Remediation**
- `ai_corrective_action` fuer Enforcement-bezogene Aenderungen
- Re-Assessment nach Remediation

**Existierend**:
- ✅ `ai_penalty`
- ✅ UI: `/ai-act/penalties`

**Gap**:
- 🔴 Penalty-Tracker-Dashboard
- 🔴 Industry-Benchmark (was wurde in der Branche bestraft)

### 3.15 Phase 15 — FRAMEWORK-MAPPING + ANNUAL-REPORTING

**Trigger**: Jaehrlich + bei Cross-Framework-Audits

**Aktoren**: ai_compliance_manager

**Workflow**:

**3.15.1 — Framework-Mapping**
- `ai_framework_mapping` pro AI-System:
  - EU AI Act ↔ ISO 42001 ↔ NIST AI RMF ↔ ISO 23894
  - Coverage-Matrix wie bei ISMS

**3.15.2 — Annual-AI-Act-Report**
- Inhalte:
  - AI-System-Inventory
  - Risk-Category-Distribution
  - Prohibited-Screenings-Done
  - Conformity-Assessments-Done
  - FRIAs-Done
  - Post-Market-Monitoring-Summary
  - Incidents + Corrective-Actions
  - GPAI-Models-Register
  - QMS-Maturity-Score

**Existierend**:
- ✅ `ai_framework_mapping`
- ✅ UI: `/ai-act/framework-mappings`

**Gap**:
- 🔴 AI-Act-Annual-Report-Generator
- 🔴 Cross-Framework-Coverage-Matrix-UI
- 🔴 Executive-Summary-PDF fuer Board

## 4. Entity-Katalog (AI-Act-Modul)

### Vorhanden (14 Entitaeten)

| Entity | Tabelle | Zweck |
|---|---|---|
| AI-System | `ai_system` | Haupt-Register |
| AI-Conformity-Assessment | `ai_conformity_assessment` | Art. 43 |
| AI-Human-Oversight-Log | `ai_human_oversight_log` | Art. 14 |
| AI-Transparency-Entry | `ai_transparency_entry` | Art. 50 |
| AI-FRIA | `ai_fria` | Art. 27 |
| AI-Framework-Mapping | `ai_framework_mapping` | Cross-Std |
| AI-GPAI-Model | `ai_gpai_model` | Art. 51-55 |
| AI-Incident | `ai_incident` | Art. 73 |
| AI-Corrective-Action | `ai_corrective_action` | Post-Incident |
| AI-Authority-Communication | `ai_authority_communication` | Behoerden-Trail |
| AI-Penalty | `ai_penalty` | Art. 99-101 |
| AI-Prohibited-Screening | `ai_prohibited_screening` | Art. 5 |
| AI-Provider-QMS | `ai_provider_qms` | Art. 17 |

### Neu (benoetigt)

| Entity | Zweck | Prio |
|---|---|---|
| `ai_technical_documentation` | Annex-IV-Doku strukturiert (statt nur generic `document`) | High |
| `ai_operational_log` | Art. 12 Logging (Event-Stream, evtl. TimescaleDB) | High |
| `ai_training_data_summary` | Art. 10 Data-Governance-Doku | High |
| `ai_substantial_change_log` | Change-Tracking fuer Re-Assessment-Trigger | Medium |
| `ai_accuracy_metric` | Per-System + Per-Cohort Metrics-Timeseries | Medium |
| `ai_drift_detection` | Model-Drift-Alerts | Medium |
| `notified_body_registry` | Externe Liste (Platform-Daten) | Medium |
| `market_surveillance_authority` | Platform-Daten | Low |
| `ai_code_of_practice_tracker` | Code-of-Practice-Adherence per GPAI | Low |

## 5. API-Surface (~50 Endpoints)

### Existierend (~25)

Alle existierenden AI-Act-Routen von 3.1-3.15 oben.

### Neu benoetigt (~25)

```
POST   /api/v1/ai-act/systems/register-wizard
POST   /api/v1/ai-act/systems/{id}/classify
POST   /api/v1/ai-act/systems/{id}/substantial-change
GET    /api/v1/ai-act/systems/inventory-dashboard

POST   /api/v1/ai-act/qms/setup-wizard
POST   /api/v1/ai-act/qms/{id}/gap-analysis-42001

POST   /api/v1/ai-act/conformity-assessments/{id}/generate-declaration
POST   /api/v1/ai-act/conformity-assessments/{id}/ce-marking

POST   /api/v1/ai-act/frias/new-wizard
GET    /api/v1/ai-act/frias/{id}/authority-submission

POST   /api/v1/ai-act/gpai/{id}/training-data-summary
POST   /api/v1/ai-act/gpai/{id}/annex-xi-doc
GET    /api/v1/ai-act/gpai/{id}/code-of-practice-status

POST   /api/v1/ai-act/incidents/{id}/decision-tree        (is-it-serious?)
GET    /api/v1/ai-act/incidents/{id}/deadline-timer

POST   /api/v1/ai-act/technical-docs/annex-iv-wizard
POST   /api/v1/ai-act/technical-docs/{id}/eu-db-register

POST   /api/v1/ai-act/oversight/design-checklist
GET    /api/v1/ai-act/oversight/metrics-dashboard

POST   /api/v1/ai-act/data-governance/assess
GET    /api/v1/ai-act/data-governance/bias-report/{systemId}

POST   /api/v1/ai-act/post-market/drift-check
GET    /api/v1/ai-act/post-market/monitoring-dashboard

GET    /api/v1/ai-act/annual-report/{year}
POST   /api/v1/ai-act/annual-report/{year}/generate
POST   /api/v1/ai-act/evidence-pack
```

## 6. UI-Surface (~30 Pages)

### Existierend (~12)

- `/ai-act` (Overview)
- `/ai-act/systems`, `/ai-act/prohibited`, `/ai-act/gpai`
- `/ai-act/conformity-assessments`, `/ai-act/frias`, `/ai-act/qms`
- `/ai-act/incidents`, `/ai-act/corrective-actions`, `/ai-act/authority`
- `/ai-act/penalties`, `/ai-act/transparency-entries`, `/ai-act/oversight-logs`
- `/ai-act/framework-mappings`

### Neu benoetigt (~18)

- `/ai-act/systems/register-wizard` — 6-Step
- `/ai-act/systems/classification-tree` — interaktives Decision-Tree
- `/ai-act/systems/[id]/substantial-change` — Change-Trigger-Flow
- `/ai-act/qms/setup-wizard` — 10-Procedure-Wizard
- `/ai-act/qms/[id]/gap-analysis-42001`
- `/ai-act/risk-management/[systemId]` — Per-System-Risk-Dashboard
- `/ai-act/data-governance/[systemId]`
- `/ai-act/data-governance/bias-dashboard`
- `/ai-act/technical-docs/new-wizard` — 9-Step Annex-IV
- `/ai-act/operational-logs/[systemId]` — Query + Export
- `/ai-act/accuracy-metrics` — Timeseries per System
- `/ai-act/drift-detection` — Alerts-Dashboard
- `/ai-act/conformity-assessments/new-wizard` — 9-Step
- `/ai-act/conformity-assessments/[id]/declaration` — PDF-Viewer
- `/ai-act/frias/new-wizard` — 8-Step
- `/ai-act/gpai/[id]/training-data-summary` — strukturiertes Formular
- `/ai-act/post-market-monitoring` — dediziertes Dashboard
- `/ai-act/annual-report/[year]` — Jahresbericht

## 7. Cross-Module-Integrationen

- **ISMS**: AI-System = spezieller Asset-Typ; Cybersecurity-Measures aus ISMS
- **DPMS**: DPIA-Pflicht bei AI mit Personal-Data; FRIA ergaenzt DPIA
- **BPM**: AI-involvierte Prozesse → Process-Criticality-Flags
- **EAM**: AI-Systeme im Application-Portfolio, Tech-Stack-Layer
- **ERM**: AI-Risks als Category in `risk`, Treatment-Loop
- **Audit**: AI-Audit als Audit-Universe-Entry, evtl. Notified-Body-Access
- **Regulatory-Change**: EU-Kommissions-Delegated-Acts triggern Re-Classifications
- **Contract**: AI-Service-Vertraege brauchen AI-Act-Klauseln
- **TPRM**: GPAI-Model-Provider-Assessment als Sub-Processor-Form

## 8. Workflow-Gates

| Gate | Transition | Kriterium |
|---|---|---|
| **G1** | System-Register → Production | Prohibited-Screening done, NO prohibited practice |
| **G2** | High-Risk-Classification → Deployment | QMS + Risk-Mgmt + Data-Gov + Tech-Doc + Logging + Oversight + Conformity done |
| **G3** | Conformity-Assessment → Positive | Alle 9 Annex-IV-Sektionen vollstaendig, Review durch Reviewer |
| **G4** | CE-Marking → Affix | Conformity-Assessment positive, Declaration signed |
| **G5** | FRIA → Submission | Alle 8 Sektionen + Mitigation-Plan + Complaint-Mechanism |
| **G6** | Incident → Serious-Flag | Decision-Tree Art. 73(1)-Kriterien gecheckt |
| **G7** | Serious-Incident → Authority-Notified | 2/10/15-Tage-Frist abhaengig vom Typ gehalten |
| **G8** | GPAI → Ready-for-Market | Training-Data-Summary + Annex-XI-Doc + Copyright-Compliance |
| **G9** | GPAI-SR → Production | Adversarial-Tests + Risk-Assessment + Incident-Reporting-Setup |
| **G10** | Annual-Report → Submission | Alle Sektionen populated, Board-Approval |

## 9. Compliance-Evidence-Pack

| Dokument | Quelle |
|---|---|
| AI-System-Register | `ai_system` alle |
| Prohibited-Practices-Screenings | `ai_prohibited_screening` + Evidence |
| QMS-Dokumentation | `ai_provider_qms` + alle 10 Policies |
| Technical-Documentation (Annex IV) | `ai_technical_documentation` |
| Risk-Management-Files | `risk` mit `category='ai_act'` + Tests |
| Data-Governance-Files | `ai_training_data_summary` + Bias-Reports |
| Operational-Logs (Art. 12) | `ai_operational_log` (>= 6 Monate) |
| Transparency-Documentation | `ai_transparency_entry` + Instructions |
| Oversight-Logs | `ai_human_oversight_log` |
| Accuracy-Metrics | `ai_accuracy_metric` |
| Conformity-Assessments | `ai_conformity_assessment` + Declarations |
| FRIAs | `ai_fria` + Authority-Ack |
| Post-Market-Monitoring-Reports | `ai_incident` + `ai_corrective_action` |
| GPAI-Documentation | `ai_gpai_model` + Annex-XI |
| Authority-Communication-Trail | `ai_authority_communication` |
| Audit-Trail-Integrity | `/api/v1/audit-log/integrity` |

## 10. KPIs + Metriken

| KRI | Formel | Frequenz |
|---|---|---|
| AI-Act-Compliance-Score | weighted Composite | monthly |
| High-Risk-AI-Count | count(ai_system WHERE risk_category='high_risk') | real-time |
| Prohibited-Screenings-Done-% | screenings / ai_systems | weekly |
| Conformity-Assessments-Active-% | positive / high_risk_systems | monthly |
| FRIA-Coverage | FRIAs_done / deployers_required | monthly |
| QMS-Maturity-Index | avg(ai_provider_qms.overall_maturity) | monthly |
| Serious-Incident-Count | count(ai_incident WHERE is_serious=true) | real-time |
| Incident-Deadline-Compliance | reported_on_time / total_reportable | monthly |
| GPAI-Model-Count | count(ai_gpai_model) | real-time |
| Drift-Detection-Alerts | count(drift_alert WHERE status='open') | daily |
| Penalty-Total-Exposure | sum(ai_penalty.fine_amount WHERE status='imposed') | real-time |
| Human-Override-Rate | overrides / total_oversight_events | weekly |

## 11. Session-Outcome

**Dieses Dokument (Iter 1)**:
- ✅ AI-Act 15-Phasen-Zyklus
- ✅ Alle 12 Kapitel des AI-Acts auf ARCTOS-Entities gemappt
- ✅ Entity-Katalog (13 vorhanden, 9 neu)
- ✅ ~50 API-Endpoints
- ✅ ~30 UI-Pages
- ✅ 10 Workflow-Gates
- ✅ 16-dokumentiges Evidence-Pack
- ✅ 12 KPIs

**Besonderheit vs. anderen Modulen**:
- **Zeitkritisch**: 2025/2026 sind harte Deadlines
- **Strafzahlung bis 7 % des Weltumsatzes** → oft **hoechste Priorisierung**
- **Dual-Role** (Provider + Deployer) schafft komplexe Workflow-Varianten
- **Technische Tiefe** (Bias-Testing, Adversarial-Robustness, Drift-Detection) braucht ML-Expertise

**Geschaetzter Implementation-Aufwand**:
- Backend: 140-190 Stunden
- Frontend (viele Wizards + Technical-UIs): 180-240 Stunden
- Testing: 60-80 Stunden
- Legal/Compliance-Review: 30-50 Stunden (AI-Act-Experte noetig)
- **Total: ~530 Stunden (~7 Personen-Wochen)**

**Offen fuer naechste Sessions**:
- Iter 2: Detail-Design Bias-Testing-Framework-Integration
- Iter 3: Notified-Body-Partnership-Management
- Iter 4: EU-Database-Registration-Automation (wenn API verfuegbar)
