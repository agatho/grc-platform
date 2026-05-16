# Claude Code — Wave 19 + 20 Full Closure Sprint

**Quelle:** `arctos-qa-verification-2026-05-15-wave18.md` + Cowork-QA-Lücken-Audit 2026-05-15
**Vorbedingung:** Hash-Chain `healthy v1=1229 v2=449 total=1678 mismatches=0`. Bleibt healthy.
**Branch:** `feature/wave-19-20-full-closure`
**Scope:** Alle identifizierten Lücken — Code-Fixes + ungetestete Workflows verifizieren + nice-to-haves härten — BEVOR weitere Features.

---

## Auftrag (User-Direktive)

> "Wenn es noch identifizierte echte Lücken gibt dann müssen diese geschlossen werden bevor wir features verbessern."

Diese PR schließt **alle** offenen Items aus Marathon, Wave 18 und dem nachgelagerten Lücken-Audit. Keine neuen Features bis das durch ist.

Jedes Item folgt dem Format: **Symptom → Erwartung → Suchpfade → Akzeptanz-Test → Done-Kriterium.** Keine Done-Markierung ohne grünen Test im PR.

---

## Block 1 — Wave 19 P1/P2 (Beta-Blocker)

### W19-P1-01: `POST /findings {controlId}` persistiert die Verknüpfung nicht

**Symptom:**

```
POST /api/v1/findings {controlId: '<uuid>', severity:'major_nonconformity', source:'audit', status:'open'}
→ 201
GET /api/v1/findings/{id}
→ {controlId: null, status:'identified', ...}
```

`controlId` wird im INSERT gedroppt. Daher schlägt kein API-erstelltes Critical Finding in der Cascade-Aggregation (`/controls/effectiveness`) durch — der WHERE-Filter `finding.controlId is not null` schließt sie aus. Spiegelung Wave-15-P1-01 (auditId).

**Erwartung:**

1. POST persistiert `controlId`, `auditId`, `riskId`, `processId`, alle bekannten Cross-Module-Foreign-Keys
2. GET liefert sie in der JSON-Response
3. PATCH `/findings/{id}` (oder PUT) erlaubt nachträgliches Setzen — derzeit PATCH 405, PUT 422
4. Status-Mapping `open → identified` entweder strict-rejecten ODER im Schema dokumentieren

**Suchpfade:**

- `apps/web/src/app/api/v1/findings/route.ts` (POST)
- `apps/web/src/app/api/v1/findings/[id]/route.ts` (GET, PATCH/PUT)
- `packages/shared/src/schemas/finding.ts`
- `packages/db/src/schema/finding.ts`

**Akzeptanz-Test (Vitest):**

```ts
// apps/web/src/__tests__/api/findings-cross-module-links.test.ts
test("POST /findings persists controlId + GET returns it", ...)
test("PATCH /findings sets controlId post-create", ...)
test("Cascade picks up API-created critical finding", async () => {
  const before = await GET('/controls/effectiveness');
  await POST('/findings', { severity:'major_nonconformity', status:'open', controlId });
  const after = await GET('/controls/effectiveness');
  expect(after.openCriticalFindings).toBe(before.openCriticalFindings + 1);
});
```

**Done:** alle 3 Tests grün, Cowork-QA-Marathon-Cascade-Test reproduzierbar grün.

---

### W19-P2-01: `GET /admin/branding` 500

**Symptom:** `GET /api/v1/admin/branding → 500 "Internal server error"` (seit Wave 14)

**Vorgehen:** Server-Log mit RequestID inspizieren, Drizzle-Schema-Reference / Org-Scope-Filter prüfen. Falls Feature noch nicht implementiert → 501 Not Implemented statt 500.

**Suchpfade:** `apps/web/src/app/api/v1/admin/branding/route.ts`

**Done:** 200 mit valider Branding-Config-Response ODER 501 Not Implemented mit RFC-7807-Body.

---

## Block 2 — Wave 19 P3 (Polish + RBAC-Konsistenz)

### W19-P3-01: Contract-Schema-Drift dokumentieren

Field-Renames über die Wellen:

- Wave 14: `value`, `startDate`, `endDate`
- Wave 16: → `totalValue`, `effectiveDate`, `expirationDate`
- Wave 18: → `title` (war `name`)

