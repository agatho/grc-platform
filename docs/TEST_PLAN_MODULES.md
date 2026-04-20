# Test Plans — Core Modules

Strukturierte, mit Dir durchzusprechende Testpläne für die 15 Kernmodule. Jeder Plan hat denselben Aufbau:

1. **Scope** — was gehört zum Modul, was nicht
2. **Happy Path** — der Kern-Workflow, der jede Nacht grün sein muss
3. **Edge Cases** — regulatorisch und logisch relevant
4. **Cross-Module** — Interaktionen, die gern brechen, wenn ein einzelner Contributor nur sein Modul sieht
5. **Negative / Security** — was _nicht_ erlaubt sein darf
6. **Test Artefakte** — welche konkreten Tests (unit / integration / e2e) existieren oder fehlen

Die Pläne sind als Review-Grundlage für den nächsten Tag gedacht. Sie ersetzen keine CI-Suite — sie sind ein gemeinsamer Taktplan, an dem wir messen können, wo Tests reichen und wo Lücken sind.

---

## 1. ERM — Enterprise Risk Management

### Scope

Risikoregister, KRIs, Risk Appetite, FAIR, RCSA, Predictive Risk, Heatmap, Budget-Kopplung. Framework-Kataloge: Cambridge Taxonomy v2, WEF Global Risks, BSI Elementargefährdungen, MITRE ATT&CK.

### Happy Path

- Risiko anlegen (form + API) → inherent-Score aus Methodik → Kontrollen zuordnen → Residual-Score → Treatment wählen → Maßnahme mit Budget → KRI anlegen → Dashboard zeigt Risiko + KRI.

### Edge Cases

- Risiko ohne Methodik: API 400 mit Hinweis auf Methodik-Setup.
- FAIR-Berechnung bei `minLoss == maxLoss == 0`: kein NaN, sondern ALE=0.
- KRI mit `threshold_green > threshold_red`: API 422.
- Appetit-Statement mit Toleranzband: Violation triggert Notification + Audit-Log-Eintrag.
- Risk-Asset-Kopplung, wenn Asset gelöscht ist: Soft-Delete, Risiko zeigt "Asset archiviert".

### Cross-Module

- ISMS-Risiken landen im ERM-Register via `grc-risk-sync`: Duplikat-Check auf `source_entity_id`.
- Budget-Aggregation in Budget-Modul: `v_budget_usage`-View muss ERM-Treatments enthalten.
- FAIR-Szenario verweist auf Control: Control-Wirksamkeit beeinflusst Frequency.

### Negative / Security

- `auditor` kann keine Risiken schreiben (nur lesen).
- `process_owner` aus Org A kann Risiken aus Org B nicht sehen (RLS-Test).
- Mass-Update von 200 Risiken: API 422 (Bulk-Cap 100).

### Test-Artefakte

- **Vorhanden:** API-Route-Tests für CRUD. Seed demo mit ~40 Risiken.
- **Fehlen:** E2E für FAIR-Quantifizierung. Integration-Test für Appetit-Violation → Notification. RLS-Test mit zwei Orgs.

---

## 2. ISMS — Information Security Management

### Scope

ISO 27001:2022 + Annex A (93 Kontrollen), ISO 27005 Bedrohungen/Schwachstellen, Schutzbedarf, SoA, CAP, Reviews, Posture, Zertifikate, NIS2, DORA, EU AI Act (14 Seiten).

### Happy Path

- Asset anlegen → Schutzbedarf auf C/I/A/V (BIA-gekoppelt) → Bedrohung aus Katalog → Schwachstelle → IS-Risiko (ISO-27005-Formel) → Kontrolle aus SoA → Nachweis → Management-Review.

### Edge Cases

- SoA: Kontrolle auf "ausgeschlossen" ohne Begründung → API 422.
- Bedrohung mit `likelihood=0`: Risk-Score = 0, aber Eintrag bleibt im Register (nicht automatisch archivieren).
- CAP-Frist überschritten: Notification an Process-Owner + CISO + Eintrag in CAP-Monitor.
- AI-Act: Hochrisiko-KI ohne Konformitätsbewertung → Block beim Inverkehrbringen.
- Reifegrad-Assessment ohne Belege: Warnung, nicht Block.

### Cross-Module

