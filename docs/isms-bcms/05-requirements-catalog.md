# Anforderungskatalog — ISMS- & BCMS-Bereiche der ARCTOS-Software

**Stand:** 2026-04-30
**Geltungsbereich:** Software-Anforderungen an die Module ISMS, BCMS, NIS2, DORA, Risk, Audit, Threat, Incident, Vulnerability, Asset, Awareness und alle Cross-Funktionen, die für ein integriertes Managementsystem nach ISO 27001:2022 + 27005:2022 + 22301:2019 + NIS2 + DORA notwendig sind.
**Vorgängerdokumente:** [03-roadmap-year-1.md](./03-roadmap-year-1.md), [04-roadmap-year-2.md](./04-roadmap-year-2.md)

---

## 0. Konventionen

- **REQ-ID:** `REQ-<Domain>-<3-stellige Nr>`. Domains: `ISMS`, `BCMS`, `RISK`, `NIS2`, `DORA`, `AUDIT`, `INC`, `VUL`, `THR`, `ASSET`, `AWARE`, `TPRM`, `XCUT` (cross-cutting), `NFR` (non-functional)
- **Norm-Bezug:** Klauseln in eckigen Klammern `[27001 §6.1.2]`
- **Status-Marker:**
  - `IMPLEMENTED` — Feature vorhanden, durch Tests abgesichert
  - `PARTIAL` — Feature teilweise vorhanden, mind. ein Akzeptanzkriterium nicht erfüllt
  - `OPEN` — Feature fehlt vollständig oder Akzeptanzkriterien nicht abdeckbar
  - `PLANNED-Y1` / `PLANNED-Y2` — eingeplant
- **Priorität:** `MUST` (Zertifizierungsblockade bei Fehlen), `SHOULD` (wesentliche Reife-Komponente), `MAY` (Nice-to-have / Reife-Level 4+)

---

## 1. ISMS-Kern-Anforderungen (ISO 27001:2022)

### 1.1 Kontext, Scope, Politik (Klauseln 4, 5)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ISMS-001 | Mehr-Mandanten-Geltungsbereich (ein ISMS pro Organization, mit Sub-Entitäten) | MUST | 27001 §4.3 | Organization mit `parent_id` referenzieren weitere Entitäten; Scope-Statement als versioniertes Dokument | `organization`, `document` | IMPLEMENTED |
| REQ-ISMS-002 | IS-Politik versionsgeführt + GL-Approval-Workflow | MUST | §5.2 | Document mit `type=is_policy`, Approval-Status, Approver-Signatur, Effective-Date | `document` mit Version + Approval | IMPLEMENTED |
| REQ-ISMS-003 | Politik-Acknowledgement durch Mitarbeitende | MUST | §5.2 / §7.3 | Pro Nutzer/Org: Bestätigung erfasst, Reminder bei Versionswechsel | `policy_acknowledgment` | IMPLEMENTED |
| REQ-ISMS-004 | Rollen, Verantwortungen, Befugnisse (Three Lines of Defense) | MUST | §5.3 | RBAC mit 7 Rollen: admin, risk_manager, control_owner, auditor, dpo, process_owner, viewer; Three-Lines-Filter | `user_organization_role`, RBAC-Middleware | IMPLEMENTED |
| REQ-ISMS-005 | Stakeholder-Register | SHOULD | §4.2 | Register je Org, mit Erwartungen, Priorität, Kontaktinfo, Review-Datum | (tbd) — als `document` möglich; spezifisches Modul OPEN | PARTIAL |

### 1.2 Risiko-Methodik & Risiko-Management (Klausel 6.1, 8.2/8.3)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-RISK-001 | Konfigurierbare Risikomatrix (Likelihood × Impact) | MUST | 27005 §8 | Matrix-Skala 3×3, 4×4, 5×5 wählbar; Schwellwerte konfigurierbar | `risk_appetite`, Schema-Felder | IMPLEMENTED |
| REQ-RISK-002 | Asset-basierte und Szenario-basierte Risiko-Identifikation | MUST | 27005 §7 | Risk kann Asset-, Szenario-, oder kombiniert basiert erfasst werden | `risk`, `isms_risk_scenario`, `risk_asset` | IMPLEMENTED |
| REQ-RISK-003 | Risiko-Bewertungs-Log mit Audit-Trail | MUST | §6.1.2 d | Jede Bewertungsänderung mit Zeitstempel, Bearbeiter, Vor-/Nach-Wert geloggt | `risk_evaluation_log` | IMPLEMENTED |
| REQ-RISK-004 | Behandlungs-Strategien (vermeiden/vermindern/übertragen/akzeptieren) | MUST | §6.1.3 | Strategie-Enum, Auswahl je Risiko verpflichtend bei Behandlung | `riskTreatment.strategy` | IMPLEMENTED |
| REQ-RISK-005 | Verknüpfung Risiko ↔ Control (Many-to-Many) | MUST | §6.1.3 b | Pro Risk-Treatment: 1+ verknüpfte Controls aus Annex A oder eigene | `risk_control`, `risk_treatment_link` | IMPLEMENTED |
| REQ-RISK-006 | Restrisiko-Akzeptanz mit Risikoeigentümer-Approval | MUST | §6.1.3 f | Akzeptanz nur durch berechtigte Rolle (risk_manager, admin); digitale Signatur (Hash + User + Time) | `risk_acceptance` | IMPLEMENTED |
| REQ-RISK-007 | KRI-System (Key Risk Indicators) | SHOULD | §9.1 | Pro KRI: Name, Soll-Wert, Ist-Wert, Direction, Trend, Alert-Status, Frequency | `kri`, `kri_measurement` | IMPLEMENTED |
| REQ-RISK-008 | Quantitative Risiko-Methode FAIR | SHOULD | 27005 §8 (quant) | Konfigurierbare LEF/PLM-Verteilungen, Monte-Carlo Sampling, VaR/CVaR-Output | `fair-simulation.ts`, `risk_var_calculation` | IMPLEMENTED |
| REQ-RISK-009 | Sensitivity-Analyse | MAY | §9.1 | Tornado-Diagramm-Daten exportierbar; Top-Faktoren je Risiko | `risk_sensitivity_analysis` | IMPLEMENTED |
| REQ-RISK-010 | Risiko-Re-Assessment-Frist | MUST | §8.2 | Pro Risiko `next_assessment_due_at`; Worker-Job markiert überfällige | `risk.next_assessment_due_at` (vorhanden?), Worker-Job | PARTIAL |
| REQ-RISK-011 | Risiko-Vorhersage / Predictive | MAY | §10.2 | Prediction-Modelle, Anomalie-Detection, Backtesting | `risk_prediction_model`, `risk_anomaly_detection` | IMPLEMENTED |
| REQ-RISK-012 | Risiko-Akzeptanz-Schwellen pro Org konfigurierbar | SHOULD | §6.1.2 a | Threshold-Konfiguration, Eskalation bei Überschreitung | `risk_appetite_threshold` | IMPLEMENTED |
| REQ-RISK-013 | Cross-Risk-Sync (zwischen Modulen) | SHOULD | §6.1.2 (kohärent) | ISMS-Risk ↔ BCMS-Risk ↔ DORA-Risk konsistente Sicht | `cross-risk-sync` State-Machine | IMPLEMENTED |
| REQ-RISK-014 | Risiko-Exec-Summary | SHOULD | §9.1 | Konfigurierbares Top-N + Trend-Daten + Empfehlungen | `risk_executive_summary` | IMPLEMENTED |
| REQ-RISK-015 | Chancen-Erfassung | SHOULD | §6.1.1 (Risiken **und** Chancen) | Chance-Felder in Risk-Schema | `risk` (chance fields per migration 842) | IMPLEMENTED |

