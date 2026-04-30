# Roadmap Jahr 1 — ISMS + ISO 27005 + ISO 22301 + NIS2 + DORA

**Geltungsbereich:** Vollständiger Einführungs-Ablaufplan für ein integriertes Managementsystem aus ISMS (27001:2022), Risiko-Methodik (27005:2022), BCMS (22301:2019), NIS2-Compliance (RL (EU) 2022/2555) und DORA (VO (EU) 2022/2554).
**Zeithorizont:** 12 Monate, Monat-genauer Plan.
**Voraussetzung:** GL-Beschluss, Budget freigegeben, ISMS-/BCM-Manager benannt.

---

## 1. Programm-Struktur

```
Y1 = 4 Quartals-Phasen × 3 Tracks:
  TRACK A: ISMS / NIS2 / DORA (Informationssicherheit)
  TRACK B: BCMS (Geschäftskontinuität)
  TRACK C: Programm-Steuerung (PMO, Tooling, Schulung)
```

Tracks **laufen parallel**, mit definierten Synchronisationspunkten.

---

## 2. Programm-Setup (Monat 0)

### Aktivität 0.1 — GL-Commitment & Charter
- **Owner:** GF / CISO
- **Output:** Programm-Charter, Budget, Scope-Eckpunkte, Lenkungsausschuss
- **Software-Mapping:** noch keine — Word-Doku, später `document` Modul

### Aktivität 0.2 — Programm-Office aufsetzen
- **Owner:** Programm-Manager
- **Output:** PMO-Workspace, Risiko-Log, Stakeholder-Map, Kommunikations-Plan
- **Software-Mapping:** `work_item`, `task`, `notification`

### Aktivität 0.3 — Tooling-Strategie
- **Owner:** CIO / IT
- **Output:** Tooling-Setup ARCTOS-Plattform (DEV → STAGING → PROD), Datenmodell-Validierung
- **Software-Mapping:** `organization` (Mehr-Mandanten-Setup), Auth.js + RBAC

---

## 3. Q1 — Monate 1–3: PLAN-Phase

### M1 — Kontext & Geltungsbereich

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M1-01 | Stakeholder-Analyse | A,B | ISMS-Manager | Stakeholder-Register | `document`, ggf. `stakeholder_register` (TBD) |
| Y1-M1-02 | Externer Kontext | A | CISO | Trend-/Threat-Analyse | `horizon_scan`, `regulatory_change` |
| Y1-M1-03 | Interner Kontext | A,B | ISMS-Manager | Org-Doku | `organization` Hierarchie |
| Y1-M1-04 | Geltungsbereich-Workshop | A,B | GL + CISO | Scope-Statement v0.9 | `document` |
| Y1-M1-05 | NIS2-Anwendbarkeitsprüfung | A | DPO + Legal | NIS2-Memo (essential / important / out-of-scope) | `nis2_status` (Pre-Scoping) |
| Y1-M1-06 | DORA-Anwendbarkeitsprüfung | A | DPO + Legal | DORA-Memo | `dora_ict_risk` (Pre-Scoping) |
| Y1-M1-07 | BCMS-Scope-Workshop | B | BCM-Manager | BCMS-Scope-Statement v0.9 | `document` |

**Synchronisationspunkt:** Scope-Konsolidierung (ISMS + BCMS auf gleichem Asset/Prozess-Inventar).

### M2 — Politik, Rollen, Risiko-Methodik

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M2-01 | IS-Politik (5.2) | A | CISO + GL | Policy v1.0 | `document` (PolicyType=is_policy) |
| Y1-M2-02 | BCMS-Politik (22301 §5.2) | B | BCM-Manager + GL | BCM-Policy v1.0 | `document` |
| Y1-M2-03 | RACI / Rollen-Modell | A,B | CISO + HR | RACI-Matrix | `user_organization_role`, `process_raci` |
| Y1-M2-04 | Risiko-Methodik 27005 | A | Risikomanager | RM-Methode v1.0 | `risk_method_doc`, Konfiguration `risk` Modul |
| Y1-M2-05 | Asset-Klassifizierungs-Schema | A | CISO | Klassifizierungs-Standard | `asset.classification`, `asset_risk_recommendation` |
| Y1-M2-06 | NIS2-Maßnahmen-Mapping initial | A | CISO | NIS2-Status alle 10 Kat. = "to_be_assessed" | `nis2_status` Bulk-Import |
| Y1-M2-07 | DORA-Säulen-Mapping initial | A | CISO | DORA-Status alle 5 Säulen | `dora_*` Bulk-Initialisierung |

