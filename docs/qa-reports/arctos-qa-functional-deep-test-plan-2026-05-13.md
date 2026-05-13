# ARCTOS Funktionaler Tiefen-Test — Wave 14 QA-Plan

**Tester:** Cowork QA, autonomer Über-Nacht-Lauf
**Auftrag:** Vollständiger Funktionstest mit User Stories, Workflows, Cross-Module-Datenaustausch, Aggregation-Verifikation. Keine Pause, keine Unterbrechung durch Fehler.

---

## Test-Methodik

1. **User Stories pro Rolle** definieren → was erwartet die Rolle?
2. **Workflows definieren** mit Pre-/Post-Conditions
3. **Baseline-Inventar** erfassen (Initial-Counts, Initial-Aggregations)
4. **Workflow ausführen** mit echten Mutationen
5. **Aggregation-Effekt prüfen** (vorher vs. nachher)
6. **Cross-Module-Propagation** verifizieren
7. **Hash-Chain-Health-Check** nach jedem Workflow-Block

---

## 9 User Stories pro Rolle

### US-01: CISO (`ciso@meridian.test`) — 2nd Line of Defense
> *"Als CISO will ich Cyber-Risiken im Risk-Register überwachen, Controls auf Wirksamkeit prüfen und BIA/ISMS-Status für die Geschäftsleitung berichten — ohne selbst operative Risiken anzulegen (das machen Risk-Manager / Process-Owner)."*

**Erwartet:**
- ✅ Read aller ERM/ISMS/BCMS-Module
- ✅ Audit/Status-Change auf Risks (transition zwischen Workflow-States)
- ❌ Risk-Create (nur 1st-Line, siehe Wave 13)
- ✅ Reports generieren
- ❌ ESG/DPMS-Write

### US-02: DPO (`dpo@meridian.test`) — 2nd Line, Datenschutz
> *"Als DPO will ich Verarbeitungstätigkeiten (ROPA), DSFAs und DSR-Anträge verwalten, Datenpannen klassifizieren und DSGVO-Compliance-Reports erstellen."*

**Erwartet:**
- ✅ DPIA/ROPA/DSR-Vollzugriff
- ✅ DSGVO-Annual-Report-PDF generieren
- ✅ Read auf ERM/ISMS für Cross-Module-Sicht
- ❌ Risk-Write, BCMS-Write

### US-03: Compliance Officer (`compliance@meridian.test`)
> *"Als CO will ich Framework-Mappings pflegen, Compliance-Score über alle Module aggregieren und Audit-Berichte für Externe vorbereiten."*

**Erwartet:**
- ✅ Read überall
- ✅ Write auf Audit-Findings, Controls
- ✅ Reports generieren cross-module
- ❌ HinSchG-Cases

### US-04: Auditor (`auditor@meridian.test`) — 3rd Line, intern
> *"Als interner Auditor will ich Audits planen, Findings dokumentieren, Closure-Readiness prüfen und unabhängig von 1st/2nd-Line berichten."*

**Erwartet:**
- ✅ Audit-Mgmt-Vollzugriff
- ✅ Findings-Write
- ✅ Read aller anderen Module für Audit-Scope
- ❌ Risk-Write (Konflikt mit Unabhängigkeit)

### US-05: Process Owner (`process-owner@meridian.test`) — 1st Line
> *"Als Process-Owner will ich meine Geschäftsprozesse dokumentieren, BIA-Bewertungen liefern, KRIs überwachen und operationelle Risiken für meinen Bereich erfassen."*

**Erwartet:**
- ✅ Process-Create/Update
- ✅ Risk-Create (1st-Line)
- ✅ BIA-Input
- ❌ Cross-Org-Read

### US-06: Vendor Manager (`vendor-mgr@meridian.test`) — 1st Line
> *"Als Vendor-Manager will ich Lieferanten erfassen, Due Diligence durchführen, Verträge verknüpfen und LkSG-/DORA-Anforderungen tracken."*

**Erwartet:**
- ✅ Vendor-CRUD
- ✅ Contract-Verknüpfung
- ✅ TPRM-Reports
- ❌ Audit-Write

### US-07: ESG Manager (`esg@meridian.test`)
> *"Als ESG-Manager will ich Materiality-Analysen führen, ESRS-Datenpunkte erfassen und CSRD-Annual-Report generieren."*

**Erwartet:**
- ✅ ESG-Vollzugriff
- ✅ ESG-Report-Export
- ✅ Read auf TPRM (Lieferketten-ESG)
- ❌ Risk-Write außerhalb ESG-Bereich

### US-08: Whistleblowing Officer (`whistleblowing@meridian.test`)
> *"Als Ombudsperson will ich HinSchG-Fälle vertraulich entgegennehmen, triagieren, untersuchen und schließen — ohne Einsicht in andere Compliance-Module."*