### 1.3 Statement of Applicability (SoA)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ISMS-010 | SoA mit allen 93 Annex-A:2022-Controls | MUST | §6.1.3 d | Bulk-Initialisierung mit allen Controls aus 27001 Annex A | `isms_soa`, `populate`-Endpoint | IMPLEMENTED |
| REQ-ISMS-011 | Begründung Aufnahme/Ausschluss verpflichtend | MUST | §6.1.3 d | Bei `applicability=excluded` MUSS `exclusion_reason` gesetzt sein (Schema-Constraint) | `isms_soa.exclusion_reason` | IMPLEMENTED |
| REQ-ISMS-012 | SoA-Diff zwischen Versionen | SHOULD | §10.1 | Diff-API liefert Adds/Removes/Changes per Control | `/api/v1/isms/soa/diff` | IMPLEMENTED |
| REQ-ISMS-013 | SoA-Export (Excel/CSV) | MUST | §6.1.3 d (kommunizierbar) | Export liefert SoA als XLSX mit Pflichtspalten | `/api/v1/isms/soa/export` | IMPLEMENTED |
| REQ-ISMS-014 | AI-gestützte Gap-Analyse SoA | SHOULD | §9.1 | LLM analysiert SoA + Asset-Inventar, schlägt fehlende Controls vor | `/api/v1/isms/soa/ai-gap-analysis` | IMPLEMENTED |
| REQ-ISMS-015 | SoA-Implementierungs-Status (planned/in_implementation/operational/effective) | MUST | §8.1 | Status-Maschine mit Datenintegrität (kein Sprung „planned" → „effective") | `soaImplementationEnum` | IMPLEMENTED |
| REQ-ISMS-016 | SoA-Snapshot zum Audit-Stichtag | SHOULD | §9.2 | Audit-Stichtag → eingefrorene SoA-Version | `framework_coverage_snapshot` | PARTIAL |

### 1.4 Assessments & Reviews

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ISMS-020 | Assessment-Run mit Phasen (eval → soa → risk → review → finalize) | MUST | §8.2 | State-Machine erzwingt Reihenfolge, Gates an jedem Phase-Übergang | `assessmentRun`, `transition`-Endpoints, `isms-assessment` State-Machine | IMPLEMENTED |
| REQ-ISMS-021 | Bulk-Eval (alle Controls auf einmal) | SHOULD | §9.1 | API `/bulk-evaluations` setzt N Evaluations atomar | `assessmentControlEval` Bulk-API | IMPLEMENTED |
| REQ-ISMS-022 | Eval-Gate-Check (alle Controls bewertet → SoA-Phase erlaubt) | MUST | §8.2 | Gate-Check liefert ok/blocking_count + Liste fehlender | `eval-gate-check`-Endpoint | IMPLEMENTED |
| REQ-ISMS-023 | Risk-Gate-Check | MUST | §8.2 | analoge Logik für Risiko-Phase | `risk-gate-check`-Endpoint | IMPLEMENTED |
| REQ-ISMS-024 | SoA-Gate-Check vor Finalisierung | MUST | §8.2 | analoge Logik | `soa-gate-check` | IMPLEMENTED |
| REQ-ISMS-025 | Assessment-Bericht (PDF + Daten-Export) | MUST | §9.1 | Bericht mit Cover, Scope, Risiken, SoA, NCs, Empfehlungen | `/assessments/[id]/report` | IMPLEMENTED |
| REQ-ISMS-026 | Risk-Scenario-Generator AI-gestützt | SHOULD | §6.1.2 c | LLM erzeugt 5–20 Szenarien aus Asset+Threat-Kontext | `risk-assessment/generate-scenarios` | IMPLEMENTED |
| REQ-ISMS-027 | Setup-Wizard | SHOULD | §6.1.2 (Methodik) | Wizard führt durch erste Konfiguration | `assessments/setup-wizard` | IMPLEMENTED |
| REQ-ISMS-028 | Management-Review-Modul | MUST | §9.3 | Review mit allen 8 Pflicht-Inputs (a–h), Outcomes-Liste, Aktion-Items | `managementReview`, `isms_review` | PARTIAL — Inputs nicht alle automatisch befüllt |
| REQ-ISMS-029 | Internal-Review (anlassbezogen) | SHOULD | §9.1 | Review-Type-Enum: management / internal / vulnerability_review etc. | `isms_review.type` | IMPLEMENTED |