### M3 — Erstes Risiko-Inventar

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M3-01 | Asset-Erfassung Phase 1 (kritische A-/B-Assets) | A | Asset-Owner | Asset-Inventar ≥ 80 % | `asset`, Hierarchie-Import |
| Y1-M3-02 | Risiko-Identifikation Workshops (5 Workshops) | A | Risikomanager | Risikoregister v1.0 (Top-100) | `risk`, `isms_risk_scenario` |
| Y1-M3-03 | Risiko-Analyse + Bewertung | A | Risk-Owner | bewertete Risiken | `risk_evaluation`, `risk_evaluation_log` |
| Y1-M3-04 | Risikobehandlungs-Optionen | A | Risk-Owner | Vorschlag pro Risiko | `risk_treatment_link` |
| Y1-M3-05 | Annex-A-Mapping | A | CISO | SoA-Entwurf | `isms_soa`, AI Gap-Analysis (`/api/v1/isms/soa/ai-gap-analysis`) |
| Y1-M3-06 | BIA-Vorbereitung (Prozess-Inventar) | B | BCM-Manager + Process-Owner | Prozess-Liste v1.0 | `process`, `process_raci` |
| Y1-M3-07 | DORA: ICT-Provider-Register erstmalig | A | TPRM | Vendor-Register | `dora_ict_provider`, `tprm` |

**Quartals-Gate Q1→Q2:** Lenkungsausschuss-Freigabe Risiko-Methodik, IS-Politik, BCMS-Politik, Scope-Statements final, SoA-Entwurf v0.9.

---

## 4. Q2 — Monate 4–6: DO-Phase 1

### M4 — RTP-Erstauflage + BIA

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M4-01 | Risiko-Behandlungs-Plan | A | Risk-Owner | RTP v1.0 | `risk_treatment_link` mit Plan/Owner/Dates |
| Y1-M4-02 | SoA finalisieren | A | CISO | SoA v1.0 | `isms_soa` mit Status `applicable` / `excluded` + Reason |
| Y1-M4-03 | Restrisiko-Akzeptanz Top-Risiken | A | GL | Risk-Acceptance-Records | `risk_acceptance` mit Approver-Signatur |
| Y1-M4-04 | BIA-Workshops (alle kritischen Prozesse) | B | BCM-Manager | BIA v1.0 | `bcms_bia`, `bcms_bia_impact` |
| Y1-M4-05 | RTO/RPO/MBCO-Festlegung | B | BCM-Manager + Process-Owner | BIA mit RTO/RPO | `bcms_bia.rto`, `.rpo`, `.mbco` |
| Y1-M4-06 | DORA: Outsourcing-Register-Pflichtfelder | A | TPRM + Legal | DORA-konformes Register | `dora_ict_provider` mit allen Pflichtattributen (Art. 28) |

### M5 — Maßnahmen-Umsetzung

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M5-01 | Technische Maßnahmen Welle 1 (Patch, Hardening, MFA, Backup) | A | IT-Ops | Status `in_implementation` → `operational` | `control` mit Status, `control_test` |
| Y1-M5-02 | Organisatorische Maßnahmen Welle 1 (Policies, Verfahrensanweisungen) | A | CISO | 12 Policies + 8 VAs | `document`, `policy_acknowledgment` |
| Y1-M5-03 | Awareness-Programm Start | C | HR + CISO | E-Learning-Kurs Pflicht | `academy_course` (mandatory) |
| Y1-M5-04 | Resilience-Strategien | B | BCM-Manager | Strategie pro kritischem Prozess | `bcms_resilience_strategy` |
| Y1-M5-05 | NIS2-Maßnahmen-Welle 1 (Kat. 1, 2, 7, 9, 10) | A | CISO | 5 Kategorien `implemented` | `nis2_status.implementation_status` |

