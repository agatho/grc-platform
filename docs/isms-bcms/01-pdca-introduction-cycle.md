# PDCA — ISMS-Einführungs- und Implementierungszyklus

**Geltungsbereich:** Erst-Etablierung des ISMS nach ISO/IEC 27001:2022 mit Risiko-Methodik aus ISO/IEC 27005:2022, BCM-Integration nach ISO 22301:2019, regulatorischer Abdeckung nach NIS2 und DORA.
**Adressat:** CISO, ISMS-Beauftragter, BCM-Beauftragter, Geschäftsleitung, Auditoren.
**Verbindlichkeit:** Verbindliche Methodik. Abweichungen erfordern dokumentierte Risikoakzeptanz.

---

## 0. Begriffsbestimmungen

| Begriff | Bedeutung |
|---------|-----------|
| ISMS | Information Security Management System |
| BCMS | Business Continuity Management System |
| SoA | Statement of Applicability — ausformulierter Geltungsbereich der Maßnahmen aus 27001 Anhang A |
| BIA | Business Impact Analysis nach 22301 §8.2.2 |
| RTO/RPO/MBCO | Recovery Time / Recovery Point / Minimum Business Continuity Objective |
| TLPT | Threat-Led Penetration Test (DORA Art. 26) |
| RBT | Risk-Based Treatment |

---

## 1. Methodischer Rahmen

ISO 27001:2022 verlangt die Anwendung des PDCA-Zyklus über das gesamte ISMS. Anhang SL der ISO-Strukturklauseln gibt 10 Klauseln vor:

```
4. Kontext der Organisation
5. Führung
6. Planung
7. Unterstützung
8. Betrieb
9. Bewertung der Leistung
10. Verbesserung
```

PDCA-Zuordnung im **Einführungszyklus** (Erstaufbau, Dauer typischerweise 9–18 Monate):

| Phase | Klauseln | Schwerpunkt | Dauer-Ansatz |
|-------|----------|-------------|--------------|
| **PLAN** | 4, 5, 6 | Kontext, Scope, Policy, Risiko-Methodik, Risiko-Behandlung, SoA | 3–6 Monate |
| **DO** | 7, 8 | Ressourcen, Awareness, Doku, Operative Maßnahmen, BIA, BCP | 4–8 Monate |
| **CHECK** | 9 | Monitoring, Internal Audit, Management-Review | 2–3 Monate |
| **ACT** | 10 | Nichtkonformitäten, KVP, Korrektur-/Vorbeugemaßnahmen | laufend, formal vor Zertifizierung |

> **Hinweis:** In der Einführungsphase überlappen sich PDCA-Schritte deutlich stärker als im regulären Betrieb. Plan-Anpassungen während Do-Phase sind nicht nur erlaubt, sondern üblich (vgl. 27001 §6.3 — *Planung von Änderungen*).

---

## 2. PLAN — Phase 1 (Monate 1–6)

### 2.1 Kontext (Klausel 4)

#### 2.1.1 Externer Kontext (4.1)
- Markt, Branchen, Stakeholder-Erwartungen
- Regulatorische Landschaft: NIS2 (für wesentliche/wichtige Einrichtungen nach §28 NIS2-UmsuCG), DORA (für Finanzunternehmen + ICT-Drittparteien), GDPR, BSI Grundschutz (sofern verpflichtend)
- Bedrohungslandschaft: aktuelle CVE-Trends, sektorale ENISA-Berichte
- **Artefakt:** `docs/isms/01-context-external.md`

#### 2.1.2 Interner Kontext (4.1)
- Organisationsstruktur, Geschäftsstrategie, Risikoappetit
- IT-/IS-Verantwortlichkeiten, Three Lines of Defense
- **Artefakt:** `docs/isms/01-context-internal.md`

#### 2.1.3 Stakeholder & Erwartungen (4.2)
- Stakeholder-Tabelle: Kunden, Aufsicht, Aufsichtsrat, Mitarbeitende, Lieferanten
- Erwartungen pro Stakeholder
- **Artefakt:** `docs/isms/02-stakeholder-register.md`

#### 2.1.4 Anwendungsbereich (4.3) — Geltungsbereich-Definition
- Organisatorisch: welche Entitäten, Standorte, Tochtergesellschaften
- Prozessual: welche Geschäftsprozesse
- Technisch: welche Informationssysteme, Netzsegmente, Cloud-Tenants
- Schnittstellen und Abhängigkeiten zu nicht im Scope befindlichen Bereichen
- **Artefakt:** `docs/isms/03-scope-statement.md` (signiert von GF)
- **Software-Mapping:** `organization` + `organization.parent_id` für mehrstufige Konzernstruktur, `org_hierarchy` View

