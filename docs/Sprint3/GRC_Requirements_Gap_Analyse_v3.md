# ARCTOS — Requirements Gap-Analyse v3.0
## CWS/Haniel GRC-Anforderungen vs. Wettbewerber-Features + BIC GRC Detailanalyse

**März 2026 — Version 3.0** (v2.1 + vollständige BIC GRC Analyse aus 46 UI-Screenshots + Video)

**Legende Abdeckung:**
✓✓ = Voll abgedeckt | ✓ = Teilweise | ✗ = Nicht abgedeckt / Gap

**Neu in v3.0:** Vollständige Auswertung von 46 BIC GRC Screenshots (ISMS-Modul, Asset-Management, Assessment-Workflow, Work Items, Dashboards, Incidents). Signifikante Datenpunkt-Erweiterung in ISMS, BCMS, DPMS und Foundation-Bereich.

---

# 1. Executive Summary

## 1.1 Abdeckungsübersicht (unverändert aus v2.1)

| Bereich | Gesamt | MUSS | Voll | Teil | Gap | Gap-% |
|---------|--------|------|------|------|-----|--------|
| 1. Plattform & Architektur | 12 | 8 | 10 | 1 | 1 | 8% |
| 2. BPM / Prozesse | 10 | 6 | 8 | 1 | 1 | 10% |
| 3. ISMS | 12 | 7 | 8 | 3 | 1 | 8% |
| 4. BCMS | 9 | 7 | 7 | 2 | 0 | 0% |
| 5. DPMS | 10 | 6 | 7 | 2 | 1 | 10% |
| 6. ERM | 12 | 8 | 9 | 2 | 1 | 8% |
| 7. IKS / ICS | 8 | 6 | 5 | 2 | 1 | 13% |
| 8. Audit | 8 | 7 | 7 | 1 | 0 | 0% |
| 9. DMS | 7 | 5 | 6 | 1 | 0 | 0% |
| 10. Weitere Features | 10 | 4 | 2 | 3 | 5 | 50% |
| **GESAMT** | **88** | **64** | **69** | **11** | **8** | **9%** |

## 1.2 Neue Erkenntnisse aus BIC GRC v3.0

Die BIC GRC Analyse fügt 47 neue Datenpunkte hinzu, die in der ursprünglichen Requirements-Erhebung nicht explizit spezifiziert wurden — aber für Produktionsreife der Module ISMS, BCMS und DPMS unerlässlich sind.

**Kritischste neue Erkenntnisse:**
1. **Work Item Type System** ist Kernanatomie von BIC GRC — alle GRC-Objekte sind typisierte "Work Items" mit Element-IDs (RSK00000001, INC00000001), zentraler Hub-Seite und Cross-Modul-Verlinkung.
2. **3-stufige Asset-Hierarchie** (Business Structure → Primary Asset → Supporting Asset) mit CIA-Standardwerten pro Asset ist Fundament für alle ISMS-Bewertungen.
3. **Schutzbedarfsfeststellung (PRQ)** ist eigenständiger Work-Item-Typ mit 5-dimensionaler CIA-Bewertung (C/I/A/Authentizität/Verbindlichkeit), BIA-Verknüpfung und MTPD/RTO/MEOP-Feldern — nicht nur ein Attribut.
4. **Assessment-Wizard** ist Kerndifferenzierungsmerkmal: strukturierter 3-Phasen-Prozess (Asset-Auswahl → Assessment-Auswahl → Phasen-Auswahl) mit Fortschrittsanzeige (18%, 95%, 100%), schrittweisem Commit.
5. **Risikokatalog als Bibliothek** (ISO 27005:2018 Annex D, BSI IT-Grundschutz Gefährdungskatalog) mit 3-Ebenen-Trennung: Szenario ↔ Schwachstelle ↔ Bedrohung.
6. **Maturity-Bewertung** (CMMI-Stufen 1–5: aktuell + Ziel) auf Controls — fehlt komplett in bisheriger Planung.
7. **13 neue Work-Item-Typen** die bisher nicht im Datenmodell existieren.

---

# 2. Plattform & Architektur (G-01 bis G-12) — ERWEITERT