### 1.5 Nichtkonformitäts- und CAPA-Prozess

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ISMS-030 | NC-Erfassung mit ISO-Severity (major/minor/observation) | MUST | §10.1 a | Severity-Enum, Schema-Constraint | `isms_nonconformity` | IMPLEMENTED |
| REQ-ISMS-031 | NC-Status-Maschine (open → analysed → corrected → effective → closed) | MUST | §10.1 b–f | State-Machine mit Validation | (vorhanden?) | PARTIAL — Validation prüfen |
| REQ-ISMS-032 | Wirksamkeitsprüfung Pflicht vor Closure | MUST | §10.1 g | Status `closed` nur nach `effective_review` mit Outcome | wie oben | PARTIAL |
| REQ-ISMS-033 | Bulk-Findings-Erstellung aus Audit-NCs | SHOULD | §9.2 + §10.1 | Audit-Findings → automatisch als NCs anlegen | `audit_finding`, Bulk-Create-Action | IMPLEMENTED |
| REQ-ISMS-034 | CAPA-Tracking | MUST | §10.1 d–g | Korrektur + Vorbeuge mit Owner, Frist, Status | `improvement_initiative` | PARTIAL |
| REQ-ISMS-035 | Root-Cause-Analyse-Modul | SHOULD | §10.1 c | 5-Why oder Fishbone-Analyse pro NC | `root-cause-analysis` Page | IMPLEMENTED |

### 1.6 Asset-Management

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ASSET-001 | Asset-Inventar mit Hierarchie | MUST | A.5.9, §8.1 | Parent-Child, Cycle-Detection beim Import | `asset` mit Hierarchie | IMPLEMENTED |
| REQ-ASSET-002 | Asset-Klassifizierung (CIA-Tripel) | MUST | A.5.12 | C/I/A je Asset, Schutzbedarf abgeleitet | `asset_cia_profile`, `asset_classification` | IMPLEMENTED |
| REQ-ASSET-003 | Asset ↔ CPE Match | SHOULD | §8.2 (Risiko-ID) | CPE-Matcher findet bekannte Vulnerabilities | `cpe-matcher.ts`, `assets/[id]/cpe` | IMPLEMENTED |
| REQ-ASSET-004 | Empfohlene Risiken aus Asset-Klasse | SHOULD | A.5.12 | Pro Asset Vorschlag basierend auf CIA + Asset-Type | `assets/[id]/recommended-risks`, `asset_risk_recommendation` | IMPLEMENTED |
| REQ-ASSET-005 | Asset-Audit-Summary | SHOULD | §9.2 | Pro Asset: zugehörige Risiken, Vulns, NCs | `assets/[id]/audit-summary` | IMPLEMENTED |
| REQ-ASSET-006 | Asset-Tier-Klassifizierung (A/B/C) | SHOULD | A.5.12 | Tier basierend auf CIA-Schwellen automatisch | `asset_tier_enum` | IMPLEMENTED |

### 1.7 Threat & Vulnerability

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-THR-001 | Threat-Register | MUST | §6.1.2 c | Bedrohungs-Katalog org-spezifisch + global | `isms_threat`, `isms_threat_feed` | IMPLEMENTED |
| REQ-THR-002 | Threat-Heatmap | SHOULD | §9.1 | Heatmap nach Bedrohungs-Domäne × Likelihood/Impact | `threats/heatmap`-Endpoint | IMPLEMENTED |
| REQ-THR-003 | MITRE-ATT&CK-Heatmap | SHOULD | §6.1.2 c | Tactics/Techniques-Heatmap aus Incidents+Threats | `mitre-heatmap`-Endpoint | IMPLEMENTED |
| REQ-THR-004 | Threat-Trends (zeitlich) | SHOULD | §9.1 | Letzte 30/90/365 Tage Threat-Volume | `threats/trends` | IMPLEMENTED |
| REQ-VUL-001 | Vulnerability-Register | MUST | A.8.8 | CVSS, Status, Asset-Verknüpfung | `vulnerability` | IMPLEMENTED |
| REQ-VUL-002 | CVE-Feed-Sync | SHOULD | A.5.7, §6.1.2 c | Tägliches Sync (NVD oder vergleichbar) | `cve_feed` | IMPLEMENTED |
| REQ-VUL-003 | CVE-Match auf Asset-CPE | SHOULD | A.8.8 | Auto-Match-Engine inkrementell | `cve_match`, `cve/matches/bulk` | IMPLEMENTED |
| REQ-VUL-004 | CVE-Acknowledgement-Workflow | MUST | A.8.8 | Acknowledge → Convert-to-Risk oder Dismiss mit Begründung | `cve/matches/[id]/acknowledge`, `convert` | IMPLEMENTED |

### 1.8 Incident-Management

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-INC-001 | Incident-Erfassung mit Severity | MUST | A.5.24 | Severity-Enum, Klassifizierung, Reporter | `securityIncident` | IMPLEMENTED |
| REQ-INC-002 | Incident-Timeline | MUST | A.5.24 | Append-only Events mit Zeitstempel | `incident_timeline_entry` | IMPLEMENTED |
| REQ-INC-003 | Incident-Playbook-Suggestion (AI) | SHOULD | A.5.24 | LLM schlägt Playbook basierend auf Severity+Type | `incidents/[id]/playbook-suggestions` | IMPLEMENTED |
| REQ-INC-004 | Playbook-Phasen-Engine | SHOULD | A.5.24 | Phase-Advance, Abort, Status-Tracking | `incidents/[id]/playbook/advance-phase` | IMPLEMENTED |
| REQ-INC-005 | Incident-Korrelation (Pattern Detection) | MAY | §10.1 | Korrelation gleicher Threat-Vektoren | `incidents/correlate`, `correlations` | IMPLEMENTED |
| REQ-INC-006 | Incident-Rating (Wirksamkeit Reaktion) | SHOULD | §10.1 | Selbst- + Auditor-Bewertung | `incidents/[id]/rating` | IMPLEMENTED |
| REQ-INC-007 | Eskalationspfade konfigurierbar | MUST | A.5.24 | Schweregrad → Empfänger-Mapping | (vorhanden?) | PARTIAL |
| REQ-INC-008 | DORA-Schwellwert-Auswertung | MUST (DORA) | DORA Art. 18 | Auto-Klassifikation Major-Incident → DORA-Reportingpflicht | `dora_ict_incident`, Schwellwert-Engine | PARTIAL |