#### 2.1.5 ISMS-Etablierung (4.4)
- Strukturentscheidung: zentrales vs. föderales ISMS
- Schnittstellen zu anderen Managementsystemen (BCMS, QMS, EMS, AIMS nach 42001)

### 2.2 Führung (Klausel 5)

#### 2.2.1 Top-Management-Commitment (5.1)
- **Maßnahme:** Kick-off-Meeting mit Geschäftsleitung, dokumentiertes Commitment
- Bereitstellung von Ressourcen (Budget, Personal, Zeit)
- **Artefakt:** Geschäftsleitungs-Beschluss `docs/isms/04-gl-beschluss-isms.md`

#### 2.2.2 Informationssicherheits-Politik (5.2)
- Hochgradige Politik (1–2 Seiten), GL-genehmigt, an alle Mitarbeitenden kommuniziert
- Mindestinhalte: Zweck, Verbindlichkeit, Verantwortlichkeiten, Verbesserungsverpflichtung
- **Artefakt:** `docs/isms/policies/01-information-security-policy.md` v1.0

#### 2.2.3 Rollen, Verantwortlichkeiten und Befugnisse (5.3)
- Rollen-Modell: CISO, ISMS-Manager, Risikomanager, Asset-Owner, Process-Owner, Control-Owner, Auditor, DPO, BCM-Manager
- Verbindliche Zuordnung in der Software (Drei-Linien-Modell aktiv)
- **Artefakt:** RACI-Matrix `docs/isms/05-raci.md`
- **Software-Mapping:** `user_organization_role`, `process_raci`, `process_raci_override`

### 2.3 Planung (Klausel 6) — Risiko-Kern

#### 2.3.1 Maßnahmen zum Umgang mit Risiken und Chancen (6.1)
- Bezug zu 27005:2022. Methodische Festlegung VOR jeder Risikoaufnahme:
  - Risikobeurteilungsprozess (6.1.2)
  - Risikobehandlungsprozess (6.1.3)

##### 6.1.2 — Risikobeurteilungsprozess
1. **Risiko-Akzeptanz-Kriterien:** Risikomatrix, Schwellwerte, Eskalationspfade
2. **Identifikation:** Asset-basiert + Szenario-basiert (kombinierter Ansatz nach 27005 §7)
3. **Analyse:** qualitativ (Standard) oder quantitativ (FAIR/Monte Carlo bei kritischen Assets)
4. **Bewertung:** Eintrittswahrscheinlichkeit × Schadenspotential, mit Berücksichtigung bestehender Kontrollen
5. **Vergleich** mit Akzeptanzkriterien

**Artefakte:**
- Methodendokument `docs/isms/06-risk-method-27005.md`
- Risikomatrix-Konfiguration in der Software
- **Software-Mapping:** `risk`, `risk_evaluation`, `risk_evaluation_log`, `isms_risk_scenario`

##### 6.1.3 — Risikobehandlungsprozess
- Vier Optionen: **Vermeiden, Vermindern, Übertragen, Akzeptieren** (treat/transfer/avoid/retain)
- Auswahl aus Annex A (93 Controls in 27001:2022) PLUS organisatorisch ergänzende Maßnahmen
- **SoA-Erstellung** mit Begründung für jede Aufnahme/jeden Ausschluss
- **Risk-Treatment-Plan (RTP):** zeitliche, ressourcielle, verantwortliche Zuordnung
- **Restrisiko-Akzeptanz** durch Risikoeigentümer

**Artefakte:**
- SoA `docs/isms/soa.xlsx` (in der Software auch live)
- RTP `docs/isms/07-risk-treatment-plan.md`
- **Software-Mapping:** `isms_soa`, `risk_treatment_link`, `risk_acceptance`

#### 2.3.2 Informationssicherheitsziele (6.2)
- SMART-formulierte Ziele, ableitbar aus Risiko und Geschäftskontext
- Beispielziele: "Phishing-Klickrate < 5 % nach 12 Monaten", "MTTR Critical-Incident < 4 h", "100 % der A-Assets klassifiziert nach 6 Monaten"
- **Artefakt:** Ziele-Katalog `docs/isms/08-objectives.md`
- **Software-Mapping:** `kris` (Key Risk Indicators), `dashboard` (KPI-Widgets)

#### 2.3.3 Planung von Änderungen (6.3)
- Change-Management-Verfahren (auch für ISMS-Anpassungen)
- **Artefakt:** Verfahrensanweisung VA-CHG-01