| ID | Anforderung (Kurzform) | Prio | Abdeckung | Gap-Analyse / Hinweise |
|----|------------------------|------|-----------|------------------------|
| G-01 | Einheitliche GRC-Plattform | MUSS | ✓✓ | Modulares Monolith-Konzept umgesetzt. |
| G-02 | Multi-Entity: 5 Unternehmen | MUSS | ✓✓ | RLS-Pattern + org_id auf allen Tabellen. |
| G-03 | RBAC mit granularen Berechtigungen | MUSS | ✓✓ | 7 Rollen + Drei-Linien-Modell. |
| G-04 | SSO Azure AD | MUSS | ✓✓ | Clerk OIDC-Integration. |
| G-05 | Cloud + On-Prem | SOLLTE | ✓ | Docker/K8s-Deployment via dev-vm-setup.sh. |
| G-06 | DE + EN UI | MUSS | ✓✓ | next-intl. |
| G-07 | Audit-Trail | MUSS | ✓✓ | Hash-Kette, append-only. |
| G-08 | Dashboards (Betrieb/Mgmt/Vorstand) | MUSS | ✓✓ | Dashboard-Grundlage in Sprint 1. |
| G-09 | Workflow-Engine: Aufgaben, Eskalation, Email | MUSS | ✓ | Task-Entity + Email in Sprint 1.2; **the reference shows: Übergangs-Buttons direkt in Work-Item-Detail (← Prev Status, Next Status →)** → S1.4 WorkItemDetailLayout. |
| G-10 | REST-API | SOLLTE | ✓✓ | API-First. |
| G-11 | Mobile-freundlich | NICE | ✓ | Responsive Design. |
| G-12 | KI-Funktionen | NICE | ✓✓ | Claude API eingeplant. |

**NEU aus BIC — Foundation-Anforderungen (Sprint 1.4):**

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **G-NEW-01** | 3-stufige Asset-Hierarchie (Business Structure / Primary / Supporting Asset) | MUSS | BIC Asset Tree | Sprint 1.4 |
| **G-NEW-02** | CIA-Standardwerte pro Asset (4-Level: Niedrig/Mittel/Hoch/Sehr hoch) mit Vererbung | MUSS | BIC Default Values Tab | Sprint 1.4 |
| **G-NEW-03** | Work-Item-Type-System: typisierte GRC-Objekte mit Element-IDs (RSK, INC, FIN etc.) | MUSS | BIC Work Items Hub | Sprint 1.4 |
| **G-NEW-04** | Zentraler Work-Items-Hub: eine Seite für alle GRC-Objekte (filterbar, durchsuchbar) | MUSS | BIC /work-items | Sprint 1.4 |
| **G-NEW-05** | Cross-Modul-Verlinkung zwischen beliebigen Work-Items | MUSS | BIC Work Item Links Tab | Sprint 1.4 |
| **G-NEW-06** | Tab-basierte Mehrfach-Navigation (max 8 offene Tabs, persistent) | SOLLTE | BIC Tab-Bar | Sprint 1.4 |
| **G-NEW-07** | Asset-Modul-Views (ISMS-Sicht, ERM-Sicht) als benannte Filter-Perspektiven | SOLLTE | BIC Sichten | Sprint 1.4 |
| **G-NEW-08** | Code Groups: konfigurierbare Asset-Klassifizierung pro Plattform | SOLLTE | BIC Code Groups | Sprint 1.4 |

---

# 3. BPM / Prozessmodellierung (P-01 bis P-10) — UNVERÄNDERT

Keine neuen Erkenntnisse aus BIC ISMS-Screenshots (BPM ist separates BIC Process Design Modul).

---

# 4. ISMS (I-01 bis I-12) — MASSIV ERWEITERT

the reference Information Security suite ist das am detailliertesten dokumentierte Modul (25 von 46 Screenshots). Es offenbart eine komplexere Architektur als in der bisherigen Gap-Analyse abgebildet.

## 4.1 Ursprüngliche Anforderungen (I-01 bis I-12)

| ID | Anforderung (Kurzform) | Prio | Abdeckung Vorbilder | Hinweise |
|----|------------------------|------|---------------------|----------|
| I-01 | ISO 27001:2022 + Anhang-A | MUSS | ✓✓ competing GRC suites | Reference: Vollständige ISO/IEC 27002:2022 Kontroll-Liste (5.1–8.34) in Asset Controls-Tab sichtbar. |
| I-02 | NIS2-Mapping | MUSS | ✓✓ | Standard Framework-Import. |
| I-03 | BSI IT-Grundschutz | SOLLTE | ✓ | Reference: Gefährdungskatalog (G.0.x) als Risk-Catalog-Seed sichtbar (G.0.1 Fire, G.0.10–G.0.15). |
| I-04 | Asset-Verwaltung | MUSS | ✓✓ a market reference | **Massiv erweitert** durch competitor analysis → G-NEW-01 bis G-NEW-07. |
| I-05 | Risikobewertung | MUSS | ✓✓ | Assessment-Wizard (reference) zeigt detaillierteren Prozess → I-NEW-03. |
| I-06 | SoA-Management + Anhang-A | MUSS | ✓✓ | Reference: Maturity-Bewertung auf Controls → I-NEW-05. |
| I-07 | Security-Incident-Management | MUSS | ✓✓ | **Massiv erweitert** durch Incident-Screenshots → I-NEW-10 bis I-NEW-18. |
| I-08 | Schwachstellen-/Patch-Tracking | SOLL | ✓ | Reference: Vulnerability als eigener Work-Item-Typ mit Status-Workflow. |
| I-09 | Security-Awareness-Tracking | SOLLTE | ✗ Gap | Weiterhin Eigenentwicklung; in Sprint 5 eingeplant. |
| I-10 | Lieferanten-InfoSec-Bewertung | SOLLTE | ✓✓ | Via TPRM-Modul. |
| I-11 | TISAX-Framework | NICE | ✓ | Als Framework-Import. |
| I-12 | DORA-Module | NICE | ✓ | Als Framework-Import. |

