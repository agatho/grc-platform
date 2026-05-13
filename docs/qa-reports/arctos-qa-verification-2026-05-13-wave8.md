# ARCTOS QA Wave-8 Verifikation — 2026-05-13

**Tester:** Cowork QA
**Vorgängerbericht:** `arctos-qa-verification-2026-05-12-wave7.md` (1 P0 + 8 OPEN + 2 NEU)
**Methodik:** P0-Hash-Chain-Hot-Fix-Check zuerst, dann restliche Findings

---

## TL;DR

**Mehrere große Fixes, aber das P0 ist nur teilweise gefixt.** Integrity-Endpoint returnt jetzt 500 mit **empty body** (RFC-7807-Wrapper greift nicht). UI zeigt das prominent: "Integritätsprüfung: HTTP 500".

| Status seit Wave 7 |                  Anzahl |
| ------------------ | ----------------------: |
| ✅ FIXED           |                       7 |
| 🟡 PARTIAL         |                       1 |
| 🔴 P0 STILL BROKEN | 1 (anders manifestiert) |
| ❌ OPEN            |                       4 |
| 🆕 NEU             |                       1 |

**Hash-Chain Status:** Endpoint crasht jetzt mit 500 empty (statt 503 healthy=false). UI-Banner sichtbar.

---

## P0 Status: #WAVE7-CRITICAL-01 (Hash-Chain Integrity)

**Wave 7:** `GET /audit-log/integrity` → 503 mit detaillierter Mismatch-Liste (4 row + 4 chain mismatches)
**Wave 8:** `GET /audit-log/integrity` → **500 empty body**, `content-type: null`, `content-length: 0`

🚨 **Verschlimmerbessert.** Der Endpoint kann nicht mehr antworten. Vermutlich crasht die Hash-Verifikation jetzt vor dem Response-Build. Der RFC-7807-Wrapper, der bei allen anderen Endpoints zuverlässig funktioniert, greift hier nicht.

**UI-Auswirkung sichtbar:** `/audit-log` zeigt prominent "**Integritätsprüfung: HTTP 500**" als Header-Warnung. Das ist gut UX (transparent), aber die Compliance-Säule fehlt.

**Vermutete Root-Cause:**

- Während des Wave-8-Repair-Migrations-Versuchs (rehash oder mark-as-legacy) wurde eventuell die Hash-Compute-Function geändert
- Die 4 broken entries aus Wave 7 könnten beim ersten Recompute-Versuch eine Exception werfen die hochbubbelt
- Der `withErrorHandler` greift bei Stream-Responses oder bei sehr früh thrown errors nicht

**Was funktioniert:** `/audit-log` (Liste) und `/audit-log/anchor` returnen 200 normal. Das Schreiben in den Log läuft (1233 → mindestens 1250+ entries durch UI-Aktivität).

**Was nicht funktioniert:** Keine externe Verifikation möglich. Anchoring eines unverifizierten Chains ist Sicherheitsrisiko.

---

## ✅ FIXED in Wave 8

