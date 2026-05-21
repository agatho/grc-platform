# ARCTOS Alpha-Verification — User Stories & End-to-End Journeys

**Erstellt:** 2026-05-15
**Methode:** Pro RBAC-Rolle eine vollständige End-to-End-Journey mit konkreten API-Calls + Akzeptanzkriterien
**Zweck:** Identifikation residualer Bugs in der Alpha-Plattform
**Ausführung:** Cowork-QA gegen Live-Server (Multi-Role-Login mit Meridian-Test-Usern)

---

## Rollen-Inventar (15 Personae)

| ID    | Rolle                  | LoD | Test-User                      | Pwd          |
| ----- | ---------------------- | --- | ------------------------------ | ------------ |
| US-01 | CISO                   | 2nd | `ciso@meridian.test`           | WaveQA-2026! |
| US-02 | DPO                    | 2nd | `dpo@meridian.test`            | WaveQA-2026! |
| US-03 | Compliance Officer     | 2nd | `compliance@meridian.test`     | WaveQA-2026! |
| US-04 | Internal Auditor       | 3rd | `auditor@meridian.test`        | WaveQA-2026! |
| US-05 | Process Owner          | 1st | `process-owner@meridian.test`  | WaveQA-2026! |
| US-06 | Vendor Manager         | 1st | `vendor-mgr@meridian.test`     | WaveQA-2026! |
| US-07 | ESG Manager            | 2nd | `esg@meridian.test`            | WaveQA-2026! |
| US-08 | Whistleblowing Officer | —   | `whistleblowing@meridian.test` | WaveQA-2026! |
| US-09 | Viewer                 | —   | `viewer@meridian.test`         | WaveQA-2026! |
| US-10 | Risk Manager           | 2nd | `risk.manager@arctos.dev`      | arctos2026!  |
| US-11 | Control Owner          | 1st | `control.owner@arctos.dev`     | arctos2026!  |
| US-12 | BCM Manager            | 2nd | (seed-only)                    | —            |
| US-13 | Security Analyst       | 1st | (seed-only)                    | —            |
| US-14 | Admin                  | —   | `admin@arctos.dev`             | admin123     |
| US-15 | External Auditor       | 3rd | (seed-only)                    | —            |

---

## Journey-Pattern (Template)

Jede Journey hat:

- **Persona** mit Name + Rolle + LoD
- **Business-Goal** (was will die Person erreichen)
- **Cross-Module-Touchpoints** (welche Module berührt die Journey)
- **6–12 nummerierte Steps** mit erwartetem API-Call + Status-Code + Cross-Module-Verifikation
- **Akzeptanz-Kriterien** (was muss am Ende OK sein)
- **Status:** ⏸ pending → 🏃 running → ✅ passed → 🔴 failed (mit Befund-Details)

---

## US-01 — CISO Quartals-Risiko-Review (Sarah Mueller)

**Goal:** CISO macht sein Quartals-ISO-27001-Risiko-Review: Top-5-Risiken eyeballen, kritische Findings checken, Risk-Treatment-Budget aktualisieren, Quartals-Report exportieren.

**Cross-Module:** ERM + ICS + Findings + Treatments + Reporting + Audit-Log

| #   | Step                                                         | Erwartung                            | Status |
| --- | ------------------------------------------------------------ | ------------------------------------ | :----: |
| 1   | Login als CISO                                               | 200 + session                        |   ⏸    |
| 2   | `GET /risks?limit=100&sortBy=riskScoreResidual&sortDir=desc` | 200, 25+ Risks                       |   ⏸    |
| 3   | Drill-down Top-5-Risiken (jeweils GET /risks/{id})           | 200 mit volle Details                |   ⏸    |
| 4   | Pro Top-Risk: `GET /risks/{id}/treatments`                   | 200 mit Treatment-Liste              |   ⏸    |
| 5   | `GET /risks/treatments/budget?groupBy=org`                   | 200 mit Aggregation                  |   ⏸    |
| 6   | `GET /controls/effectiveness`                                | 200 mit Cascade-Werte                |   ⏸    |
| 7   | `GET /findings?severity=major_nonconformity&status=open`     | 200 mit Liste                        |   ⏸    |
| 8   | Status-Transition auf 1 Risk: identified→assessed            | 200                                  |   ⏸    |
| 9   | `GET /erm/management-summary` (Quartals-Report-Daten)        | 200                                  |   ⏸    |
| 10  | Audit-Log-Prüfung: alle Mutationen im Log                    | Hash-Chain healthy + 4 neue Einträge |   ⏸    |