- Incident aus ISMS → DPMS (wenn personenbezogen betroffen) → 72-h-GDPR-Uhr startet.
- NIS2 + DORA: ein Incident kann beide Meldepflichten auslösen → getrennte Timer mit gemeinsamer Wurzel.
- Framework-Coverage: SoA-Abdeckung muss Cross-Framework-Mappings berücksichtigen (ISO 27002 ↔ NIST CSF).

### Negative / Security

- Nicht-Admin kann SoA nicht ändern.
- Hash-Chain-Test: Mutation eines audit_log-Eintrags bricht die Kette.
- AI Act "Prohibited": kein Versuch, ein verbotenes System als "produktiv" zu markieren (API-Block).

### Test-Artefakte

- **Vorhanden:** Seed mit 93 Annex-A-Kontrollen + 31 ISO-27005-Bedrohungen + 23 Schwachstellen.
- **Fehlen:** E2E-Smoke für den Full-Loop Asset→Schutzbedarf→Risiko→SoA→Review. Last-Test für SoA-Rendering bei 93 Kontrollen × 20 Pflichtspalten.

---

## 3. ICS — Internal Controls

### Scope

Kontrollbibliothek (97 ISO-27002 + 131 NIST CSF + 35 CIS), Test-Kampagnen, Findings, Evidence, RCM, Heatmap.

### Happy Path

- Kontrolle anlegen (frequency, owner, evidence_required) → Test-Kampagne erstellen (Stichprobenplan) → Test durchführen → Finding bei Fail → Remediation-Task → Evidence anhängen → Rezertifizierung.

### Edge Cases

- Kontrolle mit `frequency=weekly`, aber letzter Test > 30 Tage: Campaign-Monitor markiert overdue.
- Finding ohne Owner: API blockiert Creation.
- Evidence-Datei > 100 MB: Chunked Upload + S3.
- Kontrollvererbung bei Akquisition: parent-Org → child-Org Inheritance-Flag.

### Cross-Module

- Finding-Entity ist shared mit Audit: Ein Finding aus ICS-Test darf nicht zweimal in Audit erscheinen.
- Control testet Risiko: Kontroll-Wirksamkeit beeinflusst Risk-Residual-Score.
- RCM: Gap-Analyse zeigt Risiken ohne Kontrollen.

### Negative / Security

- Evidence mit aktiven Makros (.docm, .xlsm) → Virus-Scan + Upload-Block.
- Auditor kann Evidence _einsehen_, aber nicht _ändern_.

### Test-Artefakte

- **Vorhanden:** Control CRUD, Campaign-Start, Test-Execution.
- **Fehlen:** Evidence-Malware-Scanner-Integration-Test. RCM-Gap-Analyse-Snapshot-Test.

---

## 4. DPMS — Data Protection Management

### Scope

RoPA (Art. 30), DPIA, DSR, Data Breach (72-h-Uhr), TIA, Consent, Retention, Processor Agreements (Art. 28).

### Happy Path

- RoPA-Eintrag für Verarbeitungstätigkeit → Legal Basis → bei Bedarf DPIA → TIA bei Drittlandübermittlung → Consent-Record für Betroffene → Retention-Rule → Löschung nach Frist.

### Edge Cases

- Data Breach mit `discoveredAt` in der Vergangenheit: Uhr startet ab `discoveredAt`, nicht `createdAt`.
- 72-h-Frist an Feiertag fällig: nicht verschieben (GDPR Art. 33 kennt keine Werktage).
- DSR "Recht auf Vergessen" bei gesetzlicher Aufbewahrungspflicht: Block mit Begründung aus Retention-Rule.
- TIA für USA post-DPF: "Adequacy Decision" aktiv → no-transfer-risk.
- Consent withdrawn: Alle darauf basierenden Verarbeitungen flagged innerhalb 24 h.

### Cross-Module

- Data Breach triggert ggf. NIS2-Meldung (ISMS-Incident).
- RoPA-Eintrag verweist auf Prozess (BPM) und Vendor (TPRM).
- Retention-Rule steuert Soft-Delete in _allen_ Modulen mit personenbezogenen Daten.

### Negative / Security

- Nur DPO kann DPIA "approved" setzen.
- DSR darf NICHT von Nicht-DPO eingesehen werden (sensitive Personaldaten).
- TIA-Report-Export: Watermarking mit User-ID (Leak-Protection).

### Test-Artefakte

- **Vorhanden:** RoPA-API, Breach-Timer, DSR-CRUD.
- **Fehlen:** Retention-Rule-Execution-Worker-Test (automatische Soft-Deletes).