### 1.9 Posture & Maturity

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-ISMS-040 | Security-Posture-Übersicht | SHOULD | §9.1 | Domains × Score, Trend | `posture/domains`, `posture/trend` | IMPLEMENTED |
| REQ-ISMS-041 | Maturity-Modell | SHOULD | §9.1 | Levels 1–5 pro Domäne | `maturity_model`, `maturity_assessment` | IMPLEMENTED |
| REQ-ISMS-042 | Maturity-Heatmap | SHOULD | §9.1 | Domänen-Heatmap | `maturity/heatmap` | IMPLEMENTED |
| REQ-ISMS-043 | Maturity-Roadmap mit AI-Vorschlag | MAY | §10.2 | LLM generiert Roadmap-Items basierend auf Gap | `maturity/ai-roadmap` | IMPLEMENTED |
| REQ-ISMS-044 | Maturity-Radar-Chart | MAY | §9.1 | Radar als Reporting-Widget | `maturity/radar` | IMPLEMENTED |

### 1.10 Awareness

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-AWARE-001 | Pflicht-Schulungs-Modul | MUST | §7.3, A.6.3 | Course mit `mandatory=true`, Vollständigkeits-Check | `academy_course` | IMPLEMENTED |
| REQ-AWARE-002 | Quiz mit Bestehens-Logik | MUST | §7.3 | Pass-Threshold konfigurierbar, Wiederholbarkeit | `academy_quiz_attempt` | IMPLEMENTED |
| REQ-AWARE-003 | Zertifikat-Ausstellung | SHOULD | §7.3 | PDF-Zertifikat nach Bestehen | `academy_certificate` | IMPLEMENTED |
| REQ-AWARE-004 | Phishing-Sim-Anbindung | SHOULD | A.6.3 | Schnittstelle für externe Phishing-Plattform (KnowBe4 / Proofpoint) | (extern via Connector) | OPEN — Connector-Stub fehlt |

---

## 2. BCMS-Anforderungen (ISO 22301:2019)

### 2.1 BIA

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-BCMS-001 | BIA mit Status-Maschine (draft → in_progress → reviewed → approved → archived) | MUST | §8.2.2 | State-Machine erzwingt | `biaAssessment`, `bcms-bia` State-Machine | IMPLEMENTED |
| REQ-BCMS-002 | Process-Impact-Bewertung über Zeit (1h/4h/24h/72h/1w/4w) | MUST | §8.2.2 a | Schema mit Time-Buckets | `biaProcessImpact` | IMPLEMENTED |
| REQ-BCMS-003 | RTO/RPO/MBCO pro Prozess | MUST | §8.2.2 c | Pflichtfelder | `bia.rto`, `bia.rpo`, `bia.mbco` | IMPLEMENTED |
| REQ-BCMS-004 | Lieferanten-Abhängigkeiten in BIA | SHOULD | §8.2.2 d | Supplier-Table mit Dependency-Severity | `biaSupplierDependency` | IMPLEMENTED |
| REQ-BCMS-005 | BIA-Heatmap (Process × Time) | SHOULD | §9.1 | Heatmap-Endpoint | `bia/[id]/heatmap`, `impacts/heatmap` | IMPLEMENTED |
| REQ-BCMS-006 | Auto-Generate Process-Impacts aus Prozess-Inventar | SHOULD | §8.2.2 a | Bulk-Vorbefüllung | `bia/[id]/generate-process-impacts` | IMPLEMENTED |
| REQ-BCMS-007 | BIA-Finalize-Gate | MUST | §8.2.2 e | Gate-Check vor Approval | `bia/[id]/gate-check`, `bia/[id]/finalize` | IMPLEMENTED |

### 2.2 BCP

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-BCMS-010 | BCP pro kritischem Prozess | MUST | §8.4 | Plan + Procedures + Resources + Verantwortliche | `bcp`, `bcpProcedure`, `bcpResource` | IMPLEMENTED |
| REQ-BCMS-011 | BCP-Status-Maschine (draft → in_review → approved → active → archived) | MUST | §8.4 | State-Machine | `bcms-bcp` State-Machine | IMPLEMENTED |
| REQ-BCMS-012 | BCP-Aktivierungs-Kriterien dokumentiert | MUST | §8.4 c | Activation-Triggers Field | (vorhanden?) | PARTIAL — Field-Check |
| REQ-BCMS-013 | BCP-Ressourcen-Planung | SHOULD | §8.4 d | Personal, Technik, Räume, Lieferant — Quantitäten | `bcpResource` | IMPLEMENTED |
| REQ-BCMS-014 | BCP-Procedures (numerierte Schritte) | MUST | §8.4 e | Sequenz, Owner, ETA pro Schritt | `bcpProcedure` | IMPLEMENTED |
| REQ-BCMS-015 | BCP-Gate-Check (alle Pflichtfelder vor Approval) | MUST | §8.4 f | Gate-API | `plans/[id]/gate-check` | IMPLEMENTED |

### 2.3 Krisenmanagement & Kontaktbäume

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-BCMS-020 | Krisenstab-Rollen + Stellvertreter | MUST | §8.4.2 | Pro Crisis-Scenario: Team mit Rollen, Backups | `crisisTeamMember` | IMPLEMENTED |
| REQ-BCMS-021 | Kontakt-Baum mit Eskalationspfaden | SHOULD | A.5.30 | Tree-Strukturen mit Escalation-Edges | `crisisContactTree`, `crisisContactNode` | IMPLEMENTED |
| REQ-BCMS-022 | Krisen-Log (append-only) | MUST | §8.4.2 d | Append-only Events, Read-only nach Insert | `crisisLog` | IMPLEMENTED |
| REQ-BCMS-023 | Krisen-Status-Maschine (open → activated → contained → resolved) | MUST | §8.4.2 | State-Machine | `bcms-crisis` State-Machine | IMPLEMENTED |
| REQ-BCMS-024 | Krisen-Aktivierungs-Endpoint | MUST | §8.4.2 a | `/crisis/[id]/activate` setzt Activation-Time, sendet Benachrichtigungen | `crisis/[id]/activate` | IMPLEMENTED |
| REQ-BCMS-025 | DORA-Timer im Krisenmanagement | MUST (DORA) | DORA Art. 19 | Bei DORA-Major: 4h/24h/Final-Timer aktiv | `crisis/[id]/dora-timer` | IMPLEMENTED |
| REQ-BCMS-026 | Krisen-Kommunikations-Log | SHOULD | §8.4.2 e | Stakeholder-Kommunikation dokumentiert | `crisisCommunicationLog` | IMPLEMENTED |
| REQ-BCMS-027 | Recovery-Procedures detailliert | SHOULD | §8.4 e | Sequenzielle Schritte mit Verantwortung + Dauer | `recoveryProcedure`, `recoveryProcedureStep` | IMPLEMENTED |