**Akzeptanz:** Alle Schritte 200, Hash-Chain healthy, CISO hat aktuelle Sicht.

---

## US-02 — DPO GDPR-DSR + DPIA-Workflow (Dr. Julia Krause)

**Goal:** DPO bearbeitet eine eingehende Auskunftsanfrage und prüft, ob für eine neue Produktidee eine DPIA nötig ist.

**Cross-Module:** DPMS/DSR + DPMS/DPIA + Notifications + Audit-Log

| #   | Step                                                | Erwartung                   | Status |
| --- | --------------------------------------------------- | --------------------------- | :----: |
| 1   | Login als DPO                                       | 200                         |   ⏸    |
| 2   | `POST /dpms/dsr` (neue Auskunftsanfrage, Art. 15)   | 201                         |   ⏸    |
| 3   | `GET /dpms/dsr/{id}/transitions`                    | 200 mit allen Side-Channels |   ⏸    |
| 4   | `POST /dpms/dsr/{id}/verify` (Identität bestätigen) | 200 status=verified         |   ⏸    |
| 5   | `POST /dpms/dsr/{id}/process` (Bearbeitung starten) | 200 status=processing       |   ⏸    |
| 6   | `POST /dpms/dsr/{id}/respond`                       | 200 status=response_sent    |   ⏸    |
| 7   | `POST /dpms/dsr/{id}/close`                         | 200 status=closed           |   ⏸    |
| 8   | DPIA Create für neue Produktidee                    | 201 status=draft            |   ⏸    |
| 9   | DPIA Transition draft→in_progress                   | 200                         |   ⏸    |
| 10  | DPIA Transition in_progress→reviewed                | 200                         |   ⏸    |
| 11  | Notifications-Check                                 | 200                         |   ⏸    |

**Akzeptanz:** DSR-Lifecycle vollständig durchlaufen (received→closed via 4 Side-Channels), DPIA in `reviewed` Status.

---

## US-03 — Compliance Officer Multi-Framework-Audit (Thomas Schmidt)

**Goal:** Compliance Officer prepariert die jährliche ISO-27001 + NIS2-Compliance-Aufstellung. Stichprobe von 5 Controls testen + Findings dokumentieren.

**Cross-Module:** Controls + Control-Tests + Findings + Frameworks

| #   | Step                                                              | Erwartung                     | Status |
| --- | ----------------------------------------------------------------- | ----------------------------- | :----: |
| 1   | Login als Compliance Officer                                      | 200                           |   ⏸    |
| 2   | `GET /controls?limit=100`                                         | 200 mit Control-Liste         |   ⏸    |
| 3   | `GET /compliance/frameworks`                                      | 200 mit 953 Frameworks        |   ⏸    |
| 4   | `GET /compliance/coverage?framework=iso-27001`                    | 200 mit echter Coverage > 0   |   ⏸    |
| 5   | Stichprobe 5 Controls: `POST /control-tests` (Test-of-Design)     | 5× 201                        |   ⏸    |
| 6   | Pro fehlgeschlagenem Test: `POST /findings` (source=control_test) | 201 mit controlTestId         |   ⏸    |
| 7   | `PUT /controls/{id}/effectiveness` für 5 Controls                 | 5× 200                        |   ⏸    |
| 8   | `GET /controls/effectiveness` (sollte sich verändert haben)       | 200 mit aktualisierten Werten |   ⏸    |
| 9   | `GET /controls/findings-summary`                                  | 200                           |   ⏸    |
| 10  | Audit-Log-Check (Hash-Chain)                                      | healthy + 10+ neue Einträge   |   ⏸    |

**Akzeptanz:** 5 Control-Tests dokumentiert, ≥2 Findings raised, Effectiveness rolliert sauber.

---

## US-04 — Internal Auditor ISO-27001-Audit-Lifecycle (Dr. Klaus Richter)

**Goal:** Auditor führt einen geplanten ISO-27001-Audit durch (4 Phasen: planned→preparation→fieldwork→reporting), schreibt 3 Findings.

**Cross-Module:** Audit-Mgmt + Findings + Risks + Audit-Log

