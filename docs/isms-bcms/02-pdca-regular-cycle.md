# PDCA — Regulärer ISMS-Betriebszyklus

**Geltungsbereich:** Jährlicher Betriebszyklus eines etablierten ISMS nach ISO 27001:2022, mit BCMS-Integration nach 22301:2019, Risiko-Methodik nach 27005:2022, NIS2- und DORA-Compliance.
**Vorgängerdokument:** [01-pdca-introduction-cycle.md](./01-pdca-introduction-cycle.md)
**Adressat:** ISMS-Beauftragter, BCM-Beauftragter, Auditoren, Geschäftsleitung

---

## 1. Zyklus-Charakteristik

| Aspekt | Einführungszyklus | Regulärer Zyklus |
|--------|-------------------|------------------|
| Dauer | 9–18 Monate (einmalig) | **12 Monate** (wiederkehrend) |
| Schwerpunkt | Aufbau, Erstdokumentation | Wirksamkeit, Verbesserung, Anpassung |
| GL-Aufwand | hoch (Kick-off, Politik, Scope) | mittel (Review, Genehmigungen) |
| Audit | 1× intern, 1× extern (Stage-1+2) | 1–2× intern (Surveillance), 1× extern (jährliches Surveillance-Audit) |
| Risiko-Methodik | Erstdefinition + Vollerhebung | Aktualisierung + Re-Bewertung |

---

## 2. Jahres-Kalender (Standard-Zyklus, anpassbar)

```
Q1 (Jan–Mär):  PLAN-Phase    – Risiko-Aktualisierung, Ziele-Set, Audit-Programm
Q2 (Apr–Jun):  DO-Phase 1    – Maßnahmen-Umsetzung, Schulungen, BCMS-Übung 1
Q3 (Jul–Sep):  CHECK-Phase   – internes Audit, KPI-Auswertung
Q4 (Okt–Dez):  ACT-Phase     – Management-Review, NCs schließen, Plan(t+1)
                                + externes Surveillance-Audit
```

> Quartals-Anker können firmenspezifisch verschoben werden, **die Reihenfolge ist verbindlich** (kein Management-Review ohne Audit-Input).

---

## 3. PLAN — Q1 (3 Monate)

### 3.1 Kontext-Aktualisierung (4.1, 4.2)
- **Frequenz:** halbjährlich + anlassbezogen
- **Trigger:** strategische Entscheidungen, M&A, neue Märkte, neue regulatorische Anforderungen, Threat-Landscape-Veränderungen
- **Artefakte:** Update zu `01-context-external.md` und `01-context-internal.md`
- **Software-Mapping:** `horizon_scan_item`, `regulatory_change`, `regulatory_impact_assessment`

### 3.2 Scope-Review (4.3)
- Prüfung Anwendungsbereich auf Aktualität
- Bei wesentlichen Änderungen → Re-Beschluss durch GL
- **Artefakte:** Scope-Statement ggf. v(n+1)

### 3.3 Risiko-Beurteilung (8.2, 27005)

#### 3.3.1 Re-Assessment vorhandener Risiken
- **Pflichtfrequenz:** mindestens jährlich
- **Triggerbasiert:** bei Asset-Änderungen, Threat-Intel-Hits, Incident-Lerneffekten, Lieferantenwechseln
- **Software-Mapping:** `risk` mit `last_assessed_at`, `next_assessment_due_at` + Worker-Job für Fälligkeitsbenachrichtigung

#### 3.3.2 Neu-Identifikation
- Quellen: Threat-Intel-Feeds, CVE-Match-Engine, Ergebnisse aus Pen-Tests, Asset-Discovery
- **Software-Mapping:** `isms_threat_feed`, `cve_match`, `attack_path_batch`

#### 3.3.3 Quantitative Vertiefung (selektiv)
- Für TOP-Risiken: VaR-/CVaR-Analyse via FAIR/Monte Carlo
- **Software-Mapping:** `risk_var_calculation`, `risk_sensitivity_analysis`, `risk_quantification_config`

### 3.4 Risikobehandlung (8.3)
- Update RTP für **alle** veränderten Risiken
- Restrisiko-Akzeptanz pflichtmäßig durch Risikoeigentümer (mit digital signiertem Eintrag)
- **Software-Mapping:** `risk_acceptance` mit Approver-Signatur

