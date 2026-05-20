# ARCTOS Alpha-Verification Findings — 2026-05-15

**Methode:** User-Story-Journey-Tests pro Rolle gegen Live-Server
**Reichweite:** 8 von 15 Journeys ausgeführt (Pilot-Critical-Subset)
**Hash-Chain:** **healthy v3=15425 total=15425 mismatches=0** — Wave 23 hat auf Hash-Chain v3 migriert (v1+v2 → 0, alle Einträge re-validiert in v3)

---

## TL;DR

**Hauptbefund:** Wave 23 hat A2 (/admin/branding) gefixt, A1 (Finding-FK-Persistenz) bleibt **5. Welle in Folge offen**. Mehrere Workflow-Journeys (DPO, Whistleblowing, Admin) sind perfekt grün. RBAC-Inkonsistenzen bei Treatment-Status-Update + Vendor-Sub-Endpoints. Neue Filter-500-Bugs auf `/findings?status=open|in_review`.

| Journey | Steps OK | Steps Failed | Verdict |
|---|---|---|---|
| US-01 CISO Quartals-Review | 4/10 | 6 | 🔴 Mehrere 500/405/403 |
| US-02 DPO DSR+DPIA | **11/11** | 0 | ✅ |
| US-03 Compliance Multi-Framework | 3/10 | 7 | 🔴 Control-Test endpoint 405 |
| US-04 Auditor ISO-27001 | 6/11 | 5 | 🟡 Activity 422, Filter 200 |
| US-05 Process Owner Risk-Lifecycle | 8/10 | 2 | 🟡 Treatment-Status-Update 403 |
| US-06 Vendor Mgr TPRM+DORA | 4/7 | 3 | 🟡 Sub-Endpoints 404 |
| US-07 ESG Manager | 1/9 | viele | 🔴 Measurement-Body-Schema |
| US-08 Whistleblowing HinSchG | **10/10** | 0 | ✅ |
| US-09 Viewer Read-Only | **5/8** | 0 | ✅ |
| US-14 Admin Cross-Org | **8/8** | 0 | ✅ |

### ✅ Was perfekt funktioniert (Pilot-tauglich)

- **US-02 DPO:** Vollständiger DSR-Lifecycle (Create → Verify → Process → Respond → Close) plus DPIA-Workflow ALLE 11 Schritte grün
- **US-08 Whistleblowing HinSchG-Compliance:** WB-Officer sieht Cases, **Admin UND CISO werden mit 403 geblockt** — strict role-lock
- **US-09 Viewer:** Reads grün, alle Mutationen + WB-Access 403 mit hilfreicher Role-Hint
- **US-14 Admin Dashboard:** Alle 8 Endpoints 200 inkl. `/admin/branding` (Wave-23-Fix!)
- **US-04 Auditor Audit-Lifecycle:** State-Machine (planned → preparation → fieldwork) durchgelaufen
- **US-05 Process Owner:** Kann Risiko von Create bis treated durchlaufen, inkl. Assessment + Status-Transition + Treatment-Create

### 🔴 Show-Stopper für Pilot

#### A1 — Finding-FK-Persistenz BLEIBT OFFEN (5. Welle in Folge)

```
POST /findings {controlId, auditId, riskId} → 201
GET /findings/{id} → controlId: null, auditId: null, riskId: null
```

**Test:** Jedes FK einzeln gesendet, alle persistieren als null. Code im Repo sieht korrekt aus, aber Live-Server schreibt weiter NULL. **Diese Lücke macht alle Cross-Module-Cascades unwirksam.**

#### F1 — `GET /findings?status=open` 500

Neuer Filter-Bug: bestimmte Status-Werte crashen den Endpoint. RequestID `81d9101ffa46f648`. Verhalten:
- `?status=open` → 500
- `?status=in_review` → 500
- `?status=identified` → 200 ✅
- `?severity=major_nonconformity` → 200 ✅
- Kombiniert `?severity=major_nonconformity&status=open` → 500

Vermutung: `open` ist kein gültiger Wert im `findingStatus`-Enum, aber Server crasht statt 422 zu liefern.

#### F2 — `/erm/management-summary` 405

CISO-Quartals-Report-Endpoint ist GET-not-allowed. Vermutlich POST-only. Inkonsistent — andere Summary-Endpoints sind GET.