| #   | Step                                                                     | Erwartung                    | Status |
| --- | ------------------------------------------------------------------------ | ---------------------------- | :----: |
| 1   | Login als Auditor                                                        | 200                          |   ⏸    |
| 2   | `POST /audit-mgmt/audits` (ISO 27001 Annual)                             | 201 status=planned           |   ⏸    |
| 3   | `GET /audit-mgmt/audits/{id}/transitions`                                | 200 mit allowedNext          |   ⏸    |
| 4   | Transition planned→preparation                                           | 200                          |   ⏸    |
| 5   | `POST /audit-mgmt/audits/{id}/activities` (Stichprobe definieren)        | 201                          |   ⏸    |
| 6   | Transition preparation→fieldwork                                         | 200                          |   ⏸    |
| 7   | `POST /findings` (auditId=X, source=audit, severity=major_nonconformity) | 201 mit auditId persistiert! |   ⏸    |
| 8   | `GET /findings?auditId=X` (Filter)                                       | 200 mit Finding zurück       |   ⏸    |
| 9   | Wiederhole für 3 Findings                                                | 3× 201                       |   ⏸    |
| 10  | Transition fieldwork→reporting                                           | 200                          |   ⏸    |
| 11  | Audit-Report-Export prüfen                                               | application/pdf              |   ⏸    |

**Akzeptanz:** State-Machine vollständig durchlaufen, 3 Findings mit auditId/controlId persistiert (Wave-23-Showstopper-Check!), PDF generierbar.

---

## US-05 — Process Owner Risk-Lifecycle (Thomas Fischer)

**Goal:** Process Owner identifiziert ein neues operationelles Risiko in seinem Bereich, bewertet es, plant ein Treatment, schließt es nach Implementation.

**Cross-Module:** ERM + Treatments + Notifications

| #   | Step                                                                           | Erwartung             | Status |
| --- | ------------------------------------------------------------------------------ | --------------------- | :----: |
| 1   | Login als Process Owner                                                        | 200                   |   ⏸    |
| 2   | `POST /risks` (neues operationelles Risiko)                                    | 201 status=identified |   ⏸    |
| 3   | `PUT /risks/{id}/assessment` (inherentLik=4, inherentImpact=4)                 | 200, score=16         |   ⏸    |
| 4   | `PUT /risks/{id}/status` (assessed)                                            | 200                   |   ⏸    |
| 5   | `POST /risks/{id}/treatments` (mitigate, costEstimate=10000)                   | 201                   |   ⏸    |
| 6   | Update Treatment status auf in_progress                                        | 200                   |   ⏸    |
| 7   | `PUT /risks/{id}/assessment` (residualLik=2, residualImpact=2 nach Mitigation) | 200, residualScore=4  |   ⏸    |
| 8   | Treatment status auf completed                                                 | 200                   |   ⏸    |
| 9   | Risk Status auf treated                                                        | 200                   |   ⏸    |
| 10  | `GET /risks/treatments/budget?groupBy=owner`                                   | Mein Cost enthalten   |   ⏸    |

**Akzeptanz:** Process Owner führt eigenen Risk-Lifecycle von Create→Treated durch ohne RBAC-Blocker.

---

## US-06 — Vendor Manager TPRM + DORA-Critical (Meridian Vendor Mgr)

**Goal:** Vendor Manager onboards einen neuen kritischen ICT-Vendor (DORA-relevant), legt Contract an, macht Assessment.

**Cross-Module:** TPRM + Contracts + DORA + Risk

| #   | Step                                              | Erwartung                   | Status |
| --- | ------------------------------------------------- | --------------------------- | :----: |
| 1   | Login als Vendor Manager                          | 200                         |   ⏸    |
| 2   | `POST /tprm/vendors` (tier=critical, country=DE)  | 201                         |   ⏸    |
| 3   | `POST /contracts` (mit title!, service_agreement) | 201                         |   ⏸    |
| 4   | `POST /tprm/vendors/{id}/assessments`             | 201                         |   ⏸    |
| 5   | `GET /dora/critical-vendors` (Auto-Sync)          | 200, neuer Vendor enthalten |   ⏸    |
| 6   | `GET /tprm/vendors/{id}/risk-profile`             | 200                         |   ⏸    |
| 7   | `GET /tprm/concentration`                         | 200                         |   ⏸    |
| 8   | Contract status auf active                        | 200                         |   ⏸    |

**Akzeptanz:** Vendor + Contract + Assessment in einer Session erstellt, automatisch in DORA-Liste, kein RBAC-Blocker.

---