### 3.5 SoA-Pflege
- Anpassung bei jeder Control-Status-Änderung (geplant → in_implementation → operational → effective)
- **Software-Mapping:** `isms_soa` mit Change-Log + Diff-Funktion (`/api/v1/isms/soa/diff`)

### 3.6 Ziele (6.2)
- Jahres-Ziele setzen, mit Verantwortlichen, Messgrößen, Zielwerten, Frist, Berichtszyklus
- Vorjahres-Ziele bewerten (Erreicht / Teilweise / Verfehlt + Erklärung)
- **Software-Mapping:** `kris` (Key Risk/Performance Indicators)

### 3.7 Audit-Programm (9.2)
- Jahres-Audit-Plan (Universe → Plans)
- Risikobasierte Themen-Auswahl
- Auditoren-Pool, Unabhängigkeits-Check
- **Software-Mapping:** `audit_plan`, `audit_universe`, `auditor`, `auditor_profile`

---

## 4. DO — Q2 (3 Monate)

### 4.1 Maßnahmen-Umsetzung
- RTP-Items abarbeiten, Status-Tracking
- **Software-Mapping:** `risk_treatment_link` Status-Maschine
- Wirksamkeitsmessung (siehe ISO 27001 §7.5.3)

### 4.2 Awareness-Programm — Wiederholungsschulung
- **Pflichtschulung** für 100 % Mitarbeitende (jährlich)
- Spezial-Trainings für Schlüsselrollen
- Phishing-Simulationen mindestens **quartalsweise**
- **Software-Mapping:** `academy_course` (mandatory=true), `academy_enrollment.completion_required_by`

### 4.3 BCMS-Übungen (22301 §8.5)
- **Mindestens 1 Übung** pro kritischem BCP pro Jahr
- Mischung Tabletop / Funktion / Live
- **Findings + Lessons Learned** dokumentiert + in CAPA überführt
- **Software-Mapping:** `bcms_exercise`, `bcms_exercise_finding`, `bcms_exercise_lesson`

### 4.4 NIS2-Continuous-Compliance
- Monatliche Status-Aktualisierung der 10 Maßnahmenkategorien
- **Software-Mapping:** `nis2_status` per Requirement-ID

### 4.5 DORA-TLPT (alle 3 Jahre für signifikante FUs)
- Ein TLPT-Plan im Jahres-Programm berücksichtigen
- **Software-Mapping:** `dora_tlpt_plan`

### 4.6 Lieferanten-Lebenszyklus (TPRM, NIS2 Art. 21 Abs. 2 Lit. d)
- Onboarding-Assessments
- Periodische Re-Assessments (risikobasiert: kritisch ≤ 12 M, hoch ≤ 24 M, mittel ≤ 36 M)
- Vorfälle bei Lieferanten ins eigene Incident-Mgmt einspeisen
- **Software-Mapping:** `tprm`, `vendors`, `dora_ict_provider`

### 4.7 Continuous Control Monitoring
- Automatisierte Tests via Connectors (AWS/Azure/GCP/IdP/SaaS/DevOps)
- **Software-Mapping:** `cloud_test_definition`, `identity_test_result`, `devops_test_result`

---

## 5. CHECK — Q3 (3 Monate)

### 5.1 Internes Audit
- Vollständiges Audit über die **risikobasiert ausgewählten** Bereiche
- Mindestens alle 3 Jahre **vollständiger Scope** abgedeckt
- Tooling: Working Papers, Tests, Stichproben, Findings, Severity (ISO-NC-Klassifikation: major / minor / observation)
- **Software-Mapping:** `audit_mgmt_audit`, `working_paper`, `audit_finding` mit ISO-Severity

### 5.2 KPI- und KRI-Auswertung
- **Mandatory Inputs für Management-Review:**
  - Status frühere Maßnahmen (CAPA-Closure-Rate)
  - Veränderungen interner/externer Themen
  - Stakeholder-Feedback (Beschwerden, Customer-Audits)
  - Status der IS-Ziele (Erreichungsgrad)
  - Risikolage (Top-Risiken, Trend)
  - Audit-Ergebnisse (intern + extern)
  - Nichtkonformitäten + Korrekturen
  - Verbesserungsmöglichkeiten
- **Software-Mapping:** `dashboard` (Executive-View), `posture_trend`, `assurance_score`, `assurance_trend`