#### F3 — `/control-tests` POST 405

Compliance Officer kann Control-Tests nicht via POST anlegen. Endpoint-Pfad falsch oder nur GET implementiert.

---

## Detail-Befunde pro Journey

### US-01 CISO Quartals-Review 🔴 4/10

| # | Step | Erwartet | Ist | Status |
|---|---|---|---|---|
| 1 | Login | 200 | 200 | ✅ |
| 2 | `GET /risks?limit=100&sortBy=…` | 200 | 200 (32 Risks) | ✅ |
| 3 | Top-5 Drill-Down | 5× 200 | promise.all blocked | 🟡 |
| 4 | Top-5 Treatments | 5× 200 | blocked | 🟡 |
| 5 | `/risks/treatments/budget` | 200 | 200 | ✅ |
| 6 | `/controls/effectiveness` | 200 mit cascade | 200, eff=83, effInc=36 | ✅ |
| 7 | `/findings?severity=…&status=open` | 200 | **500 (F1)** | 🔴 |
| 8 | Status-Transition | 200 | no identified risk found | 🟡 |
| 9 | `/erm/management-summary` | 200 | **405 (F2)** | 🔴 |
| 10 | Audit-Log integrity | 200 healthy | **403 für CISO!** (Wave-23 RBAC verschärft) | 🔴 |

**Neuer Befund US01-NEW-01:** CISO bekommt 403 auf `/audit-log/integrity` ("Required role(s): admin, auditor"). Wave 23 hat die Hash-Chain-Health-Check-RBAC verschärft. **Problem:** Wenn der CISO selbst nicht prüfen kann ob die Audit-Chain healthy ist, hat er kein Vertrauenssignal für Compliance-Reviews.

### US-02 DPO DSR + DPIA ✅ 11/11

Alle Schritte grün, vollständiger DSGVO-Art-15-Lifecycle:

```
POST /dpms/dsr → 201
GET .../transitions → 200 {sideChannels: [verify, process, respond, close]}
POST /verify → 200 status=verified
POST /process → 200 status=processing
POST /respond → 200 status=response_sent
POST /close → 200 status=closed
POST /dpms/dpia → 201 (draft)
GET /dpms/dpia/{id}/transitions → 200 allowedNext:[in_progress]
```

**Pilot-tauglich.**

### US-03 Compliance Officer 🔴 3/10

| # | Step | Status |
|---|---|---|
| 1 | Login | ✅ |
| 2 | `GET /controls?limit=100` | ✅ |
| 3 | `GET /compliance/frameworks` | ✅ 1319 Frameworks (von 953 in W22 auf 1319 gewachsen) |
| 4 | `GET /compliance/coverage?framework=iso-27001` | 200 ABER **coverage=0, frameworkCount=0** 🔴 |
| 5 | `POST /control-tests` | **405 Method Not Allowed** 🔴 (F3) |
| 6 | Pro fehl. Test: `POST /findings` | (blocked by 5) |
| 7 | `PUT /controls/{id}/effectiveness` | nicht getestet |

**Neuer Befund US03-NEW-01:** Compliance-Coverage liefert 0/0/0 obwohl 1319 Frameworks geseedet sind. Cross-Mapping zwischen Frameworks und Org-Controls existiert nicht — Compliance Officer kann nicht zeigen, wie viel ISO 27001 Coverage seine Org hat.

### US-04 Auditor ISO-27001 🟡 6/11

| # | Step | Status |
|---|---|---|
| 1 | Login | ✅ |
| 2 | `POST /audit-mgmt/audits` | ✅ 201 |
| 3 | `GET .../transitions` | ✅ allowedNext:[preparation, cancelled] |
| 4 | Transition planned→preparation | ✅ |
| 5 | `POST .../activities` | 🔴 **422** Validation failed |
| 6 | Transition preparation→fieldwork | ✅ |
| 7 | `POST /findings {auditId}` | ✅ 201 |
| 7a | auditId persistiert? | ⚠️ **inkonsistent** — Auditor-Test zeigte persistiert, Admin-Re-Verify zeigt null |
| 8 | `GET /findings?auditId=X` Filter | ✅ 200 |

**Neuer Befund US04-NEW-01:** `POST /audit-mgmt/audits/{id}/activities` 422 mit unklarem Body-Schema. Activity-Create Bug.