## US-07 — ESG Manager CSRD-Quartalsmessung (Meridian ESG)

**Goal:** ESG-Manager erfasst Quartals-Emissionsdaten (Scope 1/2/3) gegen ESRS-Datapoints und finalisiert die Materialitätsanalyse.

**Cross-Module:** ESG + Materiality + Reporting

| #   | Step                                                                            | Erwartung                   | Status |
| --- | ------------------------------------------------------------------------------- | --------------------------- | :----: |
| 1   | Login als ESG Manager                                                           | 200                         |   ⏸    |
| 2   | `GET /esg/datapoints?limit=20`                                                  | 200, total>0 (Wave 22 Seed) |   ⏸    |
| 3   | `POST /esg/measurements` (datapointId=valid, value=100, periodStart, periodEnd) | 201                         |   ⏸    |
| 4   | Wiederhole für 5 Datapoints (Scope 1+2+3)                                       | 5× 201                      |   ⏸    |
| 5   | `POST /esg/measurements/{id}/verify`                                            | 200 verified=true           |   ⏸    |
| 6   | `GET /esg/carbon`                                                               | 200 mit Aggregation         |   ⏸    |
| 7   | `POST /esg/materiality/{year}/topics` (3 Topics)                                | 3× 201                      |   ⏸    |
| 8   | `POST /esg/materiality/{year}/finalize`                                         | 200                         |   ⏸    |
| 9   | `GET /esg/report/{year}/export?format=pdf`                                      | application/pdf             |   ⏸    |

**Akzeptanz:** 5 Measurements verifiziert, Materiality finalisiert, PDF generierbar.

---

## US-08 — Whistleblowing Officer HinSchG-Case-Triage

**Goal:** WB-Officer empfängt anonymen Tipp, triagiert, eröffnet Untersuchung, schließt mit Konklusion. Kritisch: Cross-Role-Test (Admin darf NICHT in den Case rein).

**Cross-Module:** Whistleblowing + Notifications + HinSchG-Compliance

| #   | Step                                                               | Erwartung                | Status |
| --- | ------------------------------------------------------------------ | ------------------------ | :----: |
| 1   | Anonymous Intake `POST /whistleblowing/intake/{orgCode}`           | 201 (no auth required)   |   ⏸    |
| 2   | Login als WB Officer                                               | 200                      |   ⏸    |
| 3   | `GET /whistleblowing/cases?status=received`                        | 200, neuer Case sichtbar |   ⏸    |
| 4   | `PUT /whistleblowing/cases/{id}` (status=triage)                   | 200                      |   ⏸    |
| 5   | `PUT /whistleblowing/cases/{id}` (status=investigation)            | 200                      |   ⏸    |
| 6   | Cross-Role-Test: Login als Admin → `GET /whistleblowing/cases`     | **403** (verboten!)      |   ⏸    |
| 7   | Cross-Role-Test: Login als CISO → `GET /whistleblowing/cases/{id}` | **403**                  |   ⏸    |
| 8   | Zurück WB Officer, status=conclusion                               | 200                      |   ⏸    |
| 9   | `GET /whistleblowing/statistics` (anonymisiert)                    | 200                      |   ⏸    |
| 10  | status=closed                                                      | 200                      |   ⏸    |

**Akzeptanz:** Lifecycle vollständig, Admin/CISO werden 403 geblockt (HinSchG §§16/32).

---

## US-09 — Viewer Read-Only-Verifikation

**Goal:** Viewer kann lesen, kann nicht mutieren.

**Cross-Module:** Alle Module (Read-only-Check)

| #   | Step                                  | Erwartung                  | Status |
| --- | ------------------------------------- | -------------------------- | :----: |
| 1   | Login als Viewer                      | 200                        |   ⏸    |
| 2   | `GET /risks?limit=10`                 | 200                        |   ⏸    |
| 3   | `GET /controls?limit=10`              | 200                        |   ⏸    |
| 4   | `GET /findings?limit=10`              | 200                        |   ⏸    |
| 5   | `POST /risks {...}` (Schreib-Versuch) | 403                        |   ⏸    |
| 6   | `PUT /risks/{id}/assessment`          | 403                        |   ⏸    |
| 7   | `DELETE /risks/{id}`                  | 403                        |   ⏸    |
| 8   | `GET /audit-log/integrity`            | 200 oder 403 (Admin-only?) |   ⏸    |

**Akzeptanz:** Alle GETs 200, alle Mutationen 403, sauberer Read-Only-Boundary.