### M6 — BCP + DORA-Vertiefung

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M6-01 | Erstellung Business Continuity Plans | B | BCM-Manager + Process-Owner | BCPs für alle kritischen Prozesse | `bcms_plan`, `bcms_plan_procedure`, `bcms_plan_resource` |
| Y1-M6-02 | Krisenstab-Charter, Notfall-Kontaktbäume | B | BCM-Manager | `bcms_contact_tree` | `bcms_contact_tree`, `bcms_contact_tree_node` |
| Y1-M6-03 | Krisen-Kommunikations-Vorlagen | B | BCM + Comms | Templates | `document` |
| Y1-M6-04 | DORA: ICT-Risk-Framework dokumentiert | A | CISO | DORA-Risk-Framework v1.0 | `dora_ict_risk` mit Owner |
| Y1-M6-05 | DORA: Incident-Reporting-Prozess + Timer-Engine produktiv | A | CISO + Engineering | Auto-Timer 4h/24h/Final | `dora_ict_incident`, `bcms_crisis_dora_timer` |

**Quartals-Gate Q2→Q3:** RTP umgesetzt ≥ 60 %, SoA aktiv, BCPs für 100 % kritischer Prozesse, BIA finalisiert, DORA-Pflichtregister vollständig, Awareness-Erstrunde abgeschlossen.

---

## 5. Q3 — Monate 7–9: DO-Phase 2 + erstes Üben & Auditieren

### M7 — Übungen + Continuous Monitoring

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M7-01 | BCM-Tabletop-Übung Welle 1 (3 Pläne) | B | BCM-Manager | Übungs-Berichte + Lessons | `bcms_exercise` (type=tabletop) |
| Y1-M7-02 | Continuous Control Monitoring aktivieren (Cloud / Identity / DevOps) | A | IT-Ops | 80 % automatisierte Tests grün | `cloud_test_definition`, `identity_test_result`, `devops_test_result` |
| Y1-M7-03 | Threat-Intel-Feeds aktiviert | A | SOC | mind. 2 Quellen, MITRE-Heatmap aktuell | `isms_threat_feed`, `mitre_heatmap` |
| Y1-M7-04 | NIS2-Maßnahmen-Welle 2 (Kat. 3, 4, 5, 6, 8) | A | CISO | weitere 5 Kategorien `implemented` | `nis2_status` |

### M8 — Pen-Test + Funktionsübung

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M8-01 | Pen-Test extern | A | CISO | Pen-Test-Bericht | `audit_finding` aus Bericht generiert |
| Y1-M8-02 | Vulnerabilities-Behandlung | A | IT-Ops | offene High/Crit ≤ SLA | `vulnerability` Status, Patch-Prozess |
| Y1-M8-03 | BCM-Funktionsübung (1 Plan, real) | B | BCM-Manager + Operations | Funktionsbericht | `bcms_exercise` (type=functional) |
| Y1-M8-04 | DORA: TLPT-Plan vorbereiten (sofern signifikant) | A | CISO + Pen-Test-Provider | TLPT-Konzept | `dora_tlpt_plan` |

### M9 — Erstes internes Audit

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M9-01 | Audit-Plan v1.0 | C | Audit-Lead | Plan + Universe + Zeitplan | `audit_universe`, `audit_plan` |
| Y1-M9-02 | Auditor-Briefing + Kompetenzprüfung | C | Audit-Lead | Auditoren-Pool dokumentiert | `auditor`, `auditor_profile` |
| Y1-M9-03 | Internes Audit Welle 1 (50 % Scope) | C | Auditoren | Findings, NCs, Beobachtungen | `audit_mgmt_audit`, `working_paper`, `audit_finding` |
| Y1-M9-04 | NC-Erfassung + Schließungs-Plan | C | Audit-Lead | NC-Tracker | `isms_nonconformity` |

