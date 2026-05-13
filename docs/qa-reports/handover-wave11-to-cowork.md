# Wave 11 → Cowork QA Handover

**Stand:** 2026-05-13 nach Merge von #140, #142, #143, #144 in `main`.
**Voraussetzung für Testing:** `arctos-update` auf Hetzner gelaufen (Migrationen 0314 / 0315 / 0316 angewendet).

---

## Was sich geändert hat

### Hash-Chain (P0 abgeschlossen, Wave 9 + 10 hatten den Hauptteil)

Keine neuen Änderungen in Wave 11 — Status sollte aus Wave 10 erhalten bleiben:

- `GET /api/v1/audit-log/integrity` → `200 healthy: true`
- `chainMismatches: []`, `rowMismatches: []`
- `POST /api/v1/audit-log/anchor` → 200 (oder 409 mit Counts wenn broken)

**Regression-Check:** 5–10 Mutationen (Risk-Status, BIA, DPIA, Finding) → integrity bleibt healthy.

### PDF-Pipeline (#WAVE6-EXPORT-01)

3 Endpoints liefern jetzt **echte PDFs** (pdfkit, kein Puppeteer mehr):

```
GET /api/v1/dpms/dpia/{id}/export-pdf
GET /api/v1/dpms/annual-report/2026/pdf
GET /api/v1/ai-act/annual-report/2026/pdf
```

**Akzeptanz pro Endpoint:**

- `Content-Type: application/pdf`
- Erste 4 Bytes = `%PDF`
- Datei in Acrobat / Preview öffnet
- `Content-Disposition: attachment; filename="…pdf"`