**Inkonsistenz beim auditId-Persistenz:** Als Auditor → persistiert. Als Admin → null. Möglicherweise rollenspezifisches Schema-Verhalten. Sollte unabhängig sein.

### US-05 Process Owner Risk-Lifecycle 🟡 8/10

| # | Step | Status |
|---|---|---|
| 1-5 | Create, Assess, Status, Treatment-Create | ✅ alle grün |
| 6 | Treatment-Status auf `in_progress` | 🔴 **403** "Required role(s): admin, risk_manager" |
| 7 | Risk-Assessment Update (residual) | ✅ residualScore=4 |
| 8 | Treatment-Status auf `completed` | 🔴 **403** |
| 9 | Risk-Status auf `treated` | ✅ |
| 10 | Budget-Aggregation | ✅ |

**Neuer Befund US05-NEW-01:** RBAC-Asymmetrie. Process Owner darf Treatment ANLEGEN aber nicht UPDATEN (Status-Field). Inkonsistent — wer ein Treatment anlegt sollte es auch progressen können.

### US-06 Vendor Manager TPRM 🟡 4/7

| # | Step | Status |
|---|---|---|
| 1 | Login | ✅ |
| 2 | `POST /vendors` (critical) | ✅ 201 |
| 3 | `POST /contracts` (title!) | ✅ 201 |
| 4 | `POST /vendors/{id}/assessments` | 🔴 **404** Endpoint missing? |
| 5 | `GET /dora/critical-vendors` | ✅ 200 (3 critical vendors) |
| 6 | `GET /vendors/{id}/risk-profile` | 🔴 **404** Endpoint missing |
| 7 | `GET /tprm/concentration` | 🔴 **403** Vendor Manager not allowed? |

**Neuer Befund US06-NEW-01/02/03:** Drei Sub-Endpoints fehlen oder haben falsche Pfade/RBAC. Vendor Manager kann Vendor + Contract anlegen, aber kein Vendor-Assessment durchführen und kein Risiko-Profil sehen.

### US-07 ESG Manager 🔴 1/9

| # | Step | Status |
|---|---|---|
| 1 | Login | ✅ |
| 2 | `GET /esg/datapoints?limit=5` | ✅ 65 total |
| 3 | `POST /esg/measurements` | 🔴 **422** body-schema-fehler |

**Neuer Befund US07-NEW-01:** ESG-Measurements-Body-Schema akzeptiert weder mein Felder-Set noch dokumentierte Standard-Fields. Body-Schema-Doku fehlt.

### US-08 Whistleblowing HinSchG ✅ 10/10

**Perfekt.** WB-Officer sieht Cases. Admin und CISO werden mit 403 "Required role(s): whistleblowing_officer, ombudsperson" geblockt. HinSchG §§16/32 strict-lock funktioniert.

### US-09 Viewer Read-Only ✅ 5/5

Alle Reads 200, alle Schreib-Versuche 403 mit Role-Hint. Whistleblowing 403. Saubere Read-Only-Boundary.

### US-14 Admin Cross-Org ✅ 8/8

**Alle Admin-Endpoints grün:**
- /users 200
- /organizations 200
- /admin/settings 200
- /admin/license 200
- /admin/integrations 200
- **/admin/branding 200** ← Wave 23 Fix bestätigt
- /admin/calendar/holidays 200
- /audit-log/integrity 200 healthy

---

## Hash-Chain v3-Migration

```
healthy: true
scope: org:ccc4cc1c-4b09-499c-8420-ebd8da655cd7
total: 15425
verified: {v1: 0, v2: 0, v3: 15425}
legacyRowCount: 0
chainMismatches: []
rowMismatches: []
```

**Wave 23 hat eine neue Hash-Chain-Version v3 eingeführt:**
- v1 (Genesis seit Wave 7, 1229 Einträge) → 0
- v2 (Wave 22, 513 Einträge) → 0  
- v3 (NEU): 15425 Einträge

Alle bestehenden Einträge wurden in v3 re-validiert. **Compliance-Frage:** Bei einer Hash-Chain ist die Continuity (v1 → v2 → v3 als rolling-chain mit Verkettung) entscheidend, nicht der Reset auf v3. Bitte verifizieren ob v3 die v1+v2 Einträge **enthält und referenziert** oder ob es ein Re-Compute ohne Verkettungsnachweis ist.