---

## US-10 — Risk Manager Cross-Process-Risk-Aggregation (Lisa Schneider)

**Goal:** Risk Manager analysiert die Risiken über alle Process-Owner-Bereiche, identifiziert die 3 größten Cross-Process-Risiken, schlägt Treatments vor.

**Cross-Module:** ERM + Process + Treatments + Reporting

| #   | Step                                                 | Erwartung             | Status |
| --- | ---------------------------------------------------- | --------------------- | :----: |
| 1   | Login als Risk Manager                               | 200                   |   ⏸    |
| 2   | `GET /risks?limit=100`                               | 200 mit voller Liste  |   ⏸    |
| 3   | `GET /risks/byCategory` (Aggregation)                | 200 mit Bucket-Counts |   ⏸    |
| 4   | `GET /risks/byStatus`                                | 200                   |   ⏸    |
| 5   | Top-3-Risk je `PUT /risks/{id}/assessment` (refinen) | 3× 200                |   ⏸    |
| 6   | Pro Top-3 ein neues Treatment                        | 3× 201                |   ⏸    |
| 7   | `GET /risks/treatments/budget?groupBy=department`    | 200 mit dept-buckets  |   ⏸    |
| 8   | KRI-Werte ablesen `GET /kris?limit=10`               | 200                   |   ⏸    |
| 9   | Pro KRI: `GET /kris/{id}/history`                    | 200                   |   ⏸    |

**Akzeptanz:** Risk-Aggregation funktional, KRI-History abrufbar, Cross-Owner-Sicht da.

---

## US-11 — Control Owner Operating-Effectiveness-Test (Sarah Keller)

**Goal:** Control Owner führt seinen monatlichen ToE-Test für 5 IT-Controls durch.

**Cross-Module:** Controls + Control-Tests + Findings

| #   | Step                                                                  | Erwartung                    | Status |
| --- | --------------------------------------------------------------------- | ---------------------------- | :----: |
| 1   | Login als Control Owner                                               | 200                          |   ⏸    |
| 2   | `GET /controls?ownerId=me`                                            | 200 mit eigenen Controls     |   ⏸    |
| 3   | Pro Control: `POST /control-tests` (testType=operating_effectiveness) | 5× 201                       |   ⏸    |
| 4   | Für 2 fehlgeschlagene: `POST /findings` (controlTestId=X)             | 2× 201                       |   ⏸    |
| 5   | Effectiveness von 5 Controls updaten                                  | 5× 200                       |   ⏸    |
| 6   | `GET /controls/effectiveness` (Cascade)                               | sollte den Test reflektieren |   ⏸    |
| 7   | `GET /controls/findings-summary`                                      | 200                          |   ⏸    |

**Akzeptanz:** 5 Tests + 2 Findings + Effectiveness-Rollup funktioniert.

---

## US-12 — BCM Manager BIA-Quartalsschätzung (Lisa Wagner)

**Goal:** BCM Manager führt die jährliche BIA durch, scort alle Top-Prozesse, definiert RTO/RPO, plant DR-Tests.

**Cross-Module:** BCMS + Process + Assets

| #   | Step                                                           | Erwartung                           | Status |
| --- | -------------------------------------------------------------- | ----------------------------------- | :----: |
| 1   | Login als BCM Manager                                          | 200 (falls seed-User existiert)     |   ⏸    |
| 2   | `POST /bcms/bia` (mit leadAssessorId + period)                 | 201                                 |   ⏸    |
| 3   | `POST /bcms/bia/{id}/start`                                    | 200 status=in_progress, blockers=[] |   ⏸    |
| 4   | `POST /bcms/bia/{id}/process-impacts` (Scoring pro Prozess)    | 201                                 |   ⏸    |
| 5   | Wiederhole für 5 Prozesse                                      | 5× 201                              |   ⏸    |
| 6   | `POST /bcms/bia/{id}/approve` (sollte gehen wenn alle gescort) | 200                                 |   ⏸    |
| 7   | `GET /bcms/bia/{id}/report`                                    | 200 mit Recovery-Plan-Daten         |   ⏸    |

**Akzeptanz:** BIA-Lifecycle mit Gates funktioniert, Approve blockt nicht mehr durch B1/B2-Gates.

---

## US-13 — Security Analyst Incident-Response (Markus Bauer)

