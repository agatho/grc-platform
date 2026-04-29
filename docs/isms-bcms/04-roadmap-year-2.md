# Roadmap Jahr 2 — Festigung, Reife-Steigerung & KVP

**Geltungsbereich:** Konsolidierungs- und Reifejahr nach erfolgreicher Erst-Zertifizierung. Reifegrad-Steigerung von Level 3 (defined/zertifiziert) auf Level 4 (managed/quantitativ gesteuert) im integrierten ISMS+BCMS-Programm.
**Voraussetzung:** [03-roadmap-year-1.md](./03-roadmap-year-1.md) erfolgreich abgeschlossen, ISO 27001 + 22301 Zertifikate vorhanden.
**Zeithorizont:** 12 Monate.

---

## 1. Strategische Stoßrichtungen Y2

| # | Stoßrichtung | Ergebnis Y2-Ende |
|---|--------------|------------------|
| 1 | **Wirksamkeit > Existenz** — Controls nicht nur dokumentiert, sondern messbar wirksam | Effektivitäts-Score ≥ 80 % aller A-Controls |
| 2 | **Quantifizierung** — qualitative Risikobewertung um quantitative Ebene ergänzen | FAIR/Monte-Carlo für Top-20-Risiken |
| 3 | **Automatisierung** — manuelle Audit-Stichproben durch Continuous Control Monitoring ersetzen | ≥ 60 % automatisierte Control-Tests |
| 4 | **Resilienz-Vertiefung** — von Tabletops zu Live-Übungen, DORA-TLPT | mind. 1 Live-Failover, TLPT-Plan-Start |
| 5 | **Multi-Framework-Konsolidierung** — Cross-Mappings, Single-Source-of-Truth Controls | 1 Control-Set bedient ≥ 4 Frameworks |
| 6 | **Stakeholder-Wert** — KPI-Berichterstattung an GL, AR, Aufsicht standardisiert | Standard-Bericht „IS-Cockpit" produktiv |

---

## 2. Quartals-Übersicht

```
Q1 (Y2): Risiko-Aktualisierung Tiefe + Quantifizierung Top-Risiken
Q2 (Y2): Wirksamkeitsmessung + Gap-Closure aus Y1-Surveillance
Q3 (Y2): Reife-Audit + Live-Übungen + TLPT-Vorbereitung (DORA)
Q4 (Y2): Surveillance-Audit (extern) + Re-Mapping + Plan(Y3)
```

---

## 3. Q1 (Y2) — Risiko-Tiefe & Quantifizierung

### M13 — Risiko-Re-Assessment alle Top-Assets

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M13-01 | Risiko-Re-Assessment für 100 % A-Assets | Risikomanager | aktualisiertes Risikoregister | `risk` mit `last_assessed_at` Re-Stempel, `risk_evaluation_log` |
| Y2-M13-02 | Quantifizierungs-Programm Top-20 | Risikomanager + Externe | FAIR-Modell pro Risiko | `risk_quantification_config`, `risk_var_calculation` |
| Y2-M13-03 | Risiko-Appetit-Schwellwerte | GL + CISO | Schwellwerte freigegeben | `risk_appetite_threshold` |
| Y2-M13-04 | Sensitivity-Analyse | Risikomanager | Tornado-Diagramm Top-Risiken | `risk_sensitivity_analysis` |
| Y2-M13-05 | Executive Risk Summary v1 | CISO | quartalsweise Reporting-Format | `risk_executive_summary` |

### M14 — KRI/KPI-System produktiv

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M14-01 | KRI-Definition pro Risiko-Cluster | Risikomanager | KRI-Katalog v1.0 | `kris` |
| Y2-M14-02 | Posture-Trend-Reporting | CISO | monatlicher Trend-Report | `posture_trend`, `assurance_trend` |
| Y2-M14-03 | Predictive-Risk pilotieren | Risikomanager + Data-Science | 3 Vorhersagemodelle aktiv | `risk_prediction_model`, `risk_prediction`, `risk_anomaly_detection` |
| Y2-M14-04 | Reife-Modell-Self-Assessment | CISO | Maturity v2 (Soll = Level 4) | `maturity_assessment`, `maturity_roadmap_item` |

### M15 — Awareness-Vertiefung

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M15-01 | Y2-Awareness-Programm + Phishing-Sims (Q-weise) | HR + CISO | Klickrate < 8 % | `academy_course` v2, Phishing-Sim-Plattform-Anbindung |
| Y2-M15-02 | Spezial-Schulungen (Schlüsselrollen) | CISO | Privilegierte-Nutzer-Training | `academy_course` (role-targeted) |
| Y2-M15-03 | Compliance-Kultur-Survey | DPO | Survey-Resultate | `compliance_culture` Survey-Modul |