## 4.2 Neue ISMS-Anforderungen aus competitor analysis

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **I-NEW-01** | Schutzbedarf-Feststellung (PRQ): eigenständiger Work-Item-Typ mit C/I/A/Authentizität/Verbindlichkeit (4-Level Farbbalken), BIA-Verknüpfung | MUSS | BIC PRQ-Screenshots | Sprint 5 |
| **I-NEW-02** | PRQ-Dashboard: Schutzbedarfsklassen-Diagramm + MTPD/RTO/MEOP/PostProcessing nach Zeitbuckets (0-4h, 5-24h, 25-72h, 73-240h, 240+h) | MUSS | BIC dashboard1/10 | Sprint 5 |
| **I-NEW-03** | Assessment-Wizard (Schrittweise geführte Bewertung): Asset-Auswahl → Assessment-Auswahl → Phasen-Auswahl → Schritt-für-Schritt-Bewertung mit Commit-Button + Fortschrittsanzeige | MUSS | BIC Assessment-Screenshots | Sprint 5 |
| **I-NEW-04** | Risk-Catalog-Bibliothek: vorinstallierter Gefährdungskatalog (ISO 27005:2018 Annex D, BSI Grundschutz G.0.x) als Schwachstellen-Baumstruktur (ca. 25+ Einträge pro Kategorie) | MUSS | BIC Perform Assessment | Sprint 5 |
| **I-NEW-05** | Maturity-Bewertung auf Controls: Current Maturity (1–5) + Target Maturity (1–5) CMMI-ähnliches Modell | MUSS | BIC Control Assessment | Sprint 5 |
| **I-NEW-06** | 3-Ebenen-Risikomodell: Risk Scenario (Gefährdung) ↔ Vulnerability (Schwachstelle) ↔ Threat (Bedrohung) — drei separate Entitäten | MUSS | BIC dashboard3 | Sprint 5 |
| **I-NEW-07** | Damage Index: berechneter Schadensindex pro Schwachstelle (aus C/I/A-Bewertungen, nummerisch z.B. 81) | SOLL | BIC Risk Evaluation | Sprint 5 |
| **I-NEW-08** | Vulnerability Exposure: Eigenständiges Feld (High/Medium/Low) auf Schwachstellen-Bewertung | SOLL | BIC Risk Evaluation | Sprint 5 |
| **I-NEW-09** | Threat Severity: Eigenständiges Feld (High/Medium/Low) auf Bedrohungs-Bewertung | SOLL | BIC Risk Evaluation | Sprint 5 |
| **I-NEW-10** | Incident-Typen-Taxonomie: Insignificant Interference / Significant Interference / Emergency / Crisis / Catastrophe | MUSS | BIC Incident Type | Sprint 5 |
| **I-NEW-11** | Incident-Kategorien (Multi-Tag): Violation of Access Rights / Unauthorized Disclosure / Security Vulnerabilities in Software Components / Malware etc. | MUSS | BIC Incident Category | Sprint 5 |
| **I-NEW-12** | Incident-Evaluation-Tab: Severity / Impairment of Availability / Impairment of Integrity / Impairment of Confidentiality (Farbbalken), Is Personal Data Affected? (Checkbox), Emergency Plan Link | MUSS | BIC Incident Evaluation | Sprint 5 |
| **I-NEW-13** | Failure Scenario-Verknüpfung am Incident (Link zu Risk Scenario) | MUSS | BIC Incident Report | Sprint 5 |
| **I-NEW-14** | Incident → "New Single Risk" Button: direkte Risiko-Erstellung aus Vorfall | SOLL | BIC Incident detail | Sprint 5 |
| **I-NEW-15** | Incident Course of Incident Tab: Timeline der Vorfall-Ereignisse | SOLL | BIC Incident Tabs | Sprint 5 |
| **I-NEW-16** | Incident Rating Tab: separate Bewertungs-Seite | SOLL | BIC Incident Tabs | Sprint 5 |
| **I-NEW-17** | Control-Assertions: Vollständigkeit / Genauigkeit / Obligations and Rights / Fraud Prevention / Existence / Valuation / Presentation / Safeguarding of Assets | SOLL | BIC Controls dashboard | Sprint 5 |
| **I-NEW-18** | Test-of-Design + Test-of-Effectiveness: separate Felder pro Control-Test (beide können unabhängig Passed/Failed sein) | MUSS | BIC CMT dashboard | Sprint 4 |
| **I-NEW-19** | Management Review als Work-Item-Typ (periodisch, nach ISO 27001 Clause 9.3) | SOLL | BIC Work Items Hub | Sprint 5 |
| **I-NEW-20** | ISMS-Dashboards (10 Übersichts-Seiten): PRQ, Assessments, Risk Scenarios, Single Risks, Controls, Measures, CMT, Findings, Incidents, Management Review | MUSS | BIC Dashboards 1–10 | Sprint 5 |