**Goal:** Security Analyst meldet einen Datenpannen-Incident, kategorisiert (data_breach=true), läuft durch NIST-7-State, eskaliert an DPO (72h-Frist).

**Cross-Module:** ISMS + Incidents + Notifications + DPMS

| #   | Step                                                          | Erwartung                        | Status |
| --- | ------------------------------------------------------------- | -------------------------------- | :----: |
| 1   | Login als Security Analyst                                    | 200 (falls seed-User existiert)  |   ⏸    |
| 2   | `POST /isms/incidents` (severity=critical, isDataBreach=true) | 201 mit dataBreachDeadline (72h) |   ⏸    |
| 3   | `GET /isms/incidents/{id}/transitions`                        | 200 mit NIST-7-State             |   ⏸    |
| 4   | Walk: detected→triaged                                        | 200                              |   ⏸    |
| 5   | triaged→contained                                             | 200                              |   ⏸    |
| 6   | contained→eradicated                                          | 200                              |   ⏸    |
| 7   | eradicated→recovered                                          | 200                              |   ⏸    |
| 8   | recovered→lessons_learned                                     | 200                              |   ⏸    |
| 9   | lessons_learned→closed                                        | 200                              |   ⏸    |
| 10  | DPO-Notification ausgelöst? `GET /notifications` als DPO      | sollte Entry haben               |   ⏸    |

**Akzeptanz:** NIST-7-State durchlaufen, 72h-Deadline gesetzt, DPO benachrichtigt.

---

## US-14 — Admin Cross-Org-Sicht (Platform Admin)

**Goal:** Admin macht eine Org-übergreifende Plattform-Health-Check (User-Mgmt, Settings, License).

**Cross-Module:** Admin + Users + Organizations + Audit-Log

| #   | Step                           | Erwartung                         | Status |
| --- | ------------------------------ | --------------------------------- | :----: |
| 1   | Login als Admin                | 200                               |   ⏸    |
| 2   | `GET /users?limit=50`          | 200 mit User-Liste                |   ⏸    |
| 3   | `GET /organizations?limit=20`  | 200 mit Org-Liste                 |   ⏸    |
| 4   | `GET /admin/settings`          | 200                               |   ⏸    |
| 5   | `GET /admin/license`           | 200                               |   ⏸    |
| 6   | `GET /admin/integrations`      | 200                               |   ⏸    |
| 7   | `GET /admin/branding`          | **200 oder 501** (Wave-23-Check!) |   ⏸    |
| 8   | `GET /audit-log/integrity`     | 200 healthy                       |   ⏸    |
| 9   | `GET /admin/calendar/holidays` | 200                               |   ⏸    |

**Akzeptanz:** Admin-Dashboard vollständig zugänglich, KEIN 500-Endpoint mehr.

---

## US-15 — External Auditor Read-Only-Audit-Universe

**Goal:** Externe Prüfer können den Audit-Trail einsehen, aber nicht modifizieren.

**Cross-Module:** Audit-Mgmt + Audit-Log + Findings + Reporting

| #   | Step                                                   | Erwartung                     | Status |
| --- | ------------------------------------------------------ | ----------------------------- | :----: |
| 1   | Login als External Auditor (falls seed-User existiert) | 200                           |   ⏸    |
| 2   | `GET /audit-mgmt/audits?limit=20`                      | 200                           |   ⏸    |
| 3   | `GET /findings?limit=20`                               | 200                           |   ⏸    |
| 4   | `GET /audit-log/integrity`                             | 200 healthy                   |   ⏸    |
| 5   | `POST /findings {...}` (Schreib-Versuch)               | 403 oder 200 (je nach Policy) |   ⏸    |
| 6   | `GET /risks?limit=10`                                  | 200                           |   ⏸    |
| 7   | Audit-Pack-Export für gewähltes Audit                  | application/pdf               |   ⏸    |

**Akzeptanz:** Read-Zugriff vollständig, klare Boundary für Mutationen.

---

## Execution-Plan

**Reihenfolge:** US-01 → US-15. Pro Journey: Schritte in browser_batch JavaScript-Execution mit Live-Server. Bei jedem 🔴 Fehler: Befund-Eintrag in `arctos-alpha-findings-2026-05-15.md`.

**Stop-Condition:** Nach jeder Journey Hash-Chain-Check. Bei `unhealthy` STOP und Eskalation.

---

_User-Stories-Dokument erstellt 2026-05-15. 15 Journeys, ~135 API-Steps total._