**Erwartet:**
- ✅ Whistleblowing-Cases-Vollzugriff
- ❌ Alles andere blockiert (HinSchG §§16, 32)

### US-09: Viewer (`viewer@meridian.test`)
> *"Als Viewer will ich Reports und Dashboards einsehen ohne irgendwelche Mutationen ausführen zu können — typisch für Geschäftsführung oder Board-Mitglied."*

**Erwartet:**
- ✅ Read überall (außer Whistleblowing)
- ❌ Write überall

---

## 10 End-to-End Workflows

### W1 — Risk-Lifecycle (kompletter Durchlauf)

1. **Create:** POST /api/v1/risks `{title, riskCategory, riskSource, likelihood, impact, ownerId}` als Process-Owner
2. **Transition:** identified → assessed (PUT /status, Pre-Cond: Assessment durchgeführt)
3. **Treatment-Create:** POST /risks/{id}/treatments `{strategy: 'mitigate', status: 'planned', costEstimate: 5000, targetDate}`
4. **Transition:** assessed → treated (Pre-Cond: ≥1 active treatment)
5. **Treatment-Status:** treatment → in_progress → completed
6. **Transition:** treated → closed (Pre-Cond: alle Treatments completed)
7. **Verify Aggregation:** Risk-Heatmap +1 in "closed"-Kategorie, Treatment-Budget aggregation += 5000

### W2 — Audit-Lifecycle

1. **Create:** POST /audit-mgmt/audits als Auditor
2. **Scope-Define:** Universe-Items zuordnen
3. **Status:** planned → fieldwork (PUT /status)
4. **Activities:** POST /audits/{id}/activities (mehrere Aktivitäten)
5. **Findings:** POST /findings mit `auditId, severity, controlId, recommendation`
6. **Status:** fieldwork → reporting
7. **Closure-Readiness Check:** GET /closure-readiness → muss conclusion + alle findings remediated zeigen
8. **Status:** reporting → completed
9. **Verify Aggregation:** /audit-universe/coverage steigt, /controls/effectiveness reagiert auf Findings

### W3 — DPIA-Lifecycle (Art. 35 DSGVO)

1. **Create:** POST /dpms/dpia als DPO mit `processingDescription` ≥50 chars
2. **Transition:** draft → in_progress
3. **Risiken:** POST /dpia/{id}/risks für jedes identifizierte Risiko
4. **Maßnahmen:** POST /dpia/{id}/measures
5. **Transition:** in_progress → completed (Pre-Cond: alle Gates)
6. **DPO-Konsultation:** falls erforderlich
7. **Approval-Workflow** falls vorhanden
8. **Verify:** Annual-Report-PDF enthält die DPIA

### W4 — DSR-Lifecycle (Art. 15-21 DSGVO)

1. **Create:** POST /dpms/dsr als DPO mit `requestType, subjectName, frist=30 Tage`
2. **Verify:** received → verified (POST /verify)
3. **Process:** verified → processing
4. **Respond:** processing → response_sent (POST /respond)
5. **Close:** response_sent → closed (POST /close)
6. **Frist-Tracking:** Überfällige DSR werden im DPMS-Dashboard angezeigt
7. **Hash-Chain-Check:** alle State-Transitions als v2 entries

### W5 — Incident-Lifecycle (Art. 33 DSGVO, NIST-7-State)

1. **Detect:** POST /isms/incidents als Security-Analyst
2. **Triage:** detected → triaged (Severity-Bewertung)
3. **Contain:** triaged → contained
4. **Eradicate:** contained → eradicated
5. **Recover:** eradicated → recovered
6. **Lessons:** recovered → lessons_learned (Post-Mortem-Dokument)
7. **Close:** lessons_learned → closed
8. **72h-Frist:** Wenn personenbezogen → Notify-Authority innerhalb 72h trigger
9. **Verify:** Cross-Module: realisierter Incident sollte Risk-Register updaten

### W6 — BIA-Lifecycle (mit B1/B2-Gates)

1. **Create:** POST /bcms/bia als BCM-Manager
2. **Setup B1:** Lead-Assessor zuweisen, periodStart/End setzen
3. **Coverage B2:** Process-Impacts erfassen mit MTPD/RTO/RPO (≥80% Coverage)
4. **Mark Essentials:** ≥3 Prozesse als essential markieren
5. **Transition:** draft → in_progress (Gates B1+B2 müssen passen)
6. **Finalize:** in_progress → approved
7. **Verify Cross-Module:** Process-Impacts beeinflussen ISMS-Schutzbedarf? Tests prüfen.

### W7 — Whistleblowing-Case (HinSchG)