### 5.3 BCMS-Wirksamkeitsbewertung (22301 §9.1, §9.4)
- Messung: Übungserfolg, Lessons-Learned-Abarbeitung, Plan-Aktualität, Trainingsstand
- **Software-Mapping:** `bcms_resilience_score`, `bcms_readiness_monitor`

### 5.4 NIS2-Reporting-Audit
- Stichprobe vergangener Vorfallsmeldungen
- Fristen-Compliance prüfen
- **Software-Mapping:** `nis2_reporting_tracker`, Audit-Stichprobe via `audit_finding`

### 5.5 DORA-Resilience-Test-Auswertung
- TLPT-Berichte, Lessons Learned
- ICT-Vorfalls-KPIs
- **Software-Mapping:** `dora_ict_incident` analytics

---

## 6. ACT — Q4 (3 Monate)

### 6.1 Management-Review (9.3)

**Pflichtteilnehmer:** GL, CISO, BCM-Manager, DPO, Vertreter Operations.
**Pflichtinhalte (9.3.2 a–h, 22301 §9.3.2):**

| Input | Software-Quelle |
|-------|-----------------|
| Status früherer Review-Maßnahmen | `isms_review.action_items[].status` |
| Veränderungen interner/externer Themen | `horizon_scan_item`, `regulatory_change` |
| Rückmeldungen interessierter Parteien | `stakeholder_feedback` (manuell + Beschwerde-Tickets) |
| Erfüllung der IS-Ziele | `kris` mit Soll/Ist |
| Nichtkonformitäten + Korrekturen | `isms_nonconformity` Trend + offene Items |
| Überwachungs-/Mess-Ergebnisse | KPI-Snapshot via `dashboard_snapshot` |
| Audit-Ergebnisse (intern + extern) | `audit_finding` aggregiert nach Severity |
| Wirksamkeit Risikobehandlung | `risk_treatment_link.effectiveness_score` |
| Verbesserungsmöglichkeiten | `improvement_initiative` Backlog |

**Outputs (9.3.3):**
- Beschlüsse zu Verbesserungs-Möglichkeiten
- Ressourcen-Bedarf
- Änderungen am ISMS
- **Software-Mapping:** `isms_review.outcomes[]`, automatisch als Backlog-Items angelegt

### 6.2 Externes Surveillance-Audit
- Halbjähriges (oder jährliches) Audit durch akkreditierte Zertifizierungsstelle
- Stichprobe + ggf. NCs

### 6.3 NC-Schließung
- **Major NC:** binnen 90 Tagen + Wirksamkeits-Nachweis
- **Minor NC:** Plan + Umsetzung in vereinbarter Frist
- **Observation:** Aufnahme in Verbesserungs-Backlog

### 6.4 Jahresbericht
- **Inhalt:** Executive Summary, Ziele-Erreichung, Top-Risiken, Top-Maßnahmen, Übungs-Ergebnisse, Audit-Ergebnisse, Ausblick
- **Adressat:** GL, Aufsichtsrat, ggf. Aufsicht
- **Software-Mapping:** `bi_report` (Template `annual_isms_report`), automatisch befüllt

### 6.5 Plan(t+1)
- Management-Review-Outcome → Backlog für nächsten Zyklus
- Anpassung Audit-Programm, Trainings-Plan, Übungs-Plan, Risiko-Behandlungs-Plan

---

## 7. Querschnittliche Daueraktivitäten

### 7.1 Incident-Management (24/7)
- **SLA-Klassen:**
  - Critical: Reaktion ≤ 15 min, Eindämmung ≤ 4 h, Behebung ≤ 24 h
  - High: ≤ 1 h / 24 h / 72 h
  - Medium / Low: rollierend
- **NIS2-Meldepflicht:** Frühwarnung 24 h, Bericht 72 h, Final 1 Monat
- **DORA-Meldepflicht:** Initial 4 h, Update 24 h, Final 1 Monat
- **Software-Mapping:** `isms_incident`, `dora_ict_incident`, `nis2_report`, automatische Timer

### 7.2 Vulnerability-Management (laufend)
- CVE-Feed, automatische Asset-Korrelation, Patch-SLA pro Severity
- **Software-Mapping:** `cve_feed`, `cve_match`, `vulnerability`

### 7.3 Threat-Intelligence (laufend)
- Externe Feeds (MISP, OpenCTI, sektorale ISACs)
- Heatmap-Aktualisierung
- **Software-Mapping:** `isms_threat_feed`, `mitre_heatmap`