---

## 5. BCMS — Business Continuity

### Scope

BIA, BCP, Crisis-Scenarios (DORA 4-h/72-h/1-m-Timer), Strategien, Exercises, Readiness-Monitor.

### Happy Path

- Prozesse identifizieren (BPM) → BIA (RTO/RPO/MTPD/MBCO) → BCP pro kritischem Prozess → Strategie (Failover/Redundanz) → Jährliche Übung → Readiness-Score.

### Edge Cases

- BIA mit `rto > mtpd`: API 422.
- Crisis-Scenario ohne Owner: Block.
- DORA-Timer: Early-Warning +4h, Intermediate +72h, Final +1m — inklusive Zeitzonen-Korrektur (UTC) und Feiertags-Ignoranz.
- BCP ohne last_tested_date > 1 Jahr: im Readiness-Monitor markiert "nicht getestet".
- Exercise "Failed": erstellt automatisch Finding.

### Cross-Module

- Crisis "activated" triggert Notification-Kette zu Stakeholdern (Processor-Agreements betroffen?).
- BIA-Ergebnis fließt in ISMS Schutzbedarf (C/I/A/V).

### Negative / Security

- Nur admin/risk_manager kann Crisis aktivieren (break-glass mit MFA).
- Exercise-Log ist append-only (Hash-Chain-Test).

### Test-Artefakte

- **Vorhanden:** BIA-, BCP-, Crisis-CRUD, DORA-Timer-Tests.
- **Fehlen:** Timezone-Edge-Case-Test (Crisis in Sommerzeit-Wechsel).

---

## 6. Audit — Audit Management

### Scope

Audit-Universe, Jahresplan, Audit-Durchführung (Checkliste, Sampling, Evidence), QA-Review, shared Finding mit ICS.

### Happy Path

- Universe-Einträge → Risiko-Score → Jahresplan (CAE-Genehmigung) → Audit durchführen → Findings → Report → QA-Review → Archivierung.

### Edge Cases

- Plan-Verschiebung ohne CAE-Genehmigung: API blockiert.
- Stichprobe <MinStichprobe nach IIA: Warnung.
- Audit läuft, Prüfeinheit wird umstrukturiert: Audit erbt neuen `auditee_id`, behält `original_auditee_id`.
- QA-Review-Dissens: Finding bleibt offen, Zweitmeinung pflicht.

### Cross-Module

- Finding-Shared-Table: Dedup über Hash(auditee+control+date).
- Evidence aus ICS kann als Prüfungsnachweis direkt übernommen werden.

### Negative / Security

- Auditor kann Findings aus _seiner_ Prüfung ändern, nicht aus fremden Prüfungen.
- Archivierter Audit: read-only, auch für CAE.

### Test-Artefakte

- **Vorhanden:** Universe, Plan, Execution-CRUD.
- **Fehlen:** Sampling-Math-Test gegen IIA-Standard.

---

## 7. TPRM — Third-Party Risk

### Scope

Vendor-Register, Due-Diligence-Sessions, LkSG, Scorecards, Concentration, Sub-Processors, Exit-Plans.

### Happy Path

- Vendor onboarden → Kritikalität → DD-Session (Fragebogen → Antworten → Score) → Scorecard → Contract → periodisches Re-Assessment.

### Edge Cases

- Vendor mit Concentration >25% → Warnung, >50% → Block ohne Mitigation.
- LkSG Level-1 (direkter Lieferant) vs Level-2 (indirekt): unterschiedliche Pflichten.
- Sub-Processor-Kette >3 Tiefe: Transparenz-Report.
- Exit-Plan ohne Datentrennung-Klausel: DORA-Non-Compliance-Flag.

### Cross-Module

- Vendor ist auch Processor (DPMS Art. 28-Vertrag).
- Konzentrationsrisiko → ERM-Eintrag automatisch.

### Negative / Security

- DD-Questionnaire-Antworten sind vendor-spezifisch verschlüsselt (Leak-Schutz).

### Test-Artefakte

- **Vorhanden:** Vendor-CRUD, LkSG-Assessment.
- **Fehlen:** Concentration-Math-Test mit >1000 Vendoren.

---

## 8. Contract — Contract Management

### Scope

Vertrags-Lifecycle, SLA, Obligations, Amendments.

### Happy Path

- Vertrag anlegen → Laufzeit → SLA-Klauseln → Obligations-Kalender → Renewal-Alerts.