**Erwartung:**

1. `CHANGELOG.md`-Eintrag pro Field-Rename (Pre-Release-Doku)
2. OpenAPI-Spec markiert die alten Namen als `deprecated` mit `x-deprecated-in: <version>` für 2 Releases
3. Zod-Schema akzeptiert beide für 1 Release mit Deprecation-Warn-Header in der Response

**Done:** CHANGELOG-Eintrag, OpenAPI updated, Backwards-Compat-Layer testet beide Namen, Hint im Header `Warning: 299 - "Use 'title' instead of 'name', deprecated since v0.2.0"`.

---

### W19-P3-02: CISO darf keine Findings raisen

**Symptom:** `POST /findings als ciso@meridian.test → 403`

CISO ist 2nd-Line, sollte Compliance-Verletzungen als Findings dokumentieren können.

**Suchpfade:** `apps/web/src/app/api/v1/findings/route.ts` POST-Handler `withAuth(...)`

**Done:** `POST /findings` als CISO → 201, Test in `domain-rbac-suite.test.ts` SPECS angepasst.

---

### W19-P3-03: ESG Datapoint-Discovery

**Symptom:**

```
POST /esg/metrics {name, category, unit, frequency}    → 422 {fieldErrors: {datapointId: ['Required']}}
GET /esg/datapoints                                     → leere data-Liste
```

Frontend kann den geforderten `datapointId` nicht auflösen.

**Vorgehen:**

1. `packages/db/sql/seed_esrs_datapoints.sql` wird im prod-seed nicht geladen — in `seed-all.ts` oder `seed.ts` ergänzen
2. `GET /esg/datapoints` mit ESRS-Datapoint-Liste anreichern
3. Discovery-Endpoint `GET /esg/metrics/schema` mit Body-Shape

**Done:** `GET /esg/datapoints` liefert ≥100 ESRS-Datapoints, `POST /esg/metrics` mit gültigem `datapointId` → 201, Body-Schema dokumentiert.

---

## Block 3 — Echte Workflow-Lücken (ungetestet, eventuell broken)

### W19-W5: Incident-Lifecycle E2E (NIST-7-State + DSGVO Art. 33)

**Lücke:** Marathon hat nur Discovery + Transitions-Schema markiert. Echte 7-State-Walk-Through + 72h-Countdown-Trigger nicht verifiziert.

**Verifikation:**

1. Login als `security_analyst@meridian.test` (falls existiert; sonst seed nachziehen)
2. `POST /isms/incidents {severity:'high', category:'data_breach', detectedAt:now}` → 201
3. Walk `detected → triage → investigating → contained → eradicated → recovered → lessons_learned → closed` über die Discovery/Transition-Endpoints
4. Beim Übergang zu `confirmed` (oder bei `category=data_breach`) muss ein `dsgvo_art_33_72h_deadline`-Feld gesetzt sein UND eine Notification an den DPO gehen
5. Beim Überschreiten der 72h soll `incident.escalation = 'dsgvo_overdue'` propagieren (testen mit `--time-warp` falls verfügbar, sonst per DB-Update simulieren)

**Erwartung Code:**

- 7-State + Discovery-Endpoint `/isms/incidents/{id}/transitions`
- 72h-Countdown im Schema (`dsgvoNotificationDueAt`)
- Notification-Trigger bei state-change → `confirmed`/`high-severity` an DPO
- Cron oder pg-trigger der `escalation`-Flag setzt

**Akzeptanz-Test:**

```ts
test("Incident state-machine full walk", ...)
test("Data-breach sets 72h deadline + notifies DPO", ...)
test("Overdue incident escalates", ...)
```

**Done:** 3 Tests grün, manueller Walk-Through dokumentiert.

---

### W19-W6: BIA-Gates unter Belastung

**Lücke:** Marathon hat Discovery + Transitions markiert. Echte Blocker-Bedingung (`processImpacts.scored = all`) nicht durch unvollständige BIA verifiziert.

**Verifikation:**