**Quartals-Gate Q1(Y2)→Q2(Y2):** Risiko-Register aktualisiert, Top-20-Risiken quantifiziert, KRI-System produktiv, Awareness-Y2 gestartet.

---

## 4. Q2 (Y2) — Wirksamkeit & Gap-Closure

### M16 — Wirksamkeits-Tests

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M16-01 | Control-Test-Skripte v2 | CISO + IT-Ops | 90 % automatisierbare Controls mit Skript | `control_test_script`, `control_test_execution` |
| Y2-M16-02 | Continuous Control Testing erweitern (Cloud + Identity + DevOps + SaaS) | IT-Ops | mind. 4 Connector-Familien aktiv | `cloud_connector`, `identity_saas_connector`, `devops_connector` |
| Y2-M16-03 | Effektivitäts-Bewertung pro Control | CISO + Auditor | Score ≥ 80 % der A-Controls | `control.effectiveness_score`, `risk_treatment_link.effectiveness_score` |

### M17 — Gap-Closure aus Y1

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M17-01 | Schließung Y1-Minor-NCs | NC-Owner | 100 % Minor-NCs Y1 geschlossen | `isms_nonconformity` |
| Y2-M17-02 | Y1-Lessons-Learned in CAPA | CISO + BCM | CAPA-Programm v2 | `improvement_initiative`, `bcms_exercise_lesson` |
| Y2-M17-03 | Policy-Review-Welle | CISO | 100 % Policies < 24 Monate alt | `document` Versions-/Approval-Workflow |

### M18 — BCMS-Vertiefung

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M18-01 | BIA-Refresh (anlassbezogen + jährlich) | BCM-Manager | 100 % BIAs aktualisiert | `bcms_bia` mit `last_reviewed_at` |
| Y2-M18-02 | BCM-Übungs-Plan Y2 | BCM-Manager | Übungs-Kalender | `bcms_exercise` Type-Mix |
| Y2-M18-03 | Live-Failover (1 Plan, real, kontrolliert) | BCM + Operations | Live-Übungs-Bericht | `bcms_exercise` (type=live) |
| Y2-M18-04 | Resilience-Score produktiv | BCM-Manager | Score ≥ 80 % | `bcms_resilience_score` |

**Quartals-Gate Q2(Y2)→Q3(Y2):** Wirksamkeit ≥ 80 % der A-Controls, Y1-Minor-NCs zu 100 % geschlossen, Live-Übung absolviert.

---

## 5. Q3 (Y2) — Reife-Audit + DORA-TLPT-Vorbereitung

### M19 — Internes Audit Y2

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M19-01 | Risikobasierter Audit-Plan Y2 (≠ Y1-Universe) | Audit-Lead | abgedeckter Restscope | `audit_universe`, `audit_plan` |
| Y2-M19-02 | Audit-Welle 1 (45 % Scope) | Auditoren | Findings, NCs | `audit_mgmt_audit` |
| Y2-M19-03 | Audit-Welle 2 (45 % Scope) | Auditoren | Findings, NCs | `audit_mgmt_audit` |
| Y2-M19-04 | Audit-Analytics (Trends Y1 vs Y2) | Audit-Lead | Trend-Bericht | `audit_analytics`, `audit_impact_kris` |

### M20 — DORA-TLPT (sofern signifikant)

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M20-01 | TLPT-Scope-Workshop mit Aufsicht | CISO + Compliance | TLPT-Scope freigegeben | `dora_tlpt_plan` |
| Y2-M20-02 | TLPT-Provider-Auswahl + Vertrag | CISO + Procurement | Vertrag + NDA | `dora_tlpt_plan.provider_id` |
| Y2-M20-03 | TLPT-Durchführung Phase 1 (Recon + Threat-Modell) | extern | Threat-Modell-Bericht | `dora_tlpt_plan.phases[]` |
| Y2-M20-04 | TLPT-Durchführung Phase 2 (Active Test) | extern | Test-Bericht | `dora_tlpt_plan.results` |

### M21 — NIS2/DORA-Reporting-Reife

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M21-01 | NIS2-Annual-Statistik an Aufsicht | CISO | Reporting fristgerecht | `nis2_report` (annual) |
| Y2-M21-02 | DORA-Information-Sharing-Programm | CISO + Branchen-ISAC | aktive Teilnahme | `dora_information_sharing` |
| Y2-M21-03 | Cross-Mapping NIS2 ↔ DORA ↔ 27001 | CISO | Coverage-Matrix | `framework_mapping`, `framework_coverage_snapshot` |