### 2.4 Übungen

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-BCMS-030 | Übungs-Typen (tabletop/walkthrough/simulation/functional/full_scale) | MUST | §8.5 | Type-Enum | `exerciseTypeEnum`, `bcExerciseTypeEnum` | IMPLEMENTED |
| REQ-BCMS-031 | Übungs-Status-Maschine (planned → in_progress → debrief → completed → archived) | MUST | §8.5 | State-Machine | `bcms-exercise` State-Machine | IMPLEMENTED |
| REQ-BCMS-032 | Findings + Lessons aus Übungen | MUST | §8.5 g | Pro Übung: Liste, mit Severity, Verantwortung, Frist | `bcExerciseFinding`, `bcExerciseLesson` | IMPLEMENTED |
| REQ-BCMS-033 | Inject-Log (zeitliche Inputs während Übung) | SHOULD | §8.5 d | Append-only mit Time, Actor, Inject-Description | `bcExerciseInjectLog` | IMPLEMENTED |
| REQ-BCMS-034 | Übungs-Bericht (PDF) | MUST | §8.5 g | Bericht generierbar | `exercises/[id]/report` | IMPLEMENTED |
| REQ-BCMS-035 | Übungs-Gate-Check (alle Pflichtfelder vor Completion) | MUST | §8.5 g | Gate-API | `exercises/[id]/gate-check` | IMPLEMENTED |
| REQ-BCMS-036 | Lessons-Learned → CAPA-Übergabe | SHOULD | §8.5 g, §10.1 | Lesson → automatisch als Improvement-Initiative anlegbar | `improvement_initiative`, Wiring | PARTIAL — Wiring prüfen |

### 2.5 Strategien & Resilienz-Score

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-BCMS-040 | Resilience-Strategien (Redundanz/Alternativstandort/Manual/Service-Switch) | MUST | §8.3 | Type-Enum, Mapping zu Prozessen | `continuityStrategy`, `strategyTypeEnum` | IMPLEMENTED |
| REQ-BCMS-041 | Resilience-Score-Berechnung | SHOULD | §9.1 | Score je Org, gewichtet aus BIA-Coverage, Übungs-Pass-Rate, Plan-Aktualität | `resilienceScoreSnapshot`, `bcms/resilience/score` | IMPLEMENTED |
| REQ-BCMS-042 | Readiness-Monitor | SHOULD | §9.1 | Dashboard, das BCM-Bereitschaft visualisiert | `bcms/readiness-monitor` | IMPLEMENTED |
| REQ-BCMS-043 | Readiness-Monitor-PDF-Export | MAY | §7.5 | PDF-Export | `bcms/readiness-monitor/pdf` | IMPLEMENTED |
| REQ-BCMS-044 | ERM-Sync (BCMS-Risiken in Enterprise-Risk-Register sichtbar) | SHOULD | §6.1.1 | Periodischer Sync-Job | `bcms/erm-sync` | IMPLEMENTED |

---

## 3. NIS2-Anforderungen (RL (EU) 2022/2555)

### 3.1 Compliance-Status

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-NIS2-001 | Anwendbarkeitsprüfung (essential/important/out-of-scope) | MUST | NIS2 Art. 3 / §28 NIS2-UmsuCG | Feld pro Org `nis2_classification` | (vorhanden?) | PARTIAL |
| REQ-NIS2-002 | 10 Mindest-Maßnahmen-Status (Art. 21) | MUST | Art. 21 | Pro Kat. ein Status-Eintrag mit Verantwortlichkeit + Evidenz-Link | `nis2_status` | IMPLEMENTED |
| REQ-NIS2-003 | Readiness-Score | SHOULD | Art. 21 | Score aus 10 Kategorien gewichtet | `isms/nis2/readiness-score` | IMPLEMENTED |
| REQ-NIS2-004 | NIS2-Reporting-Tracker | MUST | Art. 23 | Tracker für alle eingegangenen Vorfälle, Frist-Engine | `isms/nis2/reporting-tracker` | IMPLEMENTED |

### 3.2 Vorfallsmeldung

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-NIS2-010 | Frühwarnung 24h | MUST | Art. 23 Abs. 4 a | Auto-Erinnerung bei Major-Incident an Reporter; Form-Template; Submit-Audit-Trail | `nis2_report.type=early_warning` | PARTIAL — Engine prüfen |
| REQ-NIS2-011 | Vorfallsmeldung 72h | MUST | Art. 23 Abs. 4 b | wie 010, Type=incident_notification | wie oben | PARTIAL |
| REQ-NIS2-012 | Abschlussbericht 1 Monat | MUST | Art. 23 Abs. 4 c | wie 010, Type=final_report | wie oben | PARTIAL |
| REQ-NIS2-013 | Reporting-Status pro Vorfall | MUST | Art. 23 | Pro Vorfall sichtbar: Frist, abgegeben?, Bestätigung | `nis2IncidentReport.status` | IMPLEMENTED |
| REQ-NIS2-014 | Aufsichts-Konfiguration (welche Behörde, welcher Kanal) | MUST | Art. 23 | Konfiguration pro Org | (tbd) | OPEN |

### 3.3 Audit & Reporting an Aufsicht

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-NIS2-020 | Annual-Statistik-Report-Generator | SHOULD | Art. 23 Abs. 7 | PDF + maschinenlesbar | `nis2/reports` | PARTIAL |
| REQ-NIS2-021 | Evidenz-Bundle für Aufsichts-Audit | SHOULD | Art. 32 | Evidence-Pack-Generator | `cert_evidence_package` | IMPLEMENTED |