### 7.4 Change-Management (anlassbezogen)
- Wesentliche IS-relevante Änderungen vor Inbetriebnahme bewertet
- Verknüpfung zu Risikoregister & SoA

### 7.5 Awareness (rollierend)
- Microlearning, Newsletter, Phishing-Sims
- Bei Vorfällen Sofort-Kommunikation
- **Software-Mapping:** `academy` Module + `notification`

---

## 8. Outputs des regulären Zyklus

| Output | Frequenz | Empfänger |
|--------|----------|-----------|
| Risiko-Register-Update | mind. jährlich | GL, Aufsichtsrat |
| SoA-aktualisiert | rollierend | Auditor, Aufsicht |
| Awareness-Berichte | quartalsweise | GL, HR |
| Incident-Reports | je Vorfall | GL, Aufsicht (NIS2/DORA) |
| KPI-Dashboard | monatlich | GL |
| Übungsberichte | je Übung | BCM-Manager, GL |
| Auditbericht (intern) | jährlich | GL, Aufsichtsrat |
| Management-Review-Protokoll | jährlich | GL |
| Jahresbericht | jährlich | GL, Aufsichtsrat, Aufsicht |

---

## 9. Re-Zertifizierung (alle 3 Jahre)

Im 3. Jahr Standard-Surveillance + im 3. Surveillance-Audit Vorbereitung Re-Zertifizierung
Bei Re-Zertifizierung Stage-2 Audit-Aufwand → erhöhter Stichproben-Umfang.

---

## 10. Verbesserungs-Mechanismus (Klausel 10.1)

```
                        ┌──────────────────┐
                        │   Trigger-Quelle │
                        │  (Audit-Finding, │
                        │   Incident, KRI- │
                        │   Reißleine,     │
                        │   Stakeholder    │
                        │   Feedback,      │
                        │   Übung)         │
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │  NC-Erfassung    │
                        │  + Klassifik.    │
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │  Root-Cause-Anal.│
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │  Korrektur +     │
                        │  Vorbeuge-Plan   │
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │  Umsetzung       │
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │ Wirksamkeits-    │
                        │ prüfung          │
                        └────────┬─────────┘
                                 ▼
                        ┌──────────────────┐
                        │ Doku + ggf.      │
                        │ Standardisierung │
                        │ + Lessons        │
                        └──────────────────┘
```

**Software-Mapping:** `isms_nonconformity`, `audit_finding`, `bcms_exercise_lesson`, `improvement_initiative`, alle mit Status-Maschine + Wirksamkeitsprüfungs-Pflichtfeld.

---

## 11. Erfolgs-/Reife-Indikatoren

| Indikator | Reife-Schwelle |
|-----------|----------------|
| Anteil Pflicht-Awareness abgeschlossen | ≥ 95 % |
| MTTR (Critical-Incident) | ≤ 4 h (mit Trend ↓) |
| SoA-Compliance (effective Controls) | ≥ 90 % |
| Risiko-Akzeptanz-Rate | ≤ 10 % der hohen Risiken (Trend ↓) |
| BCM-Übungs-Erfolgsrate | ≥ 80 % geplante Übungen mit „pass" |
| Incident-Meldungen NIS2 fristgerecht | 100 % |
| TPRM-Re-Assessment-Rate | ≥ 95 % der fälligen |
| Management-Review-Pünktlichkeit | jährlich, ohne Verzug |
| Externe Audits ohne Major-NC | ja |
| KVP-Items pro Jahr abgeschlossen | ≥ 90 % der geplanten |

---

## 12. Übergänge & Sondersituationen

- **Wesentliche organisatorische Veränderung** (M&A, Standort-Schließung, Cloud-Migration) → außerordentlicher Mini-PLAN-Zyklus, Scope/Risiko/SoA-Update
- **Schwere Vorfälle** → Sofort-CHECK + Sofort-ACT, Re-Audit der betroffenen Bereiche
- **Regulatorische Verschärfung** (z. B. neue NIS2-Konkretisierung) → Anlass-PLAN-Iteration

---

Verweise:
- [01-pdca-introduction-cycle.md](./01-pdca-introduction-cycle.md)
- [03-roadmap-year-1.md](./03-roadmap-year-1.md)
- [04-roadmap-year-2.md](./04-roadmap-year-2.md)