1. Login als `risk_manager@arctos.dev` oder `bcm_manager@meridian.test`
2. `POST /bcms/bia {name, scope}` → 201
3. `POST /bcms/bia/{id}/start` → 200, status: in_progress, blockers: enthalten `process_impacts_incomplete`
4. Versuche `POST /bcms/bia/{id}/approve` → 422 mit `blockers: ['process_impacts_incomplete']`
5. `POST /bcms/bia/{id}/process-impacts` mit allen Prozessen MTPD/RTO/RPO scoren
6. Versuche erneut `approve` → 200, status: approved

**Done:** Approval ohne vollständigen Impact-Scoring blockt (422), mit vollständig (200).

---

### W19-W7: Whistleblowing-Case-Triage E2E (HinSchG §§16/32)

**Lücke:** "Konzeptionell korrekt" markiert, nicht durchgespielt. HinSchG-Vertraulichkeit ist Compliance-kritisch.

**Verifikation:**

1. Anonymous-Intake: `POST /whistleblowing/intake/<org-code> {report}` → 201
2. Login als `whistleblowing@meridian.test` → Case sichtbar
3. Walk `received → triage → investigation → conclusion → closed`
4. **Cross-Role-Negativ-Test:** Login als CISO, Admin, DPO → kein Case-Detail-Read (`GET /whistleblowing/cases/{id}` muss für nicht-WB-Officer 403 sein, AUCH für admin)
5. Bei der Case-Visibility muss `disclosureScope: 'wb-officers-only'` greifen — Wave-12 hatte das markiert, jetzt verifizieren

**Done:** Case-Walk-Through durch, Cross-Role-Read als Admin BLOCKIERT (das ist der HinSchG-Punkt — auch der Plattform-Admin darf nicht in den Case rein).

---

### W19-W8: Multi-Tenant-RLS Cross-Tenant-Probe

**Lücke:** Alle Tests in Org `ccc4cc1c-...` (Meridian). Zweite Org + Cross-Tenant-Read-Attempt nicht verifiziert.

**Verifikation:**

1. Zweite Demo-Org seeden (falls noch nicht da): `Arctis Textil GmbH` oder `Arctos-Hardware-Demo`
2. User in Org-A erstellt Risk → bekommt `risk-A.id`
3. User in Org-B liest `GET /risks/risk-A.id` → muss 404 (oder 403) sein, niemals 200
4. Cross-tenant `GET /risks?orgId=<A>` als User-B → ignore-orgId-param, returns Org-B-Daten
5. RLS-Policy-Coverage über die 545 Tabellen prüfen — Wave 1 hatte `rls-coverage-report.md` markiert dass einige Tabellen ohne RLS sind

**Done:**

- Cross-tenant-read-attempt 404
- `docs/security/rls-coverage-report.md` ist 100 % covered (oder Lücken explizit als by-design markiert)
- Automatisierter RLS-Test pro Tabelle (Pattern-Test in `packages/db/src/__tests__/rls/*.test.ts`)

---

### W19-W9: Notifications + Email-Render-Trigger Live

**Lücke:** Test-Coverage hat Email-Templates abgedeckt, aber kein Live-Trigger verifiziert.

**Verifikation:**

1. Risk-Create mit ownerId-Assignment → owner muss Notification + Email bekommen
2. DSR-Create → DPO Notification + Email
3. Audit-Schedule → Auditor + Auditee Notifications
4. Incident-detected severity:high → CISO Notification

**Erwartung:**

- Notification-Tabelle hat Eintrag pro Trigger
- Resend-API wurde aufgerufen (auch wenn im Dev-Mode mit Console-Log statt SMTP)
- Email-Template rendert ohne Errors
- Notification-Mark-As-Read funktioniert

**Done:** 4 Trigger-Tests grün, Notification-Read-Flow verifiziert, Email-Templates rendern ohne Errors in `packages/email` Smoke-Tests.

---

### W19-W10: PDF-Exports mit Wave-18-Daten

**Lücke:** Wave 12 hat PDFs getestet, seitdem 25+ neue Risks, 5 Treatments, 23 Findings. Aktualität der Exports nicht verifiziert.

**Verifikation:**