---

## 4. DORA-Anforderungen (VO (EU) 2022/2554)

### 4.1 ICT-Risk-Management (Säule 1)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-DORA-001 | ICT-Risk-Register | MUST | Art. 6 | Pro ICT-Komponente Risiko erfasst | `doraIctRisk` | IMPLEMENTED |
| REQ-DORA-002 | DORA-Risk ↔ ISMS-Risk Verknüpfung | SHOULD | Art. 6 | Cross-Reference | `cross-risk-sync`, `dora_nis2_cross_ref` | IMPLEMENTED |
| REQ-DORA-003 | ICT-Risk-Framework-Dokumentation | MUST | Art. 6 Abs. 8 | Doku-Pflicht — Document mit type=dora_risk_framework | `document` | PARTIAL — type-enum prüfen |

### 4.2 Vorfallsmeldung (Säule 2)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-DORA-010 | ICT-Incident-Erfassung | MUST | Art. 17 | Schema mit DORA-Pflichtfeldern | `doraIctIncident` | IMPLEMENTED |
| REQ-DORA-011 | Schwellwerte für Major-Incident | MUST | Art. 18 | Konfigurierbare Threshold-Engine, Auto-Klassifikation | (vorhanden?) | PARTIAL |
| REQ-DORA-012 | Initial-Notification 4h | MUST | Art. 19 Abs. 4 a | Timer ab Erkennung, Eskalation bei Verzug | `crisis/[id]/dora-timer` | IMPLEMENTED |
| REQ-DORA-013 | Intermediate-Update 24h | MUST | Art. 19 Abs. 4 b | Timer + Form-Template | wie oben | IMPLEMENTED |
| REQ-DORA-014 | Final-Report 1 Monat | MUST | Art. 19 Abs. 4 c | Timer + Form-Template | wie oben | IMPLEMENTED |

### 4.3 Resilience-Testing (Säule 3)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-DORA-020 | Test-Programm-Plan | MUST | Art. 24 | Jahres-Test-Plan dokumentiert | (BCMS-Übungs-Plan + DORA-Anker) | PARTIAL |
| REQ-DORA-021 | TLPT-Plan (Threat-Led Penetration Test) | MUST (signifikante FUs) | Art. 26, 27 | Plan mit Phasen, Scope, Threat-Modell | `doraTlptPlan` | IMPLEMENTED |
| REQ-DORA-022 | TLPT-Provider-Compliance | MUST | Art. 27 Abs. 2 | Provider zugelassen + Compliance-Check | (tbd) | OPEN |
| REQ-DORA-023 | Vulnerability-Assessment regelmäßig | MUST | Art. 25 | Alle ICT-Systeme; Frequenz | `vulnerability` + Connector-Tests | IMPLEMENTED |

### 4.4 Drittparteien (Säule 4)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-DORA-030 | ICT-Provider-Register | MUST | Art. 28 | Alle Pflichtattribute (Vertrags-Daten, Kritikalität, Konzentrationsrisiko-Flag) | `doraIctProvider` | IMPLEMENTED |
| REQ-DORA-031 | ICT-Provider-Risikoanalyse | MUST | Art. 29 | Risiko-Score pro Provider | (tbd) | PARTIAL |
| REQ-DORA-032 | Konzentrationsrisiko-Bewertung | MUST | Art. 29 Abs. 2 | Cross-Provider-View | (tbd) | OPEN |
| REQ-DORA-033 | Vertrags-Klauseln Pflicht-Check | MUST | Art. 30 | Checkliste: Audit-Recht, Subcontracting, Exit-Strategie | (tbd) | PARTIAL |
| REQ-DORA-034 | Exit-Strategie pro kritischem Provider | MUST | Art. 28 Abs. 8 | Exit-Plan dokumentiert | (tbd) | OPEN |

### 4.5 Information Sharing (Säule 5)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-DORA-040 | Information-Sharing-Programm | SHOULD | Art. 45 | Eingang/Ausgang Threat-Intel mit Branche dokumentiert | `doraInformationSharing` | IMPLEMENTED |
| REQ-DORA-041 | Cross-Reference NIS2 ↔ DORA | SHOULD | Art. 1 Abs. 2 | Mapping-Tabelle | `doraNis2CrossRef` | IMPLEMENTED |

---

## 5. Audit-Management (Klausel 9.2 + 22301 §9.2 + DORA Art. 6)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-AUDIT-001 | Audit-Universe (alle prüfbaren Bereiche) | MUST | §9.2 | Hierarchisches Universe | `audit_universe` | IMPLEMENTED |
| REQ-AUDIT-002 | Risiko-basierte Audit-Plan-Erstellung | MUST | §9.2 b | Plan = Universe-Subset, gewichtet nach Risk | `audit_plan` | IMPLEMENTED |
| REQ-AUDIT-003 | Auditor-Profile mit Kompetenz-Check | MUST | §9.2 c | Auditor-Skills, Unabhängigkeits-Flag | `auditor`, `auditor_profile` | IMPLEMENTED |
| REQ-AUDIT-004 | Working Papers (Beleg-Sammlung pro Audit) | MUST | §9.2 e | Pro Audit: Working-Paper-Tree | `working_paper` | IMPLEMENTED |
| REQ-AUDIT-005 | Audit-Findings mit ISO-Severity (major/minor/observation) | MUST | §9.2 e + §10.1 a | Severity-Enum, Closure-Workflow | `audit_finding` | IMPLEMENTED |
| REQ-AUDIT-006 | Bulk-Findings → NCs | SHOULD | §10.1 | Mehrere Findings in einer Aktion | (siehe REQ-ISMS-033) | IMPLEMENTED |
| REQ-AUDIT-007 | Closure-Readiness-Check | SHOULD | §9.2 g | Vor Audit-Closure prüfen: alle Findings dokumentiert? | `audit-mgmt/audits/[id]/closure-readiness` (vorhanden?) | PARTIAL |
| REQ-AUDIT-008 | Audit-Analytics (Trends, Repeats, Hot-Areas) | SHOULD | §9.1 | Aggregierte Auswertung | `audit_analytics` | IMPLEMENTED |
| REQ-AUDIT-009 | Audit-Impact-KRIs | SHOULD | §9.1 | KRIs aus Audit-Findings ableiten | `audit_impact_kris` | IMPLEMENTED |
| REQ-AUDIT-010 | Continuous-Audit-Rules | MAY | §9.2 (kontinuierlich) | Regelbasiert auf Live-Daten | `continuous_audit_rule` | IMPLEMENTED |
| REQ-AUDIT-011 | QA-Review Audit | SHOULD | §9.2 (Unabhängigkeit) | Sekundär-Review eines Audits | `qa-review` | IMPLEMENTED |
| REQ-AUDIT-012 | Audit-Templates | SHOULD | §9.2 | Vorlagen pro Domäne | `audit_template` | IMPLEMENTED |
| REQ-AUDIT-013 | Auditor-Team-Zuweisung | MUST | §9.2 c | Team mit Lead+Members pro Audit | `audit.team[]` | IMPLEMENTED |