**Quartals-Gate Q3→Q4:** mindestens 1 Funktionsübung absolviert, internes Audit 50 % Scope abgeschlossen, NCs erfasst, Pen-Test-Lessons-Learned in CAPA überführt.

---

## 6. Q4 — Monate 10–12: CHECK & ACT — Zertifizierungs-Sprint

### M10 — Zweites internes Audit + Wirksamkeitsmessung

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M10-01 | Internes Audit Welle 2 (verbleibender 50 % Scope) | C | Auditoren | vollständige Audit-Coverage | `audit_mgmt_audit` |
| Y1-M10-02 | KPI/KRI-Bewertung | A | CISO | Posture-Score | `posture_domain`, `assurance_score`, `kris` |
| Y1-M10-03 | NC-Schließung Welle 1 (Major NCs Vorrang) | A,B | NC-Owner | ≥ 80 % der Major-NCs geschlossen | `isms_nonconformity` |
| Y1-M10-04 | Stage-1 Pre-Audit-Generalprobe | C | CISO | interne Bestätigung Auditreife | `cert_readiness_assessment` |

### M11 — Management-Review + Stage-1-Audit

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M11-01 | Management-Review Vorbereitung | A,B,C | CISO + BCM-Manager | Review-Pack mit allen Pflicht-Inputs | `isms_review` Type=management |
| Y1-M11-02 | Management-Review Sitzung | A,B,C | GL | Beschlüsse, Outputs | `isms_review.outcomes` |
| Y1-M11-03 | Stage-1-Audit durch Zertifizierer | A,B,C | extern + CISO | Stage-1-Bericht | `audit_mgmt_audit` (External=true) |
| Y1-M11-04 | NC-Schließung Stage-1-Findings | A,B,C | NC-Owner | offene Items ≤ 5 | `isms_nonconformity` |

### M12 — Stage-2 + Zertifikat

| ID | Aktivität | Track | Owner | Output | Software-Modul |
|----|-----------|-------|-------|--------|----------------|
| Y1-M12-01 | Stage-2-Audit | A,B,C | extern + Audit-Lead | Stage-2-Bericht | `audit_mgmt_audit` |
| Y1-M12-02 | NC-Schließung Stage-2 (Minor) | A,B,C | NC-Owner | abgegeben innerhalb 90 Tagen | `isms_nonconformity` |
| Y1-M12-03 | Zertifikat-Ausstellung 27001 | A | extern | ISO 27001 Zertifikat | `cert_evidence_package` |
| Y1-M12-04 | Zertifizierung 22301 (separat oder integriert) | B | extern | ISO 22301 Zertifikat | `cert_evidence_package` |
| Y1-M12-05 | Jahresbericht Y1 | C | CISO | Jahresbericht | `bi_report` Template "annual_report_y1" |
| Y1-M12-06 | Plan(Y2) | C | CISO + GL | Y2-Roadmap | siehe `04-roadmap-year-2.md` |

---

## 7. Track-übergreifende Synchronisations-Punkte

| SP | Monat | Inhalt |
|----|-------|--------|
| SP-1 | M1 | Scope-Konsolidierung ISMS + BCMS |
| SP-2 | M3 | Risiko-Methodik gemeinsam für ISMS-Risk + BCM-Risk |
| SP-3 | M4 | RTP- vs BIA-Cross-Reference (gemeinsame Maßnahmen identifizieren) |
| SP-4 | M6 | NIS2/DORA-Lieferanten = TPRM-Set |
| SP-5 | M7 | Übungs-Plan harmonisiert mit Audit-Programm |
| SP-6 | M9 | NC-Konsolidierung (ISMS-NCs + BCMS-NCs in einem Tracker) |
| SP-7 | M11 | Gemeinsames Management-Review für ISMS + BCMS |

---

## 8. Ressourcen-Plan (FTE-Ansatz)