---

# 5. BCMS (B-01 bis B-09) — ERWEITERT

Aus BIC sichtbar (dashboard1/10 zeigen BCMS-Kontext in Tabs):

## 5.1 Neue BCMS-Anforderungen aus competitor analysis

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **B-NEW-01** | MTPD (Maximum Tolerable Period of Disruption) als Feld in Schutzbedarf: Buckets 0-4h, 5-24h, 25-72h, 73-240h, 240+h | MUSS | BIC PRQ Dashboard | Sprint 6 |
| **B-NEW-02** | RTO (Recovery Time Objective) mit gleichen Zeitbuckets | MUSS | BIC PRQ Dashboard | Sprint 6 |
| **B-NEW-03** | MEOP (Maximum Emergency Operation Period) mit Zeitbuckets | MUSS | BIC PRQ Dashboard | Sprint 6 |
| **B-NEW-04** | PostProcessing-Zeit mit Zeitbuckets | SOLL | BIC PRQ Dashboard | Sprint 6 |
| **B-NEW-05** | Continuity Strategy als Work-Item-Typ (BCM-Kontinuitätsstrategie per Prozess) | MUSS | BIC Work Items Hub | Sprint 6 |
| **B-NEW-06** | Emergency Activity als Work-Item-Typ | SOLL | BIC Work Items Hub | Sprint 6 |
| **B-NEW-07** | Recovery Activity als Work-Item-Typ | SOLL | BIC Work Items Hub | Sprint 6 |
| **B-NEW-08** | Essential Process Flag: Prozesse als business-kritisch markieren (vs. normale Prozesse) | MUSS | BIC Work Items Hub | Sprint 6 |
| **B-NEW-09** | Resource als Work-Item-Typ (physische Ressourcen verknüpft mit Prozessen) | SOLL | BIC Work Items Hub | Sprint 6 |
| **B-NEW-10** | GRC-Perspektive auf Incidents: Incident kann gleichzeitig ISMS + BCM zugeordnet sein | MUSS | BIC Incident Evaluation | Sprint 5/6 |

---

# 6. DPMS (D-01 bis D-10) — ERWEITERT

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **D-NEW-01** | Transfer Impact Assessment (TIA) als eigenständiger Work-Item-Typ (nicht nur Feld in RoPA) | MUSS | BIC Work Items Hub | Sprint 7 |
| **D-NEW-02** | Category of Personal Data: konfigurierbare Taxonomie als Work-Item-Typ | MUSS | BIC Work Items Hub | Sprint 7 |
| **D-NEW-03** | Data Subject Data: strukturierte Erfassung betroffener Personen-Datensätze | SOLL | BIC Work Items Hub | Sprint 7 |
| **D-NEW-04** | Privacy Impact Assessment als Work-Item-Typ (DPIA/DSFA) | MUSS | BIC Work Items Hub | Sprint 7 |
| **D-NEW-05** | Privacy Request als Work-Item-Typ (Betroffenenanfragen Art. 15–22) | MUSS | BIC Work Items Hub | Sprint 7 |
| **D-NEW-06** | Data Breach als Work-Item-Typ (verknüpfbar mit Incidents via is_personal_data_affected) | MUSS | BIC Work Items Hub | Sprint 7 |
| **D-NEW-07** | Is Personal Data Affected? Checkbox auf Incident-Evaluation (Brücke ISMS → DPMS) | MUSS | BIC Incident Evaluation | Sprint 5 |

---

# 7. ERM (E-01 bis E-12) — GERINGFÜGIG ERWEITERT

