# ARCTOS Wave 14 DEEP — Vollständiger Funktionstest

**Tester:** Cowork QA, Über-Nacht-Marathon
**Methodik:** Modul × CRUD × State × UI × Aggregation × Export × Form-Validation × Concurrent-Load
**Dauer:** ~1.5 h aktive Test-Zeit + Workflows
**Hash-Chain Final:** healthy=true, v1=1229, v2=354 (+58 durch Tests), 0 mismatches

---

## TL;DR

**Plattform ist nicht beta-ready.** Über die ohnehin bekannten UI-Blocker hinaus zeigen sich:

| Severity | Anzahl |
|---|---:|
| **P0 / Production-Blocker** | 4 |
| **P1 / Compliance-Risiko / Data-Loss** | 7 |
| **P2 / Funktionale Lücken** | 9 |
| **P3 / Polish** | 4 |

Der gravierendste neue Befund: **Bad client requests können den ganzen Server killen.**

---

## 🚨 P0 — Production-Blocker

### `#WAVE14D-P0-01` — Server-DoS durch UI-default `limit=500`

**Repro:** Ich habe 21 parallele Anfragen `?limit=500` auf verschiedene List-Endpoints geschickt. Server ging in 502 Bad Gateway. Nach 30 Sekunden Erholung. Hash-Chain blieb dabei intakt.

Im Normalbetrieb passiert das, weil das **UI alle Listen-Pages mit `?limit=500` aufruft** (siehe Wave-13-Network-Mitschnitt für `/risks`-Page) — und dabei werden mehrere Endpoints **simultan** vom Layout/Sidebar/Page-Code aufgerufen. Bei jeder Page-Navigation droht der Server ins Knie zu gehen.

**Konsequenz:** Plattform würde unter realer Nutzer-Last zusammenbrechen.

### `#WAVE14D-P0-02` — `limit=500` führt zu 500 empty body auf 19/21 List-Endpoints

| Endpoint | `?limit=500` Response |
|---|---|
| `/risks` | ✅ 422 RFC-7807 "must be <= 100" |
| `/controls` | ✅ 422 RFC-7807 |
| **alle anderen 19** | 🔴 **500 empty body** |