---

## 6. Cross-Cutting (Audit-Trail, RLS, Multi-Tenant, RBAC, Hash-Chain)

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-XCUT-001 | Append-only Audit-Log mit SHA-256-Hash-Chain | MUST | §7.5.3 + Beweisbarkeit | Trigger fügt prev_hash an, Integrity-Check via Job | `audit_log`, `audit-log/integrity` | IMPLEMENTED |
| REQ-XCUT-002 | Tenant-isoliertes Audit-Log (per_org-Chain) | MUST | §7.5.3 | Pro Org eigene Chain, Cross-Tenant-Isolation getestet | `audit_log` mit `org_id`-Chain, RLS-Policy | IMPLEMENTED |
| REQ-XCUT-003 | RLS-Policies auf jeder Tabelle mit `org_id` | MUST | ADR-001 | Jede Tabelle mit `org_id` hat aktivierte RLS | `rls-audit.ts`, RLS-Tests | IMPLEMENTED |
| REQ-XCUT-004 | Access-Log (read access tracking) | SHOULD | §A.8.15 | Zugriff auf sensible Endpoints geloggt | `access_log` | IMPLEMENTED |
| REQ-XCUT-005 | Data-Export-Log | SHOULD | §A.5.13 | Jeder Export geloggt mit Initiator + Datenmenge | `data_export_log`, `/api/v1/export` | IMPLEMENTED |
| REQ-XCUT-006 | Approval-Workflow (generisch) | SHOULD | §7.5 | Beliebige Entitäten approvable mit Sign-Off | `approval_workflow` | IMPLEMENTED |
| REQ-XCUT-007 | Org-Switching ohne Re-Login | MUST | §A.5.3 (Aufgabentrennung) | Auth.js Multi-Org-Token | `auth/switch-org` | IMPLEMENTED |
| REQ-XCUT-008 | MFA-Erzwingung pro Rolle | MUST | A.8.5 | Auth.js MFA-Provider | (vorhanden?) | PARTIAL |
| REQ-XCUT-009 | SSO (SAML/OIDC) | SHOULD | A.8.5 | Provider konfigurierbar pro Org | `auth/sso`, `oidc.test`, `saml.test` | IMPLEMENTED |
| REQ-XCUT-010 | SCIM Provisioning | SHOULD | A.5.16 | SCIM 2.0-API | `admin/scim`, `scim.test` | IMPLEMENTED |
| REQ-XCUT-011 | Notifications-System | SHOULD | A.5.30 | Pro User: in-app + email + push | `notification`, `email-service.test` | IMPLEMENTED |
| REQ-XCUT-012 | i18n DE/EN | MUST | (Geschäftsanforderung) | next-intl mit Fallback DE | `apps/web/messages/de.json`, `messages/en.json` | IMPLEMENTED |
| REQ-XCUT-013 | Reporting / BI | SHOULD | §9.1 | BI-Reports konfigurierbar | `bi_report` Family | IMPLEMENTED |
| REQ-XCUT-014 | API-Schlüssel + OAuth2 für Integrationen | SHOULD | A.8.3 | API-Keys mit Scopes, Rate-Limit | `api_key`, `api_scope`, `api_usage_log` | IMPLEMENTED |
| REQ-XCUT-015 | ABAC (Attribute-Based Access Control) ergänzend zu RBAC | MAY | A.8.3 | Policies auf Attribute-Ebene | `abac` | IMPLEMENTED |
| REQ-XCUT-016 | Custom-Fields pro Org | SHOULD | (Konfigurierbarkeit) | Custom Fields für Risk/Asset/Control | `admin/custom-fields` | IMPLEMENTED |
| REQ-XCUT-017 | Data-Sovereignty / Daten-Region | SHOULD | (Datenschutz) | Region-Pinning + Replication-Policy | `data_region`, `data_residency_rule` | IMPLEMENTED |
| REQ-XCUT-018 | Anchor (External-Trust) Audit-Log | MAY | (Beweisbarkeit) | Hash periodisch an externen Trust-Anchor (Blockchain/RFC3161) | `audit-log/anchor` | IMPLEMENTED |

---

## 7. Cross-Framework Mapping & Reporting

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-XCUT-020 | Framework-Mapping ISO 27001 ↔ NIS2 ↔ DORA ↔ BSI Grundschutz | SHOULD | §6.1.3 | Mapping-Regeln pro Control | `framework_mapping`, `framework_mapping_rule` | IMPLEMENTED |
| REQ-XCUT-021 | Coverage-Snapshot pro Framework | SHOULD | §9.1 | Snapshot zum Stichtag, Diff zum Vorgänger | `framework_coverage_snapshot` | IMPLEMENTED |
| REQ-XCUT-022 | Multi-Framework Gap-Analyse | SHOULD | §10.2 | LLM oder Regelbasiert | `framework_gap_analysis` | IMPLEMENTED |
| REQ-XCUT-023 | NIS2 ↔ DORA Cross-Reference | SHOULD | DORA Art. 1 Abs. 2 | dedizierte Tabelle | `dora_nis2_cross_ref` | IMPLEMENTED |

---

## 8. Stakeholder-Portale