1. **Intake:** POST /whistleblowing/intake/submit (anonymous, orgCode benötigt)
2. **Acknowledge:** Empfangsbestätigung innerhalb 7 Tagen
3. **Triage:** Case-Type, Severity zuordnen
4. **Investigation:** Untersuchung dokumentieren
5. **Resolution:** Maßnahmen definieren
6. **Close:** Final-Report, Reporter-Rückmeldung innerhalb 3 Monaten (HinSchG-Frist)
7. **Verify:** Nur Whistleblowing-Officer sieht den Case-Inhalt, alle anderen 403

### W8 — Vendor-Onboarding (TPRM + LkSG + DORA)

1. **Lead:** POST /vendors als Vendor-Manager
2. **Due Diligence:** POST /vendors/{id}/due-diligence
3. **Tier-Classification:** kritisch / wichtig / standard / niedrig
4. **LkSG-Assessment:** falls relevant
5. **Contract-Verknüpfung:** Contract erstellen + Vendor-Link
6. **Status:** prospect → active
7. **Cross-Module-Check:** Vendor mit `criticality: critical` sollte in `/dora/critical-vendors` erscheinen

### W9 — Contract-Lifecycle

1. **Create:** POST /contracts als Contract-Manager
2. **Verknüpfung:** Vendor, Verträge, SLAs zuordnen
3. **Active-Status:** Status, Aufbewahrungsfrist, Drittlandtransfer
4. **Obligations:** SLAs definieren, Tracking-Fristen
5. **Renewal/Termination:** State-Transition testen
6. **Verify:** Contract-Portfolio-Jahreswert aggregiert korrekt

### W10 — Programme-Journey (ISO 27001 Roadmap)

1. **Template-Select:** ISO 27001 Template wählen
2. **Phases-Initialize:** GET /journeys/{id} → phases + steps
3. **Gate-Execution:** für jede Phase die Gates passieren
4. **Progress-Aggregation:** /programmes/journeys Progress-Wert
5. **Verify:** progressPercent = passierte Gates / total Gates

---

## Cross-Module-Verkettungs-Matrix

| Source | → | Target | Erwartete Wirkung |
|---|---|---|---|
| BIA-Process-Impact (high) | → | ISMS-Schutzbedarf | Asset-Schutzbedarf steigt |
| Audit-Finding (critical) | → | Risk-Register | Auto-Risk-Create oder Score-Update |
| Risk + Asset-Verknüpfung | → | Asset-Risk-Score | Aggregation auf Asset-Level |
| Vendor (critical) | → | DORA-Critical-Vendor-List | Sync |
| Vendor (LkSG-relevant) | → | TPRM-LkSG-Dashboard | Sync |
| DSR (Special Category) | → | DPIA-Trigger-Check | Empfehlung DPIA |
| Incident (personenbezogen) | → | DSGVO-Art-33-Meldung | 72h-Timer + Behörden-Notify |
| Treatment-Costs | → | Budget-Aggregation pro Org | Sum |
| Control-Test-Result | → | Control-Effectiveness % | Aggregation |
| Control-Effectiveness | → | Compliance-Score | Aggregation |
| Programme-Gate-Passed | → | Programme-Progress % | Sum/Total |

---

## Aggregation-Endpoints zu verifizieren

| Endpoint | Erwartete Aggregation |
|---|---|
| `/controls/effectiveness` | controlsTotal, testsRun, effective/partial/ineffective, % |
| `/audit-mgmt/universe/coverage` | total, withLastAudit, neverAudited, overdue, dueSoon, % |
| `/risks/heatmap` | Risk-Score-Matrix |
| `/risks/aggregate` | Summen pro Kategorie/Owner |
| `/dpms/dashboard` | RoPA-Count, DSR-Open, DPIA-In-Progress |
| `/bcms/dashboard` | BIA-Vollständigkeit, BCP-Coverage, Crisis-Count, RTO |
| `/tprm/concentration` | Vendor-Tier-Verteilung, LkSG-relevant |
| `/dora/dashboard` | IKT-Risiken, Vorfälle, Critical-Vendors |
| `/ai-act/dashboard` | KI-Systeme, Hochrisiko, FRIA |
| `/esg/dashboard` | Metriken, Targets, Datenqualität |
| `/tax-cms/dashboard` | CMS-Elemente, Reifegrad, Steuerrisiken |
| `/programmes/journeys` | Progress %, allowed-transitions |

---

## Test-Daten-Generierung

Für jeden Workflow generiere ich konkrete Testdaten mit erkennbarem Marker `Wave14-QA-` in Title/Description, damit sie später eindeutig als Test-Artefakte identifizierbar sind.

---

## Erwartetes Ergebnis

Vollständiger Funktional-Report mit:
- 9 User-Stories durchgespielt
- 10 Workflows end-to-end
- 11 Cross-Module-Verkettungen geprüft
- 12 Aggregations-Endpoints verifiziert
- Hash-Chain durchgehend healthy
- Findings pro Severity priorisiert für Claude Code

---

*Test-Plan finalisiert. Ausführung beginnt.*