Nur `/risks` und `/controls` haben die Pagination-Max-Validation aus Wave 8 (#NIGHT-059) erhalten. Die übrigen 19 Listen-Endpoints (`/findings`, `/audits`, `/bcms/bia`, `/dpms/dpia`, `/isms/threats`, `/isms/vulnerabilities`, `/isms/incidents`, `/processes`, `/assets`, `/contracts`, `/vendors`, `/kris`, `/users`, `/organizations`, `/control-tests`, `/audit-log`, `/dpms/dsr`, `/dpms/ropa`, `/tasks`) **crashen ohne RFC-7807-Wrapper**.

### `#WAVE14D-P0-03` — UI-Pages zeigen "0 gesamt" weil API crasht

Konsequenz aus P0-01/02. Folgende UI-Pages zeigen leere Daten **obwohl die API-Direktabfrage Daten liefert**:

| UI-Page | API-Realität | UI-Anzeige |
|---|---:|---:|
| `/risks` | 23 Risks | "konnten nicht geladen werden" |
| `/controls` | 18 Controls | "0 Kontrollregister / konnten nicht geladen werden" |
| `/isms/threats` | 5 Threats | "0 gesamt / Keine Bedrohungen gefunden" |
| `/isms/vulnerabilities` | 4 Vulns | "0 gesamt / Keine Schwachstellen gefunden" |
| `/isms/incidents` | 2 Incidents | "0 gesamt / Keine Vorfälle gefunden" |

Endnutzer ohne API-Zugang sieht **leere Plattform**, obwohl Daten da sind. Catastrophic UX-Bug.

### `#WAVE14D-P0-04` — `POST /api/v1/dpms/dsr` → 500 empty body

DSR-Create (DSGVO Art. 15-21) crasht systematisch:
- Mit `{requestType:'access'}` → 422 (validation)
- Mit `{requestType, subjectName}` → **500 empty body**
- Mit allen sinnvollen Feldern (`requestType, subjectName, subjectEmail, receivedAt, description`) → **500 empty body**

DSR-Workflow ist via API komplett blockiert. Nur die 2 seeded DSRs sind nutzbar.

---

## 🔴 P1 — Compliance-Risiko / Data-Loss

### `#WAVE14D-P1-01` — `POST /findings {auditId}` ignoriert Cross-Module-Link silent

Body mit `auditId: <existing-audit-uuid>` wird akzeptiert (201 Created), aber das Finding hat `auditId: undefined` in der Response. Cross-Module-Link **stillschweigend verloren**.

Konsequenz: Audit-Findings können nicht zum Audit verknüpft werden. `/audits/{id}/findings` listet keine vom QA-Test erzeugten Findings.

### `#WAVE14D-P1-02` — Negative Contract-Values akzeptiert

```
POST /contracts {value: -1000} → 201 Created
```

Negativer Vertragswert wird akzeptiert. Business-Logik-Lücke: kein Contract sollte negative Werte haben (würde Portfolio-Aggregation verfälschen).

### `#WAVE14D-P1-03` — Contract endDate < startDate akzeptiert

```
POST /contracts {startDate: '2027-01-01', endDate: '2026-01-01'} → 201 Created
```

Verträge mit Ende-vor-Start werden akzeptiert. Verfälscht "Auslaufend (90 Tage)"-Aggregation, kann zu nicht-sinnvollen Mahn-Triggern führen.

### `#WAVE14D-P1-04` — BIA-Discovery-API liefert falschen Transition-Endpoint

Discovery sagt: `endpoint: PUT /api/v1/bcms/bia/{id}, method: PUT` für `draft → in_progress`.
Reality: PUT auf dem Endpoint mit `{status:'in_progress'}` → 422 "use POST /finalize" — aber `/finalize` ist `in_progress → approved`. **Es gibt keinen funktionierenden Pfad für draft→in_progress.**

Konsequenz: BIA bleibt in `draft` stuck. Workflow blockiert.

### `#WAVE14D-P1-05` — Audit-State `planned → fieldwork` blockiert ohne Discovery-Hilfe

`PUT /audit-mgmt/audits/{id}/status {status:'fieldwork'}` → 422 "Cannot transition from 'planned' to 'fieldwork'". Auch nach Setzen von `startDate`, `endDate`, `leadAuditorId` bleibt blockiert. Welche Pre-Conditions fehlen? **Discovery-API existiert nicht** (`/audit-mgmt/audits/{id}/transitions` → 404).

### `#WAVE14D-P1-06` — Whistleblowing-Intake-OrgCode nirgendwo discoverable

Vier sinnvolle Codes versucht (`MERIDIAN`, `meridian`, `demo`, `test`) — alle 404. Kein Endpoint liefert die gültigen Org-Codes. Whistleblowing-Intake ist **praktisch ausgeschaltet** ohne Doku.

### `#WAVE14D-P1-07` — `/dora/critical-vendors` 404

DORA-Critical-Vendors-Liste existiert nicht. Cross-Module-Verkettung TPRM-Critical → DORA fehlt komplett. **DORA-Compliance ohne kritische Vendor-Liste ist sinnlos.**

---

## 🟡 P2 — Funktionale Lücken

### `#WAVE14D-P2-01` — Audit-Mgmt fehlt `/transitions` Discovery

Andere 11 Module mit State haben `/transitions`. Audit fehlt. Inkonsistent.

### `#WAVE14D-P2-02` — `/tprm/concentration` returns null

Endpoint existiert, returnt aber `data: null`. Aggregation nicht implementiert. TPRM-Concentration ist eine BaFin-relevante DORA-Anforderung.

### `#WAVE14D-P2-03` — `/risks/heatmap` 422 ohne klare Doku

Endpoint braucht UUID-id-Param, lehnt aber jeden Versuch mit "must be valid UUID 8-4-4-4-12" ab. Was ist der id supposed to be? Risk-Owner? Org? Frame?

### `#WAVE14D-P2-04` — Mehrere Admin-Endpoints 404

- `/admin/branding` 404
- `/admin/calendar/holidays` 404
- `/admin/settings` 404
- `/admin/license` 404
- `/admin/integrations` 404

UI-Settings-Page (`/settings`) zeigt diese Bereiche als verfügbar.

### `#WAVE14D-P2-05` — Country-Code-Validation fehlt

`POST /vendors {country: 'XX'}` → 201 mit ungültigem Land "XX". Sollte ISO 3166-1 alpha-2 prüfen.

### `#WAVE14D-P2-06` — Risk impact/likelihood Range-Validation maskiert

`POST /risks {impact: -1, likelihood: 999}` → 422 aber mit Fehler "Owner not found" (anderer Fehler maskiert die ungültigen Zahlen). Zod-Schemas sollten Range zuerst prüfen.

### `#WAVE14D-P2-07` — `mark-all-read` Notification-Endpoint 404

`POST /api/v1/notifications/mark-all-read` → 404. Standard-Feature für Notification-Inboxes fehlt.

### `#WAVE14D-P2-08` — DPIA-Risk/Measure Body-Schema inkonsistent

`POST /dpia/{id}/risks` braucht `riskDescription` (nicht `description`).
`POST /dpia/{id}/measures` braucht `measureDescription` (nicht `description`).
Andere Module nutzen `description`. Inkonsistenz.

### `#WAVE14D-P2-09` — Audit-Activity-Schema `activityType` (nicht `type`)

`POST /audits/{id}/activities {type:...}` → 422. Erwartet `activityType`. Wieder Inkonsistenz mit dem Rest des Systems.

---

## 🔵 P3 — Polish

### `#WAVE14D-P3-01` — KRI-Werte: `thresholdHigh: undefined`

`/api/v1/kris` liefert Items aber `thresholdHigh: undefined` — Field-Naming mismatch oder ungefülltes Seed-Data.

### `#WAVE14D-P3-02` — DSR closed-State korrekt als terminal markiert

Wave-6-STATE-02-Feedback umgesetzt: DSR /transitions liefert `allowed: []` bei closed-State. Risk hingegen erlaubt `closed → identified` (was by-design ist).

Konsistent? Würde dokumentieren helfen.

### `#WAVE14D-P3-03` — Search-Pagination

Search returnt `totalResults` aber kein Pagination-Set. Bei vielen Ergebnissen unklar wie man weiterblättert.

### `#WAVE14D-P3-04` — Vendor-Type-Enum nicht discoverable

`POST /vendors {type: 'cloud_provider'}` works. Aber ich musste raten. Welche Vendor-Types sind erlaubt? Kein Discovery-Endpoint.

---

## ✅ Was funktioniert

### Workflow-State-Machines

| Modul | Erstellt | Workflow durch | Cross-Module-Effekt |
|---|:-:|---|:-:|
| **Risk** | ✅ | identified → assessed → treated → closed | ✅ Treatment + Heatmap-Aggregation |
| **Audit** | ✅ | Create only (fieldwork-transition blockiert) | partial |
| **DPIA** | ✅ | draft → in_progress ✅ | ✅ /dpms/dashboard reagiert |
| **DSR** | 🔴 | Create-500 | — |
| **Incident** | ✅ | NIST 7-State komplett | ✅ DSGVO Art. 33-Foundation steht |
| **BIA** | ✅ | Create only (in_progress blockiert) | partial |
| **Whistleblowing** | 🔴 | Intake-Code unbekannt | — |
| **Vendor** | ✅ | Create + transitions | ✅ /tprm/vendors-dashboard +1 |
| **Contract** | ✅ | Create | ✅ /contracts-Portfolio aggregiert |

### Aggregations-Korrektheit (geprüft)

| Aggregation | Erwartet | Gemessen | Match |
|---|---|---|---|
| Vendors total | API:7 | Dashboard:7 | ✅ |
| Vendor-Tiers (2+2+3) | API:7 | Dashboard sum:7 | ✅ |
| ROPA | API:5 | Dashboard:5 | ✅ |
| Findings | API:11 (10 baseline + W2) | grc-findings-UI:14 (incl. derived) | 🟡 partial |
| Risks Status-Verteilung | identified:8, assessed:12, treated:2, closed:1 | dashboard-summary korrekt | ✅ |
| Audit-Universe-Coverage | 5 items, 4 with last-audit | 80% | ✅ |
| BCMS BIA-Vollständigkeit | 3 essentialProcesses, 57% | dashboard match | ✅ |
| Controls Effectiveness | 18 controls, 6 tests, 83% | dashboard match | ✅ |

### Cross-Module-Verkettung

| Source | Target | Status |
|---|---|:-:|
| Risk → Treatment | Verkettung via /risks/{id}/treatments | ✅ |
| Risk → audit-impact-summary | aggregiert offene Findings auf Risk | ✅ |
| Vendor (created) | /vendors/dashboard, /tprm-UI | ✅ |
| Contract (created) | /contracts-Portfolio (372k EUR) | ✅ |
| Control → Findings (1 Linked) | /controls/{id}/findings | ✅ |
| Audit → Findings (via Body-auditId) | 🔴 silent-verloren | ❌ |
| Vendor critical → DORA | /dora/critical-vendors fehlt | ❌ |
| BIA Process-Impact → ISMS-Schutzbedarf | nicht prüfbar (DSR blocked) | — |

### UI-Pages — funktional getestet

| Page | Daten korrekt | Wave14-Testdaten sichtbar |
|---|:-:|:-:|
| `/dashboard` | ✅ | n/a |
| `/risks` | 🔴 **BROKEN** | nicht sichtbar |
| `/controls` | 🔴 **BROKEN** | n/a |
| `/grc-findings` | ✅ | Wave14-W2-Finding ✓ |
| `/audit` | ✅ | mein W2-Audit gezählt |
| `/bcms/bia` | ✅ | Wave14-W6-BIA ✓ |
| `/bcms/crisis` | ✅ | (no Wave14 add) |
| `/bcms/exercises` | ✅ | (no Wave14 add) |
| `/dpms/dpia` | ✅ | Wave14-W3-DPIA in "in progress" ✓ |
| `/dpms/dsr` | ✅ | (DSR-Create blocked) |
| `/dpms/ropa` | ✅ | n/a |
| `/isms/threats` | 🔴 **BROKEN** | API hat 5, UI zeigt 0 |
| `/isms/vulnerabilities` | 🔴 **BROKEN** | API hat 4, UI zeigt 0 |
| `/isms/incidents` | 🔴 **BROKEN** | API hat 2, UI zeigt 0 (W5-Closed dabei!) |
| `/isms/playbooks` | ✅ | (empty as expected) |
| `/processes` | ✅ | 3 listed |
| `/contracts` | ✅ | 372k EUR aggregiert |
| `/tprm` | ✅ | 7 vendors |
| `/whistleblowing/cases` | ✅ | 0 cases |
| `/audit-log` | ✅ | 1574 entries |
| `/grc-findings` | ✅ | 14 findings cross-module |
| `/programmes` | ✅ | 3 journeys, 11 templates |
| `/users` | ✅ | 24 users |

### Form-Validation Strict

- ✅ Required-Fields enforced (`title`, `riskCategory`, `riskSource`)
- ✅ Enum-Validation mit clearen Werten in Error
- ✅ Length-Cap auf Title (500 chars max)
- ✅ Risk impact=0 rejected (mit anderem Fehler maskiert, aber rejected)
- ✅ Incident detectedAt in der Zukunft → 400 (rejected)

### Performance

- 20 concurrent risk-list reads: 1146 ms (avg 57 ms each)
- 5 concurrent PUT-mutations: 649 ms, alle 200, Hash-Chain stayed healthy
- Burst von 21 `limit=500` Anfragen: Server kollabierte mit 502 für 30s

### Security / RBAC

- ✅ Multi-Tenant-Isolation: Switch-Org enforced, X-Org-Id-Header ignored
- ✅ Permission-Boundaries clean (Wave-13-RBAC-Tests bestätigen)
- ✅ Audit-Hash-Chain unbeschädigt durch alle Test-Mutationen
- ✅ Tamper-Resistance: DELETE/PUT/POST auf audit-log blockt

### Reports/Exports

- ✅ PDF-Pipeline: 3/3 Endpoints liefern echtes PDF mit Magic-Bytes
- ✅ CSV-Exports: Risks (24 lines incl. W1), Findings (12 lines incl. W2)
- ✅ ROPA-Export, ESG-Export, BIA-Export funktional (3-4 von 4)
- ✅ Wave14-Testdaten propagieren in alle Exports

---

## Priorisierung für Wave 15

### Hot-Fix-Sprint

1. **`#WAVE14D-P0-01/02/03`** — `limit=500`-Wrapper-Crash
   - Schritt 1: Alle 19 Listen-Endpoints müssen die Wave-8-Max-Limit-Validation bekommen (422 statt 500)
   - Schritt 2: UI-Code muss auf `limit=100` umgestellt werden (oder paginiert)
   - Schritt 3: Server-side `withErrorHandler` muss auch über `limit=N` Cases wrappen

2. **`#WAVE14D-P0-04`** — DSR-Create 500
   - Mit `requestId` aus Server-Logs den Crash lokalisieren

3. **`#WAVE14D-P1-01`** — Audit-Finding silent-link-loss
   - `POST /findings {auditId}` muss `auditId` persistieren
   - Cross-Module-Schema enforce

4. **`#WAVE14D-P1-04`** — BIA-Discovery falscher Endpoint
   - Discovery-API muss korrekten Transition-Pfad zeigen (POST mit korrektem path)

5. **`#WAVE14D-P1-02/03`** — Contract-Value-Validation
   - `value >= 0` und `endDate > startDate` als Zod-Constraints

### Wave 15 Akzeptanzkriterien

- Alle UI-List-Pages laden Daten korrekt
- `limit=500` returnt überall 422 RFC-7807
- DSR-Create funktioniert
- Audit-Finding-Link nicht silent verloren
- BIA-Workflow durchgängig nutzbar
- Hash-Chain bleibt healthy unter Wave-15-Last

---

## Hash-Chain Status (Final)

Start: v1=1229, v2=296
Nach Wave 14 DEEP: v1=1229, v2=354, total=1583, healthy=true, 0 mismatches

**+58 v2-Entries** durch Wave-14-Mutationen. Chain blieb 100% verifizierbar auch unter Stress-Tests (Concurrent-Writes, 502-Recovery, Workflow-Transitions).

Hash-Chain ist die einzige Säule die seit Wave 10 production-stabil ist.

---

## Empfehlung an Johannes

**Plattform-Stand: Alpha, mit signifikanten Lücken in der Cross-Module-Integration und UI-API-Kohärenz.**

Die größten Probleme:
1. **UI-API-Mismatch** auf den Hauptseiten (`/risks`, `/controls`, alle `/isms`-Subs)
2. **Server-side Pagination-Validation nur halb implementiert** (2/21 Endpoints)
3. **Cross-Module-Links silent verloren** (Audit→Finding)
4. **DSR-Create komplett broken**
5. **BIA-Workflow blockiert wegen falscher Discovery-API**

Diese fünf Punkte machen die Plattform für Endnutzer unbenutzbar. Server-Backend ist hochwertig (Validation, Hash-Chain, State-Machines, RBAC), aber die Integration zwischen UI und Backend hat seit Wave 13 nicht aufgeholt.

Für Beta-Readiness: **mindestens 2 weitere Sprints** mit Fokus auf UI-API-Sync + Cross-Module-Persistence.

---

*Wave 14 DEEP abgeschlossen. 24 Findings über alle Severities. Hash-Chain healthy. Detailaufnahme der echten User-Experience zeigt: Plattform funktional alpha, nicht beta.*

---

## Anhang — Zusätzliche Tests (Phase 14/15)

### Soft-Delete + Audit-Trail
- ✅ POST Risk → DELETE → GET 404 → Audit-Log enthält delete-Eintrag mit `changes: {deleted_at, deleted_by, updated_at}`
- 🟡 Kein `/restore`-Endpoint (404) — Recovery vor Tombstoning nicht implementiert

### Reports / Archives
- ✅ Audit-Log-Archive ZIP: 531 KB, valid ZIP magic (PK)
- ✅ Anchor: 200, leafCount=1349, neuer Merkle-Root
- ✅ Calendar: 200 mit data (war Wave-8 noch 500 — gefixt!)
- ✅ Framework-Mappings: 88 mappings (nist_csf_2 → iso27002_2022)
- ✅ Catalogs: 845 catalog-Frameworks (entspricht dem CLAUDE.md-Stand "130+ Frameworks")

### Settings + Admin
- ✅ `/settings`: vollständig strukturierte Hub-Page (Plattform & Organisation, Nutzer/Rollen/Zugriff, ...)
- ✅ `/admin/connectors`: Enterprise-Konnektoren (0 verfügbar — by-design)
- ✅ `/admin/abac`: ABAC-Empty-State mit Konzept-Erklärung
- 🟡 `/marketplace`: nur Stub "marketplace / Modul aktivieren" — Module-Gate

### UI-Sub-Pages (zusätzliche)
- ✅ `/audit/universe`, `/audit/plans`, `/audit/executions`: alle funktional
- 🔴 `/controls/rcm`: mainLen=0, **komplett leer** (kein Render)
- ⚠️ `/controls/findings`: zeigt "0 Feststellungen gesamt" — vermutlich falscher Filter (es gibt 11 Findings im System)
- ⚠️ `/processes/governance`: "GESAMTPROZESSE 0" — falsche Aggregation (3 Prozesse existieren)
- ✅ `/controls/evidence`, `/controls/campaigns`: Empty-State korrekt für 0 Items
- ✅ `/dpms/tia`: TIA-Page funktional
- ✅ `/esg/materiality`: CSRD-Wesentlichkeitsanalyse-Page

### Zusätzliche Findings

- **`#WAVE14D-P0-05`** — `/controls/rcm` rendert **komplett leer** (mainLen 0)
- **`#WAVE14D-P1-08`** — `/controls/findings` zeigt 0, obwohl 11 Findings im System (vermutlich `source:'ICS'`-Filter mismatch)
- **`#WAVE14D-P1-09`** — `/processes/governance` zeigt "GESAMTPROZESSE 0" — Aggregation-Bug

### Process-Versioning
- ✅ Process-versioning aktiv: v1 für seeded process

### KRI-Inventur
- ✅ 6 KRIs gefunden: "Mean Time to Patch Critical Vulns" (65 hours), "Single-Source Supplier Count" (3), "Open GDPR Findings" (2), "Key Position Vacancy Rate" (8%), "Cloud SLA Breach Count" (1)
- ✅ KRI-measurements-Endpoint funktional
- ❌ `/kris/{id}/history` 404 (nur measurements vorhanden)

### Hash-Chain Final

Vor Wave 14 DEEP-Tests: v2=345
Nach allen Tests: v2=360 (+15 weitere Mutationen)
- Total: 1589
- healthy: true
- 0 mismatches
- Plus 1 Anchor erfolgreich aufgenommen (Merkle-Root für 1349 Leaves)

---

## Final Verdict & Action-Items

### Wave 15 P0-Hot-Fix (Reihenfolge entscheidet)

1. **`limit=500` Server-side cap auf alle 19 Endpoints ziehen** + UI auf `limit=100` umstellen
2. **DSR-Create-500** debuggen mit Server-Logs
3. **Audit→Finding silent-link-loss** fixen
4. **`/controls/rcm` UI repair** (page renders nothing)
5. **BIA Discovery-API korrigieren** (zeigt falschen Transition-Pfad)

### Wave 15 P1

6. **Contract-Validation**: `value >= 0`, `endDate > startDate`
7. **`/controls/findings` und `/processes/governance` Aggregation** fixen (0 angezeigt obwohl Daten existieren)
8. **DORA `/critical-vendors`** implementieren
9. **`/risks/heatmap`** dokumentieren (welcher ID-Param?)
10. **`/tprm/concentration`** nicht-null-Aggregation

### Wave 15 P2/P3

11. Polish: Admin-Endpoint-404s, KRI-history, Schema-Naming-Konsistenz, mark-all-read

---

*Cowork QA Über-Nacht-Marathon abgeschlossen. Detail-Findings nach 1.5h aktiver Test-Zeit. Plattform-Stand: Alpha mit beachtlichen UI-API-Sync-Lücken.*