### Edge Cases

- Vertrag ohne Laufzeitende: wird nach 5 Jahren zur manuellen Review gezwungen.
- SLA-Breach-Detection: Scorecard-Abhängigkeit.
- Amendment ohne Revisions-ID: Block.

### Cross-Module

- SLA-Breach → TPRM-Scorecard-Reduzierung.
- AVV (Art. 28) → DPMS Processor-Agreement-Link.

### Test-Artefakte

- **Fehlen:** Renewal-Alert-Worker-Test.

---

## 9. BPM — Business Process Management

### Scope

BPMN-2.0-Modelle, Versionierung, Governance, Mining, KPIs, Maturity.

### Happy Path

- Prozess Level 1 → BPMN-Modell → Version 1 Draft → Review → Approved → Veröffentlichung.

### Edge Cases

- BPMN-Model mit "dangling" Gateways: bpmnlint-Validierung.
- Prozess ohne Owner: API 422.
- Neue Version ändert Steps, die an Kontrollen gekoppelt sind: Kontrollen-Re-Mapping-Wizard.

### Cross-Module

- Prozess-Control-Matrix (RCM) mit ICS.
- BIA (BCMS) bewertet Prozesskritikalität.

### Test-Artefakte

- **Fehlen:** bpmnlint-Regelset-Review.

---

## 10. DMS — Document Management

### Scope

Dokument-Versionen, Approvals, Verteiler, Lese-Quittung, Compliance-Flag.

### Happy Path

- Policy hochladen → Approval-Workflow → Veröffentlichung → verpflichtende Lesequittung → Compliance-Dashboard.

### Edge Cases

- Version v2 verwirft v1: v1 bleibt als historische Version lesbar, aber nicht druckbar.
- Lese-Quittung ausstehend > 30 Tage: Notification + Management-Eskalation.

### Cross-Module

- Policy ist Evidence für Control (ICS).

### Test-Artefakte

- **Fehlen:** Virus-Scan auf Upload.

---

## 11. EAM — Enterprise Architecture Management

### Scope

Capabilities, Applications, Data Flows, Tech Radar, EA Governance, Diagrams.

### Happy Path

- Capability-Map → Applications zuordnen → Data-Flows → Tech-Radar Adopt/Trial/Assess/Hold → Governance-Queue.

### Edge Cases

- Applikation mit `retire_date` in Vergangenheit aber noch "in-use": Notification.
- Zyklische Abhängigkeit in Data-Flow-Graph: Warnung.

### Cross-Module

- Applikation = Asset (ISMS).
- Tech-Radar "Hold" triggert Migration-Backlog.

### Test-Artefakte

- **Fehlen:** Graph-Cycle-Detection-Test.

---

## 12. ESG — Sustainability

### Scope

Doppelte Wesentlichkeit, ESRS-Datenpunkte (E1-E5, S1-S4, G1), Metriken, Emissionen, Ziele, Report, Tax-CMS.

### Happy Path

- Materialität-Workshop → pflichtige + freiwillige Datenpunkte → Metriken erfassen → Emissionsbilanz (Scope 1/2/3) → Ziele → CSRD-Report.

### Edge Cases

- Datenpunkt als "nicht materiell" markieren ohne Begründung: Block.
- Emissionsfaktor-Quelle veraltet (>2 Jahre): Warnung mit Aktualisierungs-Hinweis.

### Cross-Module

- Tax-CMS-Findings → CSRD-G1-Disclosure.

### Test-Artefakte

- **Fehlen:** GHG-Protocol-Calculation-Snapshot-Test.

---

## 13. Whistleblowing

### Scope

Cases, Statistics. **Isoliert, role-locked zu `whistleblowing_officer` / `ombudsperson`.**

### Happy Path

- Case-Eingang (anonym möglich) → Triage → Ermittlung → Abschluss → anonymisierte Statistik.

### Edge Cases

- Admin (normal) sieht Modul nicht einmal in der Navigation (nav-role-filter).
- Daten-Export nur in aggregierter Form (keine Einzelfall-Exporte).
- Frist nach HinSchG §17: 3 Monate Feedback, 90 Tage für Report.

### Negative / Security

- Whistleblowing-DB-Tabellen haben eigene RLS-Policies mit zusätzlichem Rollen-Check.
- Keine Verlinkung zu anderen Modulen (auch nicht Audit).

### Test-Artefakte