the reference shows Single Risk Dashboard mit qualitativ (47) + quantitativ (10+3) Bewertungen und 5 Risikostufen (0-7, 8-14, 15-22, 23-29, 30-36). Kein wesentlicher neuer Gap zur bestehenden Sprint-2-Planung.

**Neu:** Risk Scenario (E-07) muss als eigener Work-Item-Typ implementiert werden (nicht als Risiko-Attribut).

---

# 8. IKS / Internal Controls (K-01 bis K-08) — ERWEITERT

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **K-NEW-01** | Test-of-Design + Test-of-Effectiveness: separate Ergebnis-Felder (unabhängig Passed/Failed) | MUSS | BIC CMT Screenshots | Sprint 4 |
| **K-NEW-02** | Control-Assertions-Taxonomie (8 Assertion-Typen nach COSO) | SOLL | BIC Control Dashboard | Sprint 4 |
| **K-NEW-03** | Control-Frequenz-Typen: Event-driven, Daily, Weekly, Monthly, Quarterly, Yearly | MUSS | BIC CMT Frequency Chart | Sprint 4 |
| **K-NEW-04** | Finding-Typen: Observation / Recommendation / Improvement Requirement / Insignificant Nonconformity / Significant Nonconformity | MUSS | BIC Finding Dashboard | Sprint 4 |
| **K-NEW-05** | Controls direkt an Assets verknüpft (Multi-Framework: ISO 27002:2022 + NIST CSF 2.0 gleichzeitig auf einem Asset) | MUSS | BIC Asset Controls Tab | Sprint 5 |

---

# 9. Audit Management (A-01 bis A-08) — GERINGFÜGIG ERWEITERT

| ID | Anforderung (Kurzform) | Prio | Quelle | Sprint |
|----|------------------------|------|--------|--------|
| **A-NEW-01** | Audit Activity als separater Work-Item-Typ (Prüfungshandlungen innerhalb eines Audits) | MUSS | BIC Work Items Hub | Sprint 8 |
| **A-NEW-02** | Audit-Ergebnisse verknüpfbar mit beliebigen Work-Items via work_item_link | MUSS | BIC WI Links | Sprint 8 |

---

# 10. Neue Work-Item-Typen (vollständige Liste aus BIC)

Aus den Work-Items-Hub-Screenshots (workitems overview 1+2) sind **31 Work-Item-Typen** in BIC GRC sichtbar. Die folgende Tabelle zeigt welche bereits im ARCTOS-Datenmodell existieren und welche neu sind:

| BIC Work-Item-Typ | ARCTOS-Status | Sprint |
|---|---|---|
| Work Items (generisch) | ✅ Sprint 1.4 (base) | S1.4 |
| Audit | ✅ Datenmodell v1.0 | S8 |
| Audit Activity | ⬜ Neu | S8 |
| Business Impact Analysis | ✅ Datenmodell v1.0 | S6 |
| Category of personal Data | ⬜ Neu | S7 |
| Continuity Strategy | ⬜ Neu | S6 |
| Control | ✅ Datenmodell v1.0 | S4 |
| Control & Measure Testing | ✅ Datenmodell v1.0 (ControlTest) | S4 |
| Data Breach | ✅ Datenmodell v1.0 | S7 |
| Data Processing (Verarbeitung) | ⬜ Neu (vs. Data Processing Agreement) | S7 |
| Data Processing Agreement (AVV) | ✅ Datenmodell v1.0 | S7 |
| Data Subject Data | ⬜ Neu | S7 |
| Documented Information | ✅ Datenmodell v1.0 (Document) | S4 |
| Emergency Activity | ⬜ Neu | S6 |
| Emergency Drill | ✅ Datenmodell v1.0 (Exercise) | S6 |
| Emergency Plan | ✅ Datenmodell v1.0 (BCP) | S6 |
| Essential Process | ⬜ Neu (Flag auf Prozess, nicht neues Objekt) | S3/S6 |
| Finding | ✅ Datenmodell v1.0 | S4 |
| Incident | ✅ Datenmodell v1.0 | S5 |
| Management Review | ⬜ Neu | S5 |
| Measure (Maßnahme) | ✅ Datenmodell v1.0 (Action) | S1.2 |
| Privacy Impact Assessment | ✅ Datenmodell v1.0 (DPIA) | S7 |
| Privacy Request | ✅ Datenmodell v1.0 (DataSubjectRequest) | S7 |
| Protection Requirements | ⬜ Neu — eigener Typ | S5 |
| Recovery Activity | ⬜ Neu | S6 |
| Resource | ⬜ Neu | S6 |
| Risk Scenario (Gefährdung) | ⬜ Neu (vs. Risk) | S5 |
| Single Risk | ✅ Datenmodell v1.0 (Risk) | S2 |
| Threat (Bedrohung) | ⬜ Neu — 3-Ebenen-Risikomodell | S5 |
| Transfer Impact Assessment | ✅ Datenmodell v1.0 | S7 |
| Vulnerability | ✅ Datenmodell v1.0 | S5 |