### 2.4 Annex-A-Mapping (Klausel 6.1.3 d)

ISO 27001:2022 — 93 Controls in 4 Themen:
- **A.5 Organisatorische Maßnahmen** (37) — Policies, Rollen, Lieferantenmanagement, Threat Intel
- **A.6 Personenbezogene Maßnahmen** (8) — Onboarding, Awareness, NDA, Disziplinarverfahren
- **A.7 Physische Maßnahmen** (14) — Sicherheitsbereiche, Equipment, Bildschirmsperre, Clear Desk
- **A.8 Technologische Maßnahmen** (34) — Access Control, Krypto, Logging, Backup, Web-Filter, Secure Development

Pflichtmäßiges Mapping aller anwendbaren Controls in die SoA, einschließlich Begründung bei Nicht-Anwendbarkeit.

---

## 3. DO — Phase 2 (Monate 4–12, überlappend)

### 3.1 Ressourcen, Kompetenz, Bewusstsein, Kommunikation, Dokumentation (Klausel 7)

#### 7.1 Ressourcen
- Personal-Plan (FTE-Zuordnung)
- Tooling: ARCTOS-Plattform, Vulnerability-Scanner, SIEM, Backup-System

#### 7.2 Kompetenz
- Kompetenzmatrix (Erforderliche Skills pro Rolle)
- Schulungs-/Zertifikatsplan, z. B. ISO 27001 LA für Auditoren, CISSP/CISM/IRCA-Refresher

#### 7.3 Awareness
- Awareness-Programm (E-Learning + Phishing-Simulationen + Klassen-Trainings)
- **Software-Mapping:** `academy_course`, `academy_lesson`, `academy_enrollment`, `academy_certificate`

#### 7.4 Kommunikation
- Kommunikationsplan: intern (Newsletter, Townhall, Intranet) + extern (Aufsicht, Kunden, Lieferanten)

#### 7.5 Dokumentierte Information
- Dokumentenlenkung (Erstellung, Genehmigung, Versionierung, Aufbewahrung, Vernichtung)
- **Software-Mapping:** `document` mit Versions-/Approval-Workflow

### 3.2 Betriebliche Planung und Steuerung (Klausel 8)

#### 8.1 Betriebliche Steuerung
- Implementierung der Maßnahmen aus dem RTP
- Rollout in Sprints/Wellen, mit Plateau-Reviews

#### 8.2 Informationssicherheits-Risikobeurteilung
- **Erstdurchführung in Monat 4–6** (vollständig)
- Anschließend mindestens jährlich + bei wesentlichen Änderungen

#### 8.3 Informationssicherheits-Risikobehandlung
- Umsetzung der RTP-Maßnahmen
- Wirksamkeitsmessung (Effektivität ≠ Effizienz)
- Restrisiko-Annahme

### 3.3 BCMS-Etablierung — ISO 22301 (parallel zu 27001 DO-Phase)

> Empfohlen: BCMS gleichzeitig mit ISMS aufbauen, da starke Abhängigkeiten (gemeinsamer Asset-Bestand, Incident-Schnittstelle, Krisenstab).

#### 22301 §4 Kontext, §5 Führung, §6 Planung, §7 Unterstützung
- Identisch zu ISMS, aber Fokus auf **Geschäftskontinuität**
- BCMS-Politik separat, unter Verweis auf ISMS-Politik
- **Artefakt:** `docs/bcms/01-bcms-policy.md`

#### 22301 §8.2 Business Impact Analysis
1. **Prozess-Inventar** (kritische Geschäftsprozesse identifizieren)
2. **Auswirkungs-Bewertung** über Zeit (1h, 4h, 24h, 72h, 1 Woche, 4 Wochen)
3. **MTPD** (Maximum Tolerable Period of Disruption) je Prozess
4. **RTO** (Recovery Time Objective) ≤ MTPD
5. **RPO** (Recovery Point Objective) für Daten
6. **MBCO** (Minimum Business Continuity Objective) — Mindest-Service-Niveau
- **Software-Mapping:** `bcms_bia`, `bcms_bia_impact`, `bcms_bia_supplier`

#### 22301 §8.2.3 Risikobeurteilung
- Spezifisch für Geschäftskontinuitätsrisiken
- Cross-Reference zu ISMS-Risiken (gemeinsames Risikoregister wo sinnvoll)
- **Software-Mapping:** `bcms-erm-sync`-Prozess