- **Vorhanden:** Role-Lock-Test.
- **Fehlen:** Anonymisierungs-Test auf Statistik-Export.

---

## 14. Reporting

### Scope

Report-Templates, PDF/Excel/CSV-Export, geplante Auslieferung.

### Happy Path

- Template → Query → Filter → Preview → Schedule → Worker-Run → E-Mail/S3.

### Edge Cases

- Report mit >10 MB Output: Chunked Delivery.
- Scheduled Report, Empfänger deaktiviert: Skip + Log.

### Test-Artefakte

- **Fehlen:** Template-Renderer-Golden-File-Tests.

---

## 15. Academy

### Scope

Trainings, Onboarding, Zertifikate, Awareness-Quizzes.

### Happy Path

- Kurs anlegen → Rollenbindung → Nutzer erhält Task → Kurs absolviert → Zertifikat → Audit-Log.

### Edge Cases

- Verpflichtender Kurs überfällig: Notification + Eskalation.
- Kurs-Revision zwingt Re-Zertifizierung.

### Cross-Module

- NIS2 Art. 20 Training-Pflicht → Academy-Modul-Aktivierung pflicht bei NIS2-Scope.

### Test-Artefakte

- **Fehlen:** Re-Zertifizierungs-Worker-Test.

---

## Autonomous-Run-Befunde (Overnight 2026-04-20)

**Gefunden und gefixt**:

- `academy_course`/`academy_lesson`/`academy_enrollment`/`academy_quiz_attempt`/`academy_certificate`:
  Tabellen fehlten in DB (Migrationen waren nur in `packages/db/src/migrations/`, nicht
  in `packages/db/drizzle/`). Lag an zwei parallelen Migrationsordnern — `src/migrations/`
  wird vom `migrate-all.ts`-Runner nicht gelesen. Migrationen 1053-1057 wurden nach
  `drizzle/0108-0112` kopiert, damit ein frisches Setup die Tabellen sofort hat.
  API-Route `/api/v1/academy/courses` vorher 500, jetzt 200.
- LM Studio Provider hinzugefügt (`packages/ai/src/providers/lmstudio.ts`) inkl. Router-Test.

**Gefunden, Review empfohlen (nicht automatisch gefixt)**:

- **Audit-Log Hash-Chain Integrität**: `/api/v1/audit-log/integrity` meldet `healthy: false`
  mit 4756/5008 `chainMismatchCount`, aber `rowMismatchCount: 0`. Die Row-Hashes sind alle
  valide — der Bruch ist in den `previous_hash`-Verknüpfungen. Ursache: wahrscheinlich
  Race-Condition bei parallelen Inserts in Demo-Seed (audit_trigger() verwendet
  `now()::text` als Seed, das bei gleichzeitigen Transaktionen kollidiert). **Das ist ein
  Architektur-Thema nicht ein Overnight-Fix** — siehe ADR-011, braucht vermutlich einen
  advisory_xact_lock() oder einen dedizierten Audit-Writer-Worker.
- **Zwei parallele Migrationsordner**: `packages/db/drizzle/` (0001-0112) und
  `packages/db/src/migrations/` (100-1057). Überlappend? Redundant? Der `migrate-all.ts`-
  Runner liest nur `drizzle/`. Ein frisches Setup mit `npm run db:migrate-all` erzeugt
  deshalb systematisch fehlende Tabellen. **Empfohlen**: einen der beiden Ordner als
  source-of-truth deklarieren (vermutlich `drizzle/`), die 59 fehlenden Migrationen
  nach `drizzle/` migrieren und `src/migrations/` archivieren.

---

## Review-Checkliste für morgen

- [ ] Jeder Modulplan hat mindestens 3 Happy-Path-Tests **automatisiert**.
- [ ] Jeder Modulplan hat einen RLS-Test (zwei Orgs, keine Sicht auf fremde Daten).
- [ ] Jede 72-h-/4-h-/1-m-Frist hat einen Timer-Test mit Zeitzonen-Edge-Case.
- [ ] Shared-Finding-Dedup ist getestet.
- [ ] Hash-Chain-Integrität ist getestet (Mutation bricht Kette).
- [ ] Whistleblowing-Isolation ist getestet (Nicht-Officer sieht nichts).
- [ ] Retention-Rule-Worker hat Integration-Test.
- [ ] Evidence-Upload hat Virus-Scan.
- [ ] Gap-Liste ist priorisiert (was zählt für Sprint-Planning).