| ID | Anforderung | Priorität | Norm | Akzeptanzkriterium | Software-Mapping | Status |
|----|-------------|-----------|------|---------------------|------------------|--------|
| REQ-XCUT-030 | Auditor-Portal (read-only-Zugriff) | SHOULD | §9.2 | Externe Auditoren mit Scope-begrenztem Zugriff | `(portal)`-Routen | IMPLEMENTED |
| REQ-XCUT-031 | Lieferanten-Portal (TPRM-Fragebögen) | SHOULD | A.5.19 | Externe Vendoren beantworten Fragebögen | `supplier_portal`, `portal_questionnaire_response` | IMPLEMENTED |
| REQ-XCUT-032 | Stakeholder-Portal mit Branding | MAY | (UX) | Pro Portal eigenes Branding | `branding`, `portal_branding` | IMPLEMENTED |
| REQ-XCUT-033 | Whistleblowing-Portal (HinSchG) | MUST (DE) | A.6.8, HinSchG | Anonymer Eingang + Verschlüsselung | `whistleblowing` | IMPLEMENTED |

---

## 9. Nicht-funktionale Anforderungen

| ID | Anforderung | Priorität | Akzeptanzkriterium | Status |
|----|-------------|-----------|---------------------|--------|
| REQ-NFR-001 | Verfügbarkeit ≥ 99.5 % | SHOULD | SLA dokumentiert, Monitoring aktiv | DOC-only — Monitoring vorhanden |
| REQ-NFR-002 | RTO der Plattform ≤ 4 h | SHOULD | BIA für die Plattform selbst | DOC-only |
| REQ-NFR-003 | RPO ≤ 1 h | SHOULD | Backup-Frequenz | DOC-only |
| REQ-NFR-004 | Backup mit Offsite-Kopie | MUST | ADR-015 | IMPLEMENTED (ADR) |
| REQ-NFR-005 | Encryption at rest (DB) | MUST | A.8.24 | DB-Cluster encrypted | INFRA |
| REQ-NFR-006 | Encryption in transit | MUST | A.8.24 | TLS 1.2+ | INFRA |
| REQ-NFR-007 | Logging zentral, mit Retention 1+ Jahr | MUST | A.8.15 | Logging-Stack | INFRA |
| REQ-NFR-008 | Monitoring + Alerting | MUST | A.8.16 | Prometheus/Grafana o. ä. | ADR-017 |
| REQ-NFR-009 | DR-Test mind. jährlich | MUST | A.5.30 | Übungs-Plan | BCMS |
| REQ-NFR-010 | Code-Coverage Backend ≥ 80 % | SHOULD | (CLAUDE.md) | vitest-coverage | TBD — siehe Test-Execution-Report |
| REQ-NFR-011 | Code-Coverage Frontend ≥ 60 % | SHOULD | (CLAUDE.md) | vitest-coverage | TBD |
| REQ-NFR-012 | CI/CD-Pipeline mit Pflicht-Checks (Lint+Test+Build) | MUST | A.8.28 | GH-Actions Required-Checks | IMPLEMENTED (`github-ci.yml`) |
| REQ-NFR-013 | Secret-Management | MUST | A.8.24 | ADR-018, Doppler/HashiCorp Vault o. ä. | ADR-018 |
| REQ-NFR-014 | Rate-Limiting | MUST | A.8.6 | Per-IP + Per-API-Key Rate-Limits | ADR-019 |
| REQ-NFR-015 | API-Versionierung | MUST | A.8.31 | `/api/v1/...`-Präfix, Deprecation-Header | ADR-020 |
| REQ-NFR-016 | Strukturierte Fehlerbehandlung | MUST | A.8.30 | Error-Codes + Trace-IDs | ADR-021 |
| REQ-NFR-017 | Migration-Rollback-Fähigkeit | MUST | A.8.32 | ADR-023 | ADR-023 |

---

## 10. Status-Zusammenfassung

| Domain | IMPLEMENTED | PARTIAL | OPEN |
|--------|-------------|---------|------|
| ISMS-Kern | 24 | 6 | 0 |
| RISK | 14 | 1 | 0 |
| BCMS | 26 | 2 | 0 |
| NIS2 | 4 | 4 | 1 |
| DORA | 12 | 5 | 4 |
| AUDIT | 11 | 1 | 0 |
| AWARE | 3 | 0 | 1 |
| ASSET / THR / VUL / INC | ~22 | 2 | 0 |
| XCUT | 22 | 1 | 0 |
| NFR | 16 (per Doku/Infra) | 0 | 2 (Coverage TBD) |

**Top-Priority-Lücken (Closure-Kandidaten in dieser Session):**

1. REQ-RISK-010 — Risk Re-Assessment Frist + Worker-Job
2. REQ-ISMS-031, REQ-ISMS-032 — NC-Status-Maschine + Wirksamkeits-Pflicht
3. REQ-ISMS-028 — Management-Review-Inputs Auto-Befüllung
4. REQ-INC-007, REQ-INC-008 — Incident-Eskalations-Konfiguration & DORA-Schwellwert-Engine
5. REQ-NIS2-010..012 — Reporting-Engine mit harten Fristen-Timern
6. REQ-NIS2-014 — Aufsichts-Konfiguration
7. REQ-DORA-011 — Major-Incident-Threshold-Engine
8. REQ-DORA-022 — TLPT-Provider-Compliance-Check
9. REQ-DORA-031, REQ-DORA-032 — Provider-Risiko-Score, Konzentrationsrisiko
10. REQ-DORA-033, REQ-DORA-034 — Vertrags-Klausel-Check + Exit-Strategie
11. REQ-AUDIT-007 — Closure-Readiness-Check für Audits
12. REQ-XCUT-008 — MFA-Erzwingung pro Rolle (sofern nicht vorhanden)
13. REQ-AWARE-004 — Phishing-Sim-Connector-Stub
14. REQ-BCMS-012 — BCP-Activation-Trigger-Field
15. REQ-BCMS-036 — Lessons → CAPA-Wiring
16. REQ-ISMS-005 — Stakeholder-Register

Die Schließung dieser 16 Items ist Teil der Phasen 2e–2g dieser Session.

---

Verweise:
- [06-test-plan.md](./06-test-plan.md)
- [07-test-execution-report.md](./07-test-execution-report.md)
- [08-gap-closure-report.md](./08-gap-closure-report.md)