#### 22301 §8.3 Strategie
- Resilienz-Strategien je Prozess: Redundanz, Alternativstandort, manueller Workaround, Service-Provider-Switch
- **Software-Mapping:** `bcms_resilience_strategy`

#### 22301 §8.4 Verfahren — Business Continuity Plans (BCPs)
- Pro Prozess + übergeordnete Krisenpläne
- Inhalte: Aktivierungskriterien, Eskalationspfade, Recovery-Schritte, Ressourcen, Kommunikation
- **Software-Mapping:** `bcms_plan`, `bcms_plan_procedure`, `bcms_plan_resource`, `bcms_contact_tree`

#### 22301 §8.5 Übungen und Tests
- Tabletop, Funktionsübung, simulierte Krise, Live-Failover
- Mindestens jährlich pro kritischem Plan
- **Software-Mapping:** `bcms_exercise`, `bcms_exercise_finding`, `bcms_exercise_lesson`

#### 22301 §8.6 Bewertung der Geschäftskontinuitätsdokumente
- Reviews der BCPs (mindestens jährlich, anlassbezogen)

### 3.4 NIS2-Anforderungen (Art. 21 RL 2022/2555)

NIS2 ist auf wesentliche/wichtige Einrichtungen anwendbar (siehe §28 NIS2-UmsuCG-DE, ähnliche Umsetzungsgesetze in anderen MS).

10 Mindest-Maßnahmen-Kategorien:

| # | Kategorie | Software-Modul |
|---|-----------|----------------|
| 1 | Risiko-Analyse + IS-Politiken | ISMS, Risk |
| 2 | Vorfallsbearbeitung | ISMS-Incident, NIS2-Incident-Reporting |
| 3 | Geschäftskontinuität + Krisenmanagement + Backup | BCMS |
| 4 | Lieferkettensicherheit | TPRM |
| 5 | Sicherheit beim Erwerb, Entwicklung, Wartung von IS | DevOps-Connector, Secure-Dev-Policy |
| 6 | Bewertung Wirksamkeit | Audit, Maturity |
| 7 | Cyberhygiene + Schulung | Academy |
| 8 | Kryptographie | Crypto-Policy + KMS-Integration |
| 9 | Personalsicherheit + Zugriffskontrolle + Asset-Management | Identity, ABAC, Asset |
| 10 | MFA + Sichere Kommunikation + Notfallkommunikation | Auth, BCMS Contact Tree |

NIS2 Art. 23 — Meldepflichten:
- **Frühwarnung** binnen 24 h nach Bekanntwerden
- **Vorfallsmeldung** binnen 72 h
- **Abschlussbericht** binnen 1 Monat
- **Software-Mapping:** `nis2_report`, `nis2_reporting_tracker`, automatische Fristen-Engine

### 3.5 DORA (VO (EU) 2022/2554) — für Finanzunternehmen + ihre ICT-Drittdienstleister

5 Säulen:

| Säule | Artikel | Software-Modul |
|-------|---------|----------------|
| **ICT-Risikomanagement** | Art. 5–16 | DORA `ict_risk`, ISMS-Risk |
| **ICT-Vorfallsmeldung** | Art. 17–23 | DORA `ict_incident`, gekoppelt mit Crisis |
| **Digital-Operational-Resilience-Testing** | Art. 24–27 | DORA `tlpt_plan`, BCMS Exercise |
| **ICT-Drittparteienrisiko** | Art. 28–44 | TPRM, DORA `ict_provider` |
| **Information Sharing** | Art. 45 | DORA `information_sharing` |

Schwere DORA-spezifische Pflichten:
- **Threat-Led Penetration Testing (TLPT)** alle 3 Jahre für signifikante Finanzunternehmen
- **ICT-Vorfallsmeldung** mit präzisen Fristen (4 h initial, 24 h Update, 1 Monat Final)
- **Register der Outsourcing-Verträge** mit Aufsicht teilbar

---

## 4. CHECK — Phase 3 (Monate 10–14)

### 4.1 Überwachung, Messung, Analyse, Bewertung (9.1)
- Definition: Was wird gemessen, wie, wann, durch wen, wie ausgewertet?
- KRIs/KPIs:
  - Anteil offener Hochrisiken außerhalb SLA
  - Patch-Compliance %
  - Incident-Volumen + MTTR
  - Awareness-Klickrate
  - SoA-Compliance % (umgesetzte vs. geplante Controls)
  - BIA-Frische (Anteil aktualisierter BIAs in den letzten 12 M)
- **Software-Mapping:** Posture-Module, KRI-Dashboard, BCMS-Readiness-Monitor