| Rolle | M1-M3 | M4-M6 | M7-M9 | M10-M12 |
|-------|-------|-------|-------|---------|
| ISMS-Manager | 1.0 | 1.0 | 1.0 | 1.0 |
| BCM-Manager | 0.8 | 1.0 | 1.0 | 0.8 |
| Risikomanager | 0.5 | 0.6 | 0.5 | 0.5 |
| Auditor (intern) | 0.0 | 0.2 | 0.8 | 0.6 |
| DPO | 0.2 | 0.2 | 0.3 | 0.3 |
| TPRM-Manager | 0.3 | 0.5 | 0.5 | 0.4 |
| Operations-Vertreter | 0.3 | 0.5 | 0.4 | 0.3 |
| HR (Awareness) | 0.2 | 0.4 | 0.2 | 0.2 |
| Externe Beratung | 0.5 | 0.3 | 0.5 | 0.7 |

---

## 9. Budget-Plan (Skizze, organisationsabhängig)

| Posten | Budget-Anteil |
|--------|---------------|
| Tooling (ARCTOS-Hardware/Cloud, Lizenzen, Connectors) | 25 % |
| Externe Beratung + Auditor (Stage-1/2) | 30 % |
| Awareness + Trainings | 10 % |
| Pen-Test + TLPT (Y1 Vorbereitung) | 15 % |
| Personal-Aufstockung | 15 % |
| Reserve / unvorhergesehen | 5 % |

---

## 10. Risikoabhängige Skalierung

Für **mittelständische Organisationen** kann Y1 in 9 Monaten gestrafft werden, wenn:
- nur ISMS-Pflicht (kein DORA, kein BCMS-Zertifizierungsziel)
- gut dokumentierter Status quo
- vorhandene IS-Reife (Maturity ≥ 2)

Für **Konzerne mit > 3 Tochtergesellschaften und Multi-Standort** ist Y1 = 18 Monate realistisch (zusätzliche Ramp-up-Zeit für Multi-Entity-RLS, Föderationsentscheidungen, multiple Aufsichtsbehörden).

---

## 11. Erfolgskriterien Y1 (Hard Gates)

| Gate | Minimal-Anforderung |
|------|---------------------|
| Q1 → Q2 | Scope, Politik, Methodik, SoA-Entwurf v0.9 |
| Q2 → Q3 | RTP umgesetzt ≥ 60 %, BCPs für 100 % kritischer Prozesse, BIAs final |
| Q3 → Q4 | Internes Audit 50 % Scope abgeschlossen, mindestens 1 Funktionsübung |
| Y1-Ende | ISO 27001 + 22301 Stage-2 bestanden, ≤ 5 offene Minor-NCs, NIS2/DORA-Compliance evidenzbasiert nachweisbar |

---

## 12. Anti-Patterns & Frühwarnzeichen

| Frühwarnzeichen | Gegenmaßnahme |
|-----------------|---------------|
| GL-Beschlüsse > 4 Wochen Verzögerung | Eskalations-Routine, Lenkungsausschuss-Frequenz erhöhen |
| Asset-Inventar < 50 % nach M3 | Workshop-Modus, Asset-Discovery-Tooling, Process-Owner Mandat erweitern |
| RTP-Slippage > 20 % nach M5 | RTP-Re-Priorisierung, Risiko-Akzeptanz für Maßnahmen mit Cost > Benefit |
| Awareness-Klickrate ≤ 50 % | Microlearning, Pflicht-Reminder, persönliche Vorgesetzten-Eskalation |
| Übung gestrichen | nie streichen — auf Tabletop reduzieren statt absagen |
| Audit-NC-Anhäufung > 30 | NC-Schließungs-Sprint, externer Spezial-Support |
| Stage-1-NCs > 10 Major | Zertifizierung verschieben um 3 Monate, intensive Korrektur-Phase |

---

Verweise:
- [04-roadmap-year-2.md](./04-roadmap-year-2.md)
- [05-requirements-catalog.md](./05-requirements-catalog.md)