**Neue Objekte gesamt: 11** (Audit Activity, Category of Personal Data, Continuity Strategy, Data Processing, Data Subject Data, Emergency Activity, Management Review, Protection Requirements, Recovery Activity, Resource, Risk Scenario/Threat als Trennung)

---

# 11. Assessment-Workflow: Detaillierte Modellierung (Sprint 5)

the reference shows einen eigenständigen "Perform Assessment"-Workflow als separaten Bereich (nicht integriert in Asset-Management):

```
Perform Assessment
├── Manage Assessments  (Übersicht aller Assessment-Runs)
└── Perform Assessment  (Wizard-Modus)
    ├── Step 1: Asset Selection (Baum-Dialog, multi-select)
    ├── Step 2: Assessment Selection (Risk Assessment / Control Assessment)
    ├── Step 3: Phase Selection
    └── Assessment Screen
        ├── Left panel: Risk Catalog / Control Catalog (Baumstruktur)
        ├── Right panel: Evaluation + Work Items + Documentation + Audit Trail
        │   Risk Evaluation:
        │   - Confidentiality (Dropdown 1-4)
        │   - Integrity (Dropdown 1-4)
        │   - Availability (Dropdown 1-4)
        │   - Applicable (Yes/No)
        │   - Reason Applicability (Freitext)
        │   - Description (Freitext)
        │   - Vulnerability Exposure (High/Medium/Low)
        │   - Threat Severity (High/Medium/Low)
        │   - Damage Index (berechnet, z.B. 81)
        │   Control Evaluation (ISO 27002:2022):
        │   - Applicable (Yes/No)
        │   - Reason Applicability (Freitext)
        │   - Description (Freitext)
        │   - Current Maturity (1-5 Dropdown mit Texten)
        │   - Target Maturity (1-5 Dropdown)
        └── Progress bar (z.B. "Risk Assessment (95%)")
            Commit button: "Do you really want to commit the Risk Assessment?"
```

**Neue Entities (Sprint 5):**
- `assessment_run` (Metadaten zum Assessment-Lauf: Asset, Assessment-Typ, Bearbeiter, Status, Fortschritt %)
- `risk_catalog_entry` (vorinstallierter Katalog-Eintrag: ISO 27005, BSI G.0.x)
- `vulnerability` + `threat` als separate Entities (nicht nur Felder)
- `protection_requirement` (PRQ-Work-Item mit CIA-Bewertung + MTPD/RTO/MEOP)
- `assessment_risk_evaluation` (Ergebnis pro Risk-Catalog-Eintrag × Asset)
- `assessment_control_evaluation` (Ergebnis pro Control × Asset, inkl. Maturity)

---

# 12. Überarbeitete Sprint-Roadmap v3.0

```
Sprint 1       → Foundation (Auth, RBAC, Audit, UI-Shell)             ✅ Abgeschlossen
Sprint 1.2     → Workflow + Email + Org GDPR-Extension                 🔄 In Arbeit
Sprint 1.3     → Module System (module_config, ModuleGate, Sidebar)    ⬜ Geplant
Sprint 1.4     → Extended Assets + Work Item System + Tab-Nav          ⬜ NEU (aus competitor analysis)
Sprint 2       → ERM: Risk Register + KRI Dashboard                    ⬜ PRD vorhanden
Sprint 3       → BPMN: Prozessmodellierung                             ⬜ Geplant
Sprint 4       → IKS + DMS (inkl. ToD/ToE, Finding Types, CMT-Freq.)   ⬜ PRD fehlt noch
Sprint 5       → ISMS (Assessment-Wizard, PRQ, Risk Catalog, Incidents) ⬜ PRD fehlt → KOMPLEX
Sprint 6       → BCMS (BIA, BCM, MTPD/RTO, Continuity Strategy)       ⬜ PRD fehlt
Sprint 7       → DPMS (RoPA, DSFA, DSR, Data Breach, TIA)             ⬜ PRD fehlt
Sprint 8       → Audit Management                                       ⬜ PRD fehlt
Sprint 9       → TPRM + Contract Management                            ⬜ PRD fehlt
Phase 3-A      → ESG + CSRD Materialität + ESRS Metriken               ⬜ Konzept vorhanden
Phase 3-B      → Whistleblowing                                         ⬜ Konzept vorhanden
```