1. `GET /reports/risk-register.pdf` → muss aktuelle 27+ Risks enthalten, NICHT nur die Seed-Daten
2. `GET /reports/audit-trail.pdf?from=2026-05-01&to=2026-05-15` → enthält alle Wave-18-Mutationen mit Hash-Chain-Verify
3. `GET /dpms/dpia/{id}/export` → PDF/A-konform, GoBD §147 erfüllt
4. `GET /audit-mgmt/audits/{id}/report.pdf` → mit allen Activities + Findings
5. PDF-File-Header check: `%PDF-1.4` oder höher, `pdfaid:part="2"` für PDF/A-2b

**Done:** 4 PDF-Exports liefern aktuelle Daten, alle PDF/A-konform, Hash-Chain-Signature in Audit-Trail-PDF eingebettet.

---

## Block 4 — Nice-to-Haves (jetzt schließen)

### W19-N1: UI-Form-Submissions mit React-Events

**Lücke:** UI-Spot-Checks nur, keine echten Form-State + Validation-Display + Optimistic-Updates getestet.

**Verifikation pro Modul-Page** (Risks, Controls, Findings, DPIAs, Audits, Vendors, Contracts):

1. Form öffnen via UI
2. Required-Field-Validation visualisiert (rote Border + Hint-Text)
3. Submit mit fehlendem Feld → kein API-Call, lokale Error-Display
4. Submit mit allen Feldern → Optimistic-Update (Liste zeigt neuen Eintrag SOFORT, vor API-Response)
5. API-Error → Optimistic-Update wird zurückgerollt + Error-Toast

**Erwartung:** Playwright-Tests in `apps/web/e2e/forms/*.spec.ts` für jede Form, mit React-Event-Trigger via `page.locator().fill()` (nicht `.value =`).

**Done:** 7 Forms × 5 Steps × 1 Test = 35 Playwright-Steps grün.

---

### W19-N2: AI-Router Live-Multi-Provider-Failover

**Lücke:** Privacy-Router in Test-Coverage abgedeckt, aber Live-Failover nicht verifiziert.

**Verifikation:**

1. Provider-A (Claude) künstlich auf timeout setzen
2. Request gegen `/ai/router/chat` → soll automatisch auf Provider-B (OpenAI) failover
3. Privacy-Tier hochstufen auf `confidential` → muss Ollama (local) wählen
4. Audit-Log enthält Provider-Selection mit Reason

**Done:** Failover-Test grün, Privacy-Routing-Test grün, Audit-Log-Eintrag pro AI-Request.

---

### W19-N3: Performance + Concurrent-Load

**Lücke:** Wave 6 Phase F hat mal Performance gemessen, nicht recent.

**Verifikation:**

1. K6 oder autocannon Load-Test gegen `GET /risks?limit=100` mit 50 concurrent users für 60s
2. P95-Latenz < 500ms, P99 < 1s, 0 Errors
3. Cross-Module-Aggregation `GET /controls/effectiveness` unter Last → P95 < 1s
4. Hash-Chain bleibt healthy unter Last
5. Memory-Leak-Check: Server-RSS stabilisiert sich nach 5min

**Done:** Load-Test-Report in `docs/performance/wave19-baseline.md` mit Charts.

---

### W19-N4: Programme-Maturity-Auto-Compute

**Lücke:** Marathon hat markiert: "Maturity-Auto-Berechnung aus Control-Effectiveness ist hardgecoded statt aus Daten abgeleitet".

**Erwartung:**

- `programme.maturityLevel` wird live aus Control-Effectiveness + Audit-Coverage + Risk-Treatment-Quote berechnet
- Per Phase (inception/planning/execution/certification/continuous_improvement) angepasste Berechnung
- Endpoint `GET /programmes/{id}/maturity-breakdown` zeigt die einzelnen Komponenten

**Done:** Programme-Detail-Page zeigt live-berechneten Wert, Berechnungs-Test in `packages/automation/src/__tests__/programme-maturity.test.ts`.

---

### W19-N5: Compliance-Framework-Cross-Mapping Spot-Check

**Lücke:** ~960 Cross-Framework-Mappings im Seed, nie verifiziert dass sie laufen.

**Verifikation:**