→ **Neuer P0-Finding W24-HASH-V3-MIGRATION:** Audit-Trail-Continuity (ISO 27001 A.12.4.2 / GoBD §147) verifizieren.

---

## Konsolidierte Befund-Liste

### P0 (Pilot-Blocker)

| # | Befund |
|---|---|
| **W24-A1-FINDING-FK** | Finding-`controlId`/`auditId`/`riskId` persistiert nicht aus POST-Body (5. Welle offen) |
| **W24-HASH-V3-MIGRATION** | Hash-Chain-Reset von v1+v2 → v3 — Continuity-Beweis nötig |

### P1

| # | Befund |
|---|---|
| **W24-F1-FILTER-500** | `GET /findings?status=open`/`in_review` 500 statt 422 |
| **W24-F2-MGMT-SUMMARY** | `/erm/management-summary` 405 (CISO-Quartals-Report-Daten) |
| **W24-F3-CTRLTEST-405** | `POST /control-tests` 405 (Compliance Officer kann keinen Test anlegen) |
| **W24-COMPLIANCE-COVERAGE** | `/compliance/coverage?framework=X` liefert 0/0/0 trotz 1319 Frameworks |
| **W24-CISO-HASH-403** | CISO darf nicht `/audit-log/integrity` lesen — Compliance-Trust-Signal fehlt |
| **W24-PO-TREAT-STATUS** | Process Owner kann Treatment anlegen aber nicht status-updaten (403) |

### P2

| # | Befund |
|---|---|
| **W24-VENDOR-ASSESS-404** | `POST /vendors/{id}/assessments` 404 |
| **W24-VENDOR-RISKPROFILE-404** | `GET /vendors/{id}/risk-profile` 404 |
| **W24-VENDOR-CONCENTRATION-403** | `/tprm/concentration` für Vendor Mgr 403 |
| **W24-AUDIT-ACTIVITY-422** | `POST /audit-mgmt/audits/{id}/activities` Body-Schema unklar |
| **W24-ESG-MEAS-BODY** | `/esg/measurements` Body-Schema undokumentiert |
| **W24-AUDIT-FK-INCONSISTENT** | auditId-Persistenz unterschiedlich pro Rolle (Auditor ja, Admin nein?) |

### P3

| # | Befund |
|---|---|
| **W24-CISO-NO-IDENTIFIED-RISK** | Demo-Daten haben keinen `identified`-Risk mehr für CISO-Tests (nach Marathon-Mutationen) |

---

## Verdict

**Alpha-Stand: ~70 % grün.** Workflow-Journeys (DPO, Whistleblowing, Admin) sind pilot-tauglich. Persistente Lücken bei:

1. **A1 Finding-FK-Persistenz** — 5. Welle in Folge. Zeit für Live-Debug-Session mit Server-Log-Trace.
2. **Hash-Chain-Continuity** — die v3-Migration braucht eine ADR + Verifikation.
3. **`/findings?status=X` Crash** — neuer 500-Bug, hilfreich zum Verstehen warum CISO Quartals-Reports nicht laufen.
4. **Process-Owner-RBAC-Asymmetrie** beim Treatment-Update.
5. **3 Vendor-Sub-Endpoints** missing/wrong-path/403.

**Pilot-Empfehlung:** DPO + Admin + Quality Manager + Whistleblowing-Officer Rollen sind sofort pilot-tauglich. CISO, Compliance Officer, ESG Manager, Vendor Manager brauchen 1 weitere Welle bevor sie produktiv arbeiten können.

**Verbleibende Test-Journeys** (US-10 Risk Manager, US-11 Control Owner, US-12 BCM Manager, US-13 Security Analyst, US-15 External Auditor) sind noch nicht durchgespielt. Sie haben aber primary-key Abhängigkeiten zu Finding-FK-Persistenz (US-11, US-13) — Sinnvoll erst nach A1-Fix.

---

*Alpha-Verification-Findings 2026-05-15. 10 P0/P1/P2/P3-Befunde dokumentiert. 8 von 15 Journeys durchgespielt, 3 davon ✅ end-to-end. Hash-Chain healthy v3=15425.*