**Wichtige Hinweise zur Sprint-5-Komplexität:**
Sprint 5 (ISMS) ist das mit Abstand komplexeste Modul der Plattform. the reference shows 10 eigenständige Overview-Dashboards, einen mehrstufigen Assessment-Wizard, 20 neue Datenpunkte und die Integration aller anderen Module. Realistische Schätzung: 80–100 SP (nicht 18 SP wie im Sprint-2-Outlook). Sprint 5 sollte in 5a (Asset + Schutzbedarfsfeststellung + Incident) und 5b (Assessment-Wizard + Risk Catalog + Controls + Maturity) aufgeteilt werden.

---

# 13. Aktualisierter Datenmodell-Umfang

| Bereich | Bisherige Entities | Neue Entities (v3.0) | Gesamt |
|---------|-------------------|----------------------|--------|
| Platform-Kern | 7 | +1 (work_item, work_item_type, work_item_link) | 10 |
| Assets | 2 (Asset, Vulnerability) | +2 (AssetCiaProfile) | 4 |
| ISMS-spezifisch | 0 geplant | +9 (ProtectionReq, AssessmentRun, RiskCatalogEntry, RiskScenario, Vulnerability*, Threat, AsmtRiskEval, AsmtControlEval, ManagementReview) | 9 |
| BCMS | 4 (BIA, BCP, Exercise, BIASupplierDep.) | +5 (ContinuityStrategy, Resource, EmergencyActivity, RecoveryActivity, EssentialProcess) | 9 |
| DPMS | 6 | +2 (CategoryPersonalData, DataSubjectData) | 8 |
| ERM | 5 | 0 | 5 |
| IKS | 2 | 0 | 2 |
| Audit | 3 | +1 (AuditActivity) | 4 |
| **Gesamt** | **44+10 Joins** | **+20** | **~74 Entities** |

---

# 14. Top-Gaps und Eigenentwicklungs-Bedarf (aktualisiert v3.0)

| ID | Gap | Prio | Lösungsansatz | Sprint |
|----|-----|------|---------------|--------|
| O-01 | Vertragsmanagement | MUSS | Contract + ContractObligation Entities | S9 |
| O-10 | Budget-/Kostenverfolgung | MUSS | Budget + BudgetItem Entities | S9 |
| G-NEW-03 | Work Item Type System | MUSS | work_item Basis-Entity (Sprint 1.4) | S1.4 |
| I-NEW-03 | Assessment-Wizard | MUSS | assessment_run + guided workflow | S5 |
| I-NEW-01 | Schutzbedarfsfeststellung (PRQ) | MUSS | protection_requirement WI-Typ | S5 |
| I-NEW-06 | 3-Ebenen-Risikomodell (Szenario/Schwachstelle/Bedrohung) | MUSS | RiskScenario + Threat Entities | S5 |
| I-NEW-05 | Maturity-Bewertung | MUSS | Current/Target Maturity auf ControlTest | S4 |
| E-10 | KRI-Modul | SOLLTE | KRI + TimescaleDB (bereits geplant Sprint 2) | S2 |
| I-09 | Security-Awareness-Tracking | SOLLTE | Training-Modul | S5 |
| O-02 | Whistleblowing | SOLLTE | Anonymes Meldesystem | Phase 3 |
| O-07 | Compliance Horizon-Scanning | SOLLTE | KI-basiert | Phase 3 |

---

# Appendix: Catalog & Framework Requirements (CAT-01 bis CAT-12)
**Added March 2026 — Sprint 4b**

---

## CAT — Catalog & Framework Module Requirements