1. `GET /compliance/frameworks` → 46 Frameworks
2. Random-Sample 10 Controls mit Multi-Framework-Mapping (z.B. ISO 27001 A.5.1 ↔ BSI Grundschutz CON.1 ↔ NIS2 Art. 21)
3. Pro Mapping: Markiere Control als `effective` → muss in ALLEN gemappten Frameworks als "implementiert" zählen
4. `GET /compliance/coverage?framework=iso-27001` → korrekte Coverage-% pro Framework

**Done:** 10 Spot-Checks grün, Coverage-Endpoints liefern realistische %-Werte (nicht 0 oder 100).

---

### W19-N6: Academy/Training-Modul

**Lücke:** Module existiert (Sprint 46 Whistleblowing-Advanced erwähnt es), nie getestet.

**Verifikation:**

1. `GET /academy/courses` → Seed-Courses (gdpr, info_security, anti_corruption, ...)
2. `POST /academy/enrollments {courseId, userId}` als Department-Head → 201
3. `GET /academy/users/{userId}/progress` → 0%
4. `POST /academy/enrollments/{id}/complete` → 100%
5. Cross-Modul: `GET /users/{id}/compliance-trainings-overdue` → leer wenn alle complete

**Done:** Academy-Flow End-to-End grün, ggf. fehlende API-Routes implementieren.

---

### W19-N7: DMS Document-Management-Workflow

**Lücke:** Modul existiert (`packages/db/src/schema/document.ts` o.ä.), nicht getestet.

**Verifikation:**

1. `POST /dms/documents {title, type, file-base64}` → 201, gespeichert mit Hash
2. `POST /dms/documents/{id}/versions` → neue Version
3. `POST /dms/documents/{id}/sign` → Multi-Signer-Workflow
4. `GET /dms/documents/{id}/audit-trail` → wer hat wann was geändert
5. Cross-Modul: `POST /dms/documents {linkedRiskId}` → in Risk-Detail sichtbar

**Done:** DMS-CRUD + Versioning + Audit-Trail grün, oder Modul als "out of scope for v0.2" deklariert.

---

### W19-N8: Bulk-Operations + Bulk-Cap Re-Test

**Lücke:** Critical Implementation Rule #11 (Bulk-Cap) wurde mal getestet, nicht recent.

**Verifikation:**

1. `POST /risks/bulk` mit 50 Items → 201 (innerhalb cap)
2. `POST /risks/bulk` mit 500 Items → 422 (über cap), klare Error-Message mit `maxBulkSize: 100`
3. Bulk-Update + Bulk-Delete analog
4. Audit-Log enthält pro Bulk-Item einen Hash-Eintrag (nicht nur einen für die ganze Operation)

**Done:** Bulk-Tests grün für Risks, Controls, Findings, Treatments.

---

## Done-Kriterien für die Gesamt-PR

| Kategorie              | Done wenn                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Tests**              | Alle neuen Vitest + Playwright + RLS-Pattern-Tests grün. Coverage steigt nicht.                                                  |
| **Hash-Chain**         | `healthy=true, mismatches=0, v1=1229` nach allen Mutationen.                                                                     |
| **RBAC-Suite**         | `domain-rbac-suite.test.ts` SPECS für POST /findings ergänzt um CISO.                                                            |
| **Cascade-E2E**        | Cowork-QA-Marathon-Cascade-Test reproduzierbar: POST /findings {controlId, severity:critical} → +1 in `/controls/effectiveness`. |
| **RLS-Report**         | `docs/security/rls-coverage-report.md` zeigt 100% Coverage oder explizite Ausnahmen mit ADR-Reference.                           |
| **PDF/A**              | 4 PDF-Exports validieren als PDF/A-2b oder besser.                                                                               |
| **Performance**        | Load-Test-Report `docs/performance/wave19-baseline.md` mit P95/P99-Charts.                                                       |
| **CHANGELOG**          | Jeder API-Break + jedes neue Feature dokumentiert.                                                                               |
| **Migrations**         | Falls neue Tables/Spalten: Migration-Nummer ≥ 0325, idempotent, reversible-Note.                                                 |
| **Wave-18-Regression** | Alle 8 Marathon-Fixes von Wave 18 bleiben grün (re-run domain-rbac-suite).                                                       |

---

## Vorgehen (empfohlen)

**Tag 1-2: Block 1 (Beta-Blocker)**