### 4.2 Internes Audit (9.2)
- Auditprogramm vor Erst-Zertifizierung
- **Mindestens 1 vollständiges internes Audit über den gesamten Scope** vor der externen Stage-1-Auditierung
- Auditoren-Unabhängigkeit (Audit-Funktion 3rd Line)
- **Software-Mapping:** `audit-mgmt` (Plans, Audits, Working Papers, Findings, NCs)

### 4.3 Management-Review (9.3)
- **Mindestens 1 GL-Review** vor Zertifizierung mit Pflicht-Inputs nach 9.3.2:
  - Status früherer Maßnahmen
  - Änderungen interner/externer Themen
  - Rückmeldungen Stakeholder
  - Risikolage, Risikobehandlung
  - Ergebnisse Audits
  - Zielerreichung
  - Nichtkonformitäten + Korrekturmaßnahmen
  - Verbesserungsvorschläge
- **Software-Mapping:** `isms_review` (Type=management_review)

---

## 5. ACT — Phase 4 (laufend, formal vor Zertifizierung)

### 5.1 Nichtkonformität und Korrekturmaßnahmen (10.1)
- **Software-Mapping:** `isms_nonconformity` mit Status-Maschine: open → analysed → corrected → effective → closed
- **CAPA-Prozess** (Corrective Action / Preventive Action)

### 5.2 Fortlaufende Verbesserung (10.2)
- KVP-Zyklus, Lessons Learned aus Incidents/Übungen einspeisen
- **Software-Mapping:** `bcms_exercise_lesson`, `audit_finding` → Action-Items im Workflow

---

## 6. Zertifizierungs-Roadmap (am Ende des Einführungszyklus)

### 6.1 Stage-1 Audit (Dokumenten-Prüfung, Vor-Ort-Tag)
- Voraussetzung: vollständige Dokumentationsschicht, ein internes Audit absolviert, ein Management-Review absolviert
- Zertifizierer prüft Reife und Bereitschaft

### 6.2 Stage-2 Audit (Wirksamkeits-Prüfung)
- Mehrere Tage, Stichproben in den Prozessen
- **Major NC** = Zertifizierungsblockade bis zur Beseitigung
- **Minor NC** = innerhalb 90 Tagen zu schließen

### 6.3 Zertifikatsausstellung
- 3 Jahre gültig, jährliche Überwachungsaudits

---

## 7. Erfolgskriterien des Einführungszyklus

| Kriterium | Schwelle |
|-----------|----------|
| Scope dokumentiert und freigegeben | ✓ |
| Top-Management-Commitment | dokumentiert + signiert |
| ISMS-Politik | freigegeben + kommuniziert (≥ 95 % Awareness) |
| Risiken erfasst | 100 % der A-/B-Assets im Risikoregister |
| Risikobehandlung | RTP für 100 % unakzeptierter Risiken |
| SoA | vollständig, mit Begründung pro Control |
| Awareness | ≥ 90 % Mitarbeitende durch Pflichttraining |
| Internes Audit | 1× vollständig, NCs in Bearbeitung |
| Management-Review | 1× durchgeführt, dokumentiert |
| BCM | BIA + BCP für 100 % kritischer Prozesse, 1× Übung pro Plan |
| NIS2 | 10 Maßnahmen-Kategorien implementiert, Reporting-Engine produktiv |
| DORA (falls relevant) | 5 Säulen abgedeckt, ICT-Provider-Register vollständig |

---

## 8. Risiken im Einführungszyklus (typische Stolpersteine)

| Risiko | Gegenmaßnahme |
|--------|---------------|
| Scope-Creep | striktes Change-Board, GL-Eskalation |
| Top-Management-Disengagement | wöchentliche Kurz-Status, Kennzahlen, klare Eskalationsmatrix |
| Tooling-Verzögerung | „Documentation-First, Tooling-Later" akzeptieren — Excel-fallback |
| Awareness-Müdigkeit | Microlearning, Gamification, Phishing-Sims mit Sofort-Feedback |
| BIA-Datenqualität | strukturierte Interviews, vorbefüllte Templates, RACI-Verbindlichkeit |
| NIS2-Meldefristen verpasst | automatische Timer in der Plattform, eskalierende Erinnerungen, 24/7 SOC |

---

## 9. Übergang in den regulären Betriebszyklus

Nach erfolgreicher Stage-2-Auditierung (oder spätestens nach 12 Monaten Betrieb) übergeht das ISMS in den regulären Zyklus, dokumentiert in [02-pdca-regular-cycle.md](./02-pdca-regular-cycle.md).