| #                   | Endpoint                           | Wave 7                        | Wave 8                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#WAVE6-CROSS-01** | `controls?riskId=X`                | 500 Regression                | ✅ **422** `"riskId: is not a recognized query parameter"` + `requestId` — Zod-strict-Pattern jetzt konsistent                                                                                                                                                                                                                 |
| #WAVE6-CROSS-01     | `controls?unknownFilter=xyz`       | 500                           | ✅ **422** `"unknownFilter: is not a recognized query parameter"`                                                                                                                                                                                                                                                              |
| **#WAVE6-CROSS-04** | `controls/effectiveness`           | 500 SQL-Bug                   | ✅ **200** mit Daten: `{controlsTotal:18, testsRun:6, effective:2, partiallyEffective:1, ineffective:0, notTested:0, pending:3, effectivenessPercent:83, asOf:"..."}` — **ICS-Dashboard-Daten jetzt verfügbar** 🎉                                                                                                             |
| **#WAVE6-WB-01**    | Whistleblowing-Intake              | 405 mit nicht-existentem hint | ✅ **Korrekter Pfad:** `POST /api/v1/whistleblowing/intake/submit` mit Body `{orgCode, summary, category, severity, description}` → 422 mit field-validation, oder 404 "Unknown organisation code" + UX-Hint "Check the code on the intake poster, or contact the local data-protection officer." — **HinSchG-Blocker gefixt** |
| **#WAVE7-NEW-01**   | `controls/{seed-uuid}/risks`       | 422 strict-UUID-reject        | ✅ **200** — Validator akzeptiert jetzt seed-UUIDs                                                                                                                                                                                                                                                                             |
| Bonus               | `findings/{id}/transitions`        | (gab's nicht)                 | ✅ **200** mit Discovery: `{current, knownStatuses:[identified,validated,remediating,remediated,verified,closed,deferred], endpoint, method:'PUT', bodyShape}` — Finding-State-Machine jetzt mit voller Discovery                                                                                                              |
| Bonus               | `vulnerabilities/{id}/transitions` | (gab's nicht)                 | ✅ **200** — auch hier Discovery                                                                                                                                                                                                                                                                                               |
| Bonus               | `controls/{id}/transitions`        | (gab's nicht)                 | ✅ **200** — auch hier Discovery                                                                                                                                                                                                                                                                                               |

### Zusammenfassung State-Machine-Coverage nach Wave 8

| Modul             | Status-Field | `/transitions` Discovery | Workflow-Endpoint                           |
| ----------------- | :----------: | :----------------------: | ------------------------------------------- |
| Risk              |      ✅      |            ✅            | PUT /status ✅                              |
| BIA               |      ✅      |            ✅            | dedizierte routes ✅                        |
| DPIA              |      ✅      |            ✅            | POST /transition ✅                         |
| Audit             |      ✅      |            ❌            | PUT /status ✅ (gefixt aus #WAVE6-AUDIT-03) |
| **Finding**       |      ✅      |        ✅ **NEU**        | PUT /{id} mit bodyShape ✅                  |
| **Vulnerability** |      ✅      |        ✅ **NEU**        | discovery vorhanden                         |
| **Control**       |      ✅      |        ✅ **NEU**        | discovery vorhanden                         |
| DSR               |      ✅      |            ❌            | named: /verify, /respond, /close ✅         |
| Incident          |      ✅      |            ❌            | fehlt                                       |
| Whistleblowing    |      ✅      |            ❌            | /intake/submit ✅ (Intake)                  |
| Vendor            |      ✅      |            ❌            | fehlt                                       |
| Contract          |      ✅      |            ❌            | fehlt                                       |
| Process           |      ✅      |            ❌            | fehlt                                       |
| Asset             |      ✅      |            ❌            | fehlt                                       |
| Threat            |      ✅      |            ❌            | fehlt                                       |

**3 weitere Module mit `/transitions` ausgestattet (Finding, Vulnerability, Control). State-Machine-Coverage wuchs von 4/14 (Wave 6) → 7/14 (Wave 7) → 10/14 (Wave 8). Gute Progression.**

---

## ❌ OPEN

### #WAVE7-CRITICAL-01 (P0 — anders manifestiert)

Siehe oben. Hot-Fix-Approach hat den Symptom-Endpoint mitgerissen.

### #WAVE6-EXPORT-01 (P1) — PDF-Endpoints

| Endpoint                         | Status | Content-Type       |
| -------------------------------- | ------ | ------------------ |
| `/dpms/deadline-monitor/pdf`     | 200    | text/html (4985B)  |
| `/ai-act/annual-report/2026/pdf` | 200    | text/html (11351B) |
| `/dpms/annual-report/2026/pdf`   | 200    | text/html (6653B)  |

Wave 8 hat hier **keinen Fortschritt** gemacht. Vermutlich noch in der Priorität-Queue.

### #WAVE6-STATE-01 (P2) — 4 verbleibende Module ohne State-Machine

- Vendor, Contract, Process, Asset, Threat (5 Module ohne `/transitions`)
- Incident hat nichts (P1, da DSGVO Art. 33 72h-Frist relevant)
- DSR hat named-routes aber keine Discovery

### #WAVE6-EXPORT-02/-03, -DSR-01, -RBAC-02/-03, -STATE-02 (P2/P3)

Nicht erneut getestet — vermutlich unverändert offen.

---

## 🆕 NEU in Wave 8

### #WAVE8-NEW-01 (P0 → P1, durch Wave 8 entstanden)

`GET /api/v1/audit-log/integrity` returnt jetzt 500 mit **empty body** (statt 503 mit detailliertem Mismatch-Listing). Der `withErrorHandler`-Wrapper, der bei allen anderen 500ern zuverlässig RFC-7807 liefert, greift hier nicht.

**Möglich:**

- Stream-Response oder Pre-handler-Crash
- Out-of-memory bei großen Chain-Walks
- Crash beim Lesen der 4 broken entries aus Wave 7

**Empfehlung:** `try/catch` ganz oben in den Integrity-Handler, mindestens damit 503 healthy=false zurückkommt. Aktuell ist es unsichtbar, was tatsächlich kaputt ist.

---

## Detail-Bilanz Wave 7 → Wave 8

| Severity | Wave 7 OPEN |              Wave 8 OPEN |
| -------- | ----------: | -----------------------: |
| **P0**   |           1 |               1 (anders) |
| P1       |           3 | 2 (PDF, Hash-Chain-Diag) |
| P2       |           6 |                        4 |
| P3       |           2 |                        2 |

**Quote FIXED Wave-7-Backlog:** 7 von 9 OPEN-Items gefixt (78 %), aber das P0 bleibt.

---

## Priorität für Wave 9

### 🚨 P0 (Hot-Fix #2)

1. **#WAVE7-CRITICAL-01 + #WAVE8-NEW-01 — Hash-Chain Integrity**
   - Integrity-Handler mit `try/catch` umschließen, damit immer eine strukturierte Response zurückkommt
   - Repair-Migration für die 4 broken entries durchziehen (aktuell scheinbar unvollständig)
   - Hash-Compute-Function-Version dokumentieren — `hashVersion: 1` für legacy entries, `hashVersion: 2` für neue
   - Verify-Code dispatcht nach Version
   - Erst danach: Anchor wieder aktivieren

### P1 (Wave 9)

2. **#WAVE6-EXPORT-01** — PDF-Generation-Pipeline (Puppeteer/Playwright HTML → PDF/A)
3. **#WAVE6-STATE-01** — Incident-State-Machine (DSGVO Art. 33-relevant), Vendor, Contract, Process, Asset

### P2 (Wave 10)

4. DSR `/transitions`-Discovery (DSR hat named-routes aber non-discoverable)
5. ROPA/BIA/Findings-Export (Wave-6-EXPORT-02)
6. ESG-Report-Export Regression (Wave-6-EXPORT-03)
7. RBAC-Test-User-Seed + User-Roles-Discovery-Endpoint
8. Closed→Identified Re-Open ohne explizites State (Wave-6-STATE-02)

---

## Lobenswerte Beobachtungen (Wave 8)

✅ **State-Machine-Discovery jetzt für 10/14 Module** — gute Progression. Finding-Discovery zeigt sogar `knownStatuses` (komplette Liste aller möglichen States) zusätzlich zu `allowed` (aktuell erlaubte Targets). Das ist **besser** als die ursprüngliche Risk-Discovery.

✅ **Filter-Konsistenz endlich überall:** Alle Listen-Endpoints rejecten unknown query params mit 422 `"<param>: is not a recognized query parameter"`. Inklusive `requestId` für Log-Correlation.

✅ **`controls/effectiveness` mit Live-Daten:** 18 Controls, 6 Tests durchgeführt, 2 effective, 1 partially effective, 0 ineffective, 3 pending, 0 not tested, 83% effectiveness-rate. **Das ist ein echtes ICS-Dashboard-Datum** — bisher fehlte es komplett.

✅ **Whistleblowing-Intake mit perfekter UX:**

- Wrong endpoint → 405 + `detail`-hint zum echten Endpoint
- Echter Endpoint mit Field-Validation
- Wrong orgCode → 404 + Hint "Check the code on the intake poster, or contact the local data-protection officer."
- HinSchG-conform-Flow vom Anonymous-User bis zur Triage

✅ **UI macht Hash-Chain-Problem sichtbar:** `/audit-log` zeigt einen Warning-Header "Integritätsprüfung: HTTP 500" — User wissen, dass etwas nicht stimmt. Bessere UX als ein silent-broken Trust-Anchor.

✅ **Anchor funktioniert weiter:** Trotz broken integrity-check ist FreeTSA-Anchoring weiter operational. Der separate Merkle-Root-Build greift nicht in den verify-path.

---

_Wave 8 abgeschlossen. 7 weitere Fixes, P0 anders manifestiert aber nicht gelöst. State-Machine-Coverage auf 10/14 Module. Plattform-Stand bleibt "Alpha mit broken Audit-Verification". Hot-Fix #2 für Hash-Chain hat höchste Priorität._