- W19-P1-01 Finding-Cascade-Persistenz (am wichtigsten — schaltet Marathon-Pflanz frei)
- W19-P2-01 /admin/branding

**Tag 3: Block 2 (Polish)**

- W19-P3-01/02/03 — alle drei sind kleine Diffs

**Tag 4-6: Block 3 (Workflow-Lücken)**

- W19-W5 Incident → das ist ein größerer Brocken, vermutlich fehlt die 72h-Logik
- W19-W6 BIA-Gates
- W19-W7 Whistleblowing-Vertraulichkeit (HinSchG-Compliance-kritisch)
- W19-W8 RLS-Coverage (sicherheitskritisch)
- W19-W9 Notifications
- W19-W10 PDF-Exports

**Tag 7-10: Block 4 (Härtung)**

- W19-N1 UI-Forms (Playwright)
- W19-N2 AI-Router
- W19-N3 Performance
- W19-N4 Programme-Maturity
- W19-N5 Framework-Mappings
- W19-N6 Academy
- W19-N7 DMS (optional — falls Modul nicht im v0.2-Scope, als ADR markieren)
- W19-N8 Bulk

**Cowork QA verifiziert pro Block, nicht erst am Ende.** Drei separate PRs sind ok, oder ein Mega-PR — User-Entscheidung. Empfehlung: 3 PRs für besseres Review (Block 1+2 / Block 3 / Block 4).

---

## Test-Account-Cheat-Sheet (für Cowork-QA-Verifikation)

```
Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
Default Password (alle 9 Meridian-RBAC-User): WaveQA-2026!

Email                                Role                       LoD
─────────────────────────────────────────────────────────────────────
ciso@meridian.test                   ciso                       2nd
dpo@meridian.test                    dpo                        2nd
compliance@meridian.test             compliance_officer         2nd
auditor@meridian.test                auditor                    3rd
process-owner@meridian.test          process_owner              1st
vendor-mgr@meridian.test             vendor_manager (W18-added) 1st
esg@meridian.test                    esg_manager                2nd
whistleblowing@meridian.test         whistleblowing_officer     —
viewer@meridian.test                 viewer                     —

Plus:
admin@arctos.dev / admin123          admin                      —
risk.manager@arctos.dev / arctos2026!  risk_manager             2nd
auditor@arctos.dev / arctos2026!     auditor                    3rd
control.owner@arctos.dev / arctos2026! control_owner            1st
process.owner@arctos.dev / arctos2026! (existiert nicht in DB, vs. process-owner@meridian.test!)

Für W19-W7 Whistleblowing: Org-Code für anonymous-Intake aus
`SELECT org_code FROM organization WHERE id = 'ccc4cc1c-...'`
```

---

## Anti-Patterns (bitte vermeiden)

1. **Done-Markierung ohne Test.** Wenn ein Item "fixed" ist, ohne dass ein Test in der PR den Fix beweist — nicht mergen.
2. **Bulk-Migration ohne Idempotenz.** Jede Migration muss `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` oder explizite Up/Down-Skripte haben.
3. **RBAC-Liste ohne Test-Update.** Jede Änderung an `withAuth(...)` muss `domain-rbac-suite.test.ts` SPECS mit-aktualisieren — sonst regressionsbruch in 2 Wellen.
4. **`continue-on-error` in CI.** Wave-12-Lehre: nie wieder.
5. **Hash-Chain-Bypass.** Keine direkten DB-Mutations die den Trigger umgehen. Wenn doch nötig (z.B. Backfill), separate Migration mit Hash-Chain-Replay-Skript.

---

## Erfolgs-Meldung an Cowork QA

Nach Merge: Slack/Comment "Wave 19 + 20 closure deployed. Hash-chain integrity: <integrity-output>. Coverage delta: <delta>. New endpoints: <list>. Cowork QA bitte Verifikation Wave 19A starten."

Cowork QA fährt dann Verifikations-Marathon: alle 4 Blöcke durch, neue Befunde dokumentieren, dann ist die Plattform Pilot-Ready.

---

_Wave 19 + 20 Full-Closure-Prompt geschrieben von Cowork QA, 2026-05-15. Adressiert: 4 Wave-18-Restpunkte + 6 Workflow-Lücken + 8 Härtungs-Items = 18 Items total._