| ID | Anforderung | Prio | Abdeckung | Sprint |
|----|-------------|------|-----------|--------|
| CAT-01 | Plattformweite Risikokataloge (Cambridge v2.0, WEF, BSI Elementargefährdungen, ARCTOS Base) | MUSS | ✗ Gap | Sprint 4b |
| CAT-02 | Plattformweite Kontrollkataloge (ISO 27002:2022, NIST CSF 2.0, BSI IT-GS Bausteine, CIS v8) | MUSS | ✗ Gap | Sprint 4b |
| CAT-03 | Risikobewertungsmethodik-Wahl pro Org: ISO 31000 (5×5), COSO ERM (qualitativ), FAIR (EUR), Hybrid | MUSS | ✗ Gap | Sprint 4b |
| CAT-04 | Katalogbrowser: Baumnavigation Klasse/Familie/Typ (DE+EN) mit Suchfunktion | MUSS | ✗ Gap | Sprint 4b |
| CAT-05 | Gesamter Katalog ODER einzelne Einträge beim Risiko/Control erstellen auswählbar | MUSS | ✗ Gap | Sprint 4b |
| CAT-06 | Instanziierung: Katalogeintrag → echtes Risiko mit Vorausfüllung (Titel, Beschreibung, Kategorie) | MUSS | ✗ Gap | Sprint 4b |
| CAT-07 | Herkunftsverfolgung: catalog_entry_id + catalog_source auf risk (Hook Sprint 2, FK Sprint 4b) | MUSS | ✓ Hook S2 | Sprint 2/4b |
| CAT-08 | Konzernvererbung: Holding vererbt Katalog-Aktivierungen + Pflichtrisiken an Töchter (mandatory/suggested) | MUSS | ✗ Gap | Sprint 4b |
| CAT-09 | Blacklist-Modell: Org kann einzelne Katalogeinträge ausschließen | SOLLTE | ✗ Gap | Sprint 4b |
| CAT-10 | Mehrsprachige Einträge DE + EN Pflicht in allen Katalogen | MUSS | ✗ Gap | Sprint 4b |
| CAT-11 | Custom-Kataloge: Org kann eigene Risikoklassifizierung als Katalog definieren | SOLLTE | ✗ Gap | Sprint 4b |
| CAT-12 | FAIR-Methodik: ALE in EUR, Frequency × Magnitude, Monte Carlo (Fundament in Sprint 2 simulation_result) | SOLLTE | ✓ Fundament S2 | Sprint 4b |

### CAT-03 Methodik-Detail

**ISO 31000 (Standard):** 5×5 Matrix, Score = Likelihood × Impact (1–25), Risikoappetit als Schwellenwert, Behandlung: Mitigate/Accept/Transfer/Avoid

**COSO ERM 2017 (Businessorientiert/Vorstandsorientiert):** Qualitative Priorität (Kritisch/Hoch/Mittel/Niedrig), Velocity (Wie schnell?), Resilience (Wie gut vorbereitet?), Verknüpfung mit strategischen Unternehmenszielen, kein Zahlen-Score

**FAIR (Quantitativ-finanziell):** ALE in EUR (Annualized Loss Expectancy), Frequency × Magnitude Ranges (Min/Max), Monte Carlo 10.000 Iterationen, P5/P50/P95 Konfidenzintervalle, nutzt simulation_result Hypertable aus Sprint 2

**Hybrid ISO + FAIR:** Schnellbewertung 5×5 für alle, FAIR-Vertiefung optional ab Score ≥ 15

---

## Aktualisierte Sprint-Roadmap v4.0

```
Sprint 1       → Foundation (Auth, RBAC, Audit, UI-Shell)                    ✅ Done
Sprint 1.2     → Workflow + Email + Org GDPR (org_code, Task-Entity)          ✅ Done
Sprint 1.3     → Module System (module_config, requireModule, ModuleGate)     ✅ Done
Sprint 1.4     → Extended Assets (3-Tier, CIA-Defaults) + Work Item System    ✅ Done
Sprint 2       → ERM: Risk Register + KRI Dashboard                           🔄 Läuft
               ↳ Hook: catalog_entry_id UUID (ohne FK) + catalog_source auf risk
               ↳ Hook: org.settings.risk_methodology JSONB
Sprint 3       → BPMN Prozessmodellierung (bpmn.js, Risk-Overlays, Versionen) ⬜ Geplant
Sprint 4       → ICS + DMS (Controls ToD/ToE, Findings, Documents, SoA)       ⬜ Geplant
Sprint 4b      → Catalog & Framework Module                                    ⬜ NEU
               ↳ 8 neue Tabellen: RiskCatalog, RiskCatalogEntry,
                  ControlCatalog, ControlCatalogEntry, OrgRiskMethodology,
                  OrgActiveCatalog, OrgCatalogExclusion, OrgCatalogInheritance
               ↳ Seeds: Cambridge v2.0 (175 Einträge), NIST CSF 2.0 (106),
                  BSI IT-GS (~100), ISO 27002:2022 (93), WEF (~30)
               ↳ Methodik-UI: ISO31000/COSO/FAIR je nach org.settings
               ↳ FK-Constraint auf risk.catalog_entry_id nachrüsten
Sprint 5a      → ISMS: Assets, PRQ, Incidents (nutzt BSI/ISO27005 aus Sprint 4b)
Sprint 5b      → ISMS: Assessment-Wizard, Maturity, Controls
Sprint 6       → BCMS (BIA, BCP, MTPD/RTO, Continuity Strategy)
Sprint 7       → DPMS (RoPA, DSFA, DSR, Data Breach, TIA)
Sprint 8       → Audit Management
Sprint 9       → TPRM + Contract Management
Phase 3-A      → ESG + CSRD Materialität + ESRS Metriken
Phase 3-B      → Whistleblowing
```