**Quartals-Gate Q3(Y2)→Q4(Y2):** Internes Audit Y2 abgeschlossen, TLPT Phase 1+2 absolviert (sofern relevant), Cross-Mappings dokumentiert.

---

## 6. Q4 (Y2) — Surveillance + Plan(Y3)

### M22 — Externes Surveillance-Audit

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M22-01 | Vorbereitung Surveillance-Audit (Pre-Audit-Pack) | CISO | Evidence-Bundle | `cert_evidence_package`, `cert_readiness_assessment` |
| Y2-M22-02 | Surveillance-Audit 27001 + 22301 | extern | Bericht | `audit_mgmt_audit` (External) |
| Y2-M22-03 | NC-Schließung Surveillance | NC-Owner | offene Minor < 5 | `isms_nonconformity` |

### M23 — Management-Review Y2

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M23-01 | Management-Review-Pack mit Quantifizierungs-Modul | CISO | Pflicht-Inputs (9.3.2) + FAIR-Output | `isms_review` |
| Y2-M23-02 | Management-Review-Sitzung | GL | Outputs / Beschlüsse | `isms_review.outcomes` |
| Y2-M23-03 | Aufsichtsrats-Berichterstattung | CISO + GL | AR-Vorlage | `bi_report` Template "supervisory_board" |

### M24 — Plan(Y3)

| ID | Aktivität | Owner | Output | Software-Modul |
|----|-----------|-------|--------|----------------|
| Y2-M24-01 | Y3-Roadmap (Re-Zertifizierungs-Vorbereitung) | CISO + GL | Roadmap Y3 | n/a (Doku) |
| Y2-M24-02 | Budget-Antrag Y3 | CISO | Budget genehmigt | n/a |
| Y2-M24-03 | Reife-Modell-Reassessment (Soll Level 4–5) | CISO | Maturity v3 | `maturity_assessment` |

---

## 7. Reife-Pfad

| Reife-Level | Erwartet Ende | Indikatoren |
|-------------|---------------|-------------|
| 1 — Initial | vor Y1 | ad-hoc, reaktiv |
| 2 — Repeatable | M6 | dokumentiert, aber nicht standardisiert |
| 3 — Defined | Y1-Ende | standardisiert, zertifiziert |
| 4 — Managed | **Y2-Ende** | quantitativ gesteuert |
| 5 — Optimizing | Y3+ | kontinuierliche Optimierung mit Predictive |

---

## 8. Y2-Erfolgskriterien

| Kriterium | Schwelle |
|-----------|----------|
| Surveillance-Audit ohne Major-NC | ja |
| Effektivitäts-Score A-Controls | ≥ 80 % |
| KRI-System produktiv | mind. 30 KRIs aktiv |
| Top-20 Risiken quantifiziert | ja |
| Mind. 1 Live-Failover-Übung | ja |
| TLPT (sofern DORA-relevant) Phase ≤ 2 abgeschlossen | ja |
| Awareness-Klickrate | ≤ 8 % |
| MTTR Critical-Incident | ≤ 3 h (Trend ↓) |
| 100 % Minor-NCs Y1 geschlossen | ja |
| Cross-Framework-Coverage (NIS2/DORA/27001/22301/AI Act) | ≥ 70 % |
| Reife-Modell | Level 4 in mindestens 6 von 10 Domänen |

---

## 9. Vorbereitung Re-Zertifizierung Y3

Re-Zertifizierungs-Audits erfolgen alle 3 Jahre (Stage-2-Tiefe). Y2-Outputs als Vorbereitung:

- Vollständige Audit-Trail-Historie 2 Jahre
- Lückenlose NC-Closure-Dokumentation
- Mindestens 4 Übungen (BCM) je kritischem Plan über 2 Jahre
- 2× vollständige Management-Reviews
- 2× internes Audit-Programm (vollständiger Scope kumuliert)

---

## 10. Risiken Y2

| Risiko | Wirkung | Gegenmaßnahme |
|--------|---------|---------------|
| Komfort-Falle (zertifiziert ≠ wirksam) | Audit findet Minor-Häufung | Wirksamkeitsmessung früh starten, Stichproben |
| KRI-Datenqualität schlecht | Predictive-Modelle untauglich | Datenqualitäts-Sprint M14 |
| TLPT-Provider-Engpass | DORA-Frist gefährdet | Provider früh kontrahieren (M19) |
| Fluktuation in Schlüsselrollen | Knowledge-Loss | Stellvertreter-Konzept, Doku-Pflicht |
| Surveillance-Audit-Schock | Major-NC-Risiko | interner Pre-Audit M21 |

---

Verweise:
- [03-roadmap-year-1.md](./03-roadmap-year-1.md)
- [05-requirements-catalog.md](./05-requirements-catalog.md)