**Bei Render-Fehler:** `503 application/problem+json` mit `requestId` (KEIN HTML-Fallback mehr — wenn 200 dann ist's eine PDF, sonst 503 mit klarer Fehlermeldung).

### Incident State-Machine (#WAVE6-STATE-01)

Zwei neue Routes:

```
GET  /api/v1/isms/incidents/{id}/transitions
POST /api/v1/isms/incidents/{id}/notify-authority
```

**`/transitions`** liefert: `current`, `knownStatuses` (7 Werte), `allowedNext` (subset basierend auf Matrix), `endpoint: ".../status"`, `method: PUT`, `bodyShape`, plus `sideChannels.notifyAuthority`.

**`/notify-authority`** Body: `{ authority, notifiedAt?, reason }` — `reason` ist Pflicht. Response enthält `compliance: { status: "within_72h" | "overdue", hoursBeforeDeadline | hoursLate }` automatisch berechnet aus `incident.detectedAt + 72h`.

**Test-Flow:**

1. POST `/intake/submit` (oder Incident manuell anlegen)
2. GET `/transitions` → confirm shape
3. PUT `/status { status: "triaged" }` (oder andere allowed-next)
4. POST `/notify-authority { authority: "Datenschutzbehörde", reason: "DSGVO Art. 33" }` → expect `compliance.status`

### State-Machines für 4 weitere Module

Neue `/transitions`-Discovery-Routes (gleiches Schema wie Findings/Vulnerabilities/Controls):

```
GET /api/v1/vendors/{id}/transitions
GET /api/v1/contracts/{id}/transitions
GET /api/v1/processes/{id}/transitions
GET /api/v1/dpms/dsr/{id}/transitions    ← mit sideChannels für /verify, /respond, /close
```

**Stateless** (keine `/transitions`, by design, dokumentiert in `docs/state-machine-pattern.md`):

- Asset
- Threat

### Export-Endpoints (#WAVE6-EXPORT-02)

| Endpoint                                 | Wave 10                                         | Wave 11                                                        |
| ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `GET /api/v1/export/incident?format=csv` | 500 (`relation "incident" does not exist`)      | 200 mit CSV                                                    |
| `GET /api/v1/export/bia?format=csv`      | 400 unknown entity                              | 200 mit CSV                                                    |
| `GET /api/v1/export/finding?format=csv`  | 400 unknown entity                              | 200 mit CSV                                                    |
| `GET /api/v1/esg/report/2026/export`     | 405                                             | 200 mit `meta.kind: "preview"`                                 |
| `POST /api/v1/esg/report/2026/export`    | 200                                             | 200 mit `meta.kind: "recorded_export"` (stempelt `exportedAt`) |
| Generische Export-Crashes                | `500 { error, details: e.message }` (info leak) | RFC 7807 problem+json mit `requestId`                          |

**Test:** Jeder Export-Endpoint mit `format=csv` und `format=xlsx` durchprobieren. Bei csv: erste Zeile sind die deutschen Spalten-Header (Titel/Beschreibung/Status/...). Bei xlsx: validate dass die Datei in Excel öffnet.

### RBAC Test-Users (#WAVE6-RBAC-01)

Migration 0316 hat **13 Test-User** in der Demo-Org `ccc4cc1c-…` angelegt — einer pro Rolle, die noch nicht durch 0300 abgedeckt war:

| Email                                     | Rolle                  | Line of Defense |
| ----------------------------------------- | ---------------------- | --------------- |
| `rbac-viewer@arctos.test`                 | viewer                 | —               |
| `rbac-esg-manager@arctos.test`            | esg_manager            | second          |
| `rbac-esg-contributor@arctos.test`        | esg_contributor        | first           |
| `rbac-whistleblowing-officer@arctos.test` | whistleblowing_officer | —               |
| `rbac-ombudsperson@arctos.test`           | ombudsperson           | —               |
| `rbac-compliance-officer@arctos.test`     | compliance_officer     | second          |
| `rbac-ciso@arctos.test`                   | ciso                   | second          |
| `rbac-bcm-manager@arctos.test`            | bcm_manager            | second          |
| `rbac-contract-manager@arctos.test`       | contract_manager       | first           |
| `rbac-quality-manager@arctos.test`        | quality_manager        | second          |
| `rbac-security-analyst@arctos.test`       | security_analyst       | first           |
| `rbac-department-head@arctos.test`        | department_head        | first           |
| `rbac-external-auditor@arctos.test`       | external_auditor       | third           |

**Wichtig:** Diese User haben `password_hash = 'rbac_test_seed_no_login'` — kein interaktiver Login. Sie sind für **Permission-Matrix-Tests** gedacht (z.B. via JWT-Mock oder direkter `withAuth(<role>)`-Aufruf in Tests). Die ERM-Rollen (admin, risk_manager, control_owner, auditor, dpo, process_owner) sind weiterhin in 0300 vorhanden.

**Neue Discovery-Route:**

```
GET /api/v1/users/{id}/roles
```

Liefert `[{ orgId, orgName, role, lineOfDefense, department, createdAt }]`.
Berechtigung: Self-Read ODER admin im aktuellen Org. Sonst 403.

### CodeQL & Security

In Wave 11 closed:

- `js/stack-trace-exposure` (high) — 500 / 503 Responses leaken keine `e.message` mehr; nur `requestId` + generische detail-Strings. Bei 503 für unhandled errors steht der echte Fehler im **Server-Log** mit dem `requestId` als Korrelations-Key.
- `js/double-escaping` (high) — pdf.ts entity decoder.
- 10 unused-import notes.
- RLS coverage gap: 142 Tabellen ohne RLS → 0. Migration 0315 enabled RLS + 4 Policies (select/insert/update/delete) auf jede tenant-scoped Tabelle.

---

## Bekannte offene Punkte

**Nicht in Wave 11 gemacht** (separate Sprints, nicht beta-blocking):

- Audit-Trigger-Coverage: 180 Tabellen haben jetzt RLS aber keinen `audit_trigger()` registriert. Datenmutationen auf diesen Tabellen werden also weiterhin nicht in `audit_log` gespiegelt. Separate Migration nötig.
- Echte Login-Credentials für die 13 RBAC-Test-User (aktuell nur Permission-Matrix, kein Login).
- BIA / Finding **import** (CSV → DB) — aktuell nur Export. Import-Pipeline für diese beiden ist noch nicht fertig.

---

## Test-Akzeptanz-Liste (Vorschlag für Wave 12)

- [ ] Hash-Chain bleibt healthy nach 10 Mutationen
- [ ] PDF-Endpoints liefern `application/pdf` + valide PDF-Magic-Bytes
- [ ] Incident `/transitions` + `/notify-authority` E2E inklusive 72h-Fenster (über und unter)
- [ ] `/transitions` bei den 4 neuen Modulen (Vendor/Contract/Process/DSR)
- [ ] Export-Endpoints (incident/bia/finding) liefern CSV + XLSX
- [ ] ESG-Export GET vs POST Differenz im `meta.kind`
- [ ] `/users/{id}/roles` self-read + 403 für non-admin auf andere User
- [ ] Permission-Matrix-Tests mit den 13 neuen Seed-Usern
- [ ] CodeQL-Reports auf main grün (nichts neues an stack-trace-exposure)
- [ ] RLS-Coverage bleibt 0 missing (oder document if drift)

---

## Wenn etwas crashed

Alle catch-Blöcke logen jetzt `requestId` + vollen Stack server-side, geben aber **nur** `requestId` + generischen detail-String zurück. Bei jedem 500/503 Response:

1. Notiere `requestId` aus der Response
2. Operator kann via `grep <requestId> <log-stream>` den vollen Fehler finden
3. Bei `application/problem+json`: `cause` field enthält pgCode wenn DB-Fehler

Nicht mehr (wie früher) der Versuch die `details: e.message` aus der Response selbst zu lesen — das ist absichtlich entfernt für info-disclosure-Schutz.

---

_Wave 11 zur QA freigegeben. Bei Findings: neuer Bericht in `docs/qa-reports/arctos-qa-verification-2026-05-XX-waveYY.md`._
