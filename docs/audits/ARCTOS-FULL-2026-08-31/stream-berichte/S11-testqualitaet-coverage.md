# S11 — Testqualität und Coverage-Realität

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S11 · **Commit:** `a8d1414f`
**Prüfgegenstand:** 406 Testdateien (nicht 684, s. S11-13), 67 Playwright-E2E-Specs, `coverage/`, `.github/workflows/{ci,coverage}.yml`, `scripts/coverage-aggregate.ts`
**Ziel laut Plan:** Belastbarkeit des Sicherheitsnetzes, das die anschließende Remediation absichern soll.

---

## 1. Zusammenfassung

Die Testsuite ist **nicht belastbar genug**, um eine umfangreiche automatisierte Remediation abzusichern.

Drei Befunde tragen die Bewertung:

1. **Die gemessene Coverage liegt bei 20,4 % Lines aggregiert** (14.174/69.456) gegenüber **78,4 %, die `docs/STATUS.md` ausweist**. Das Hauptpaket `apps/web` — 1.789 Quelldateien, 279.746 LOC, alle 1.357 API-Routen — hat **14,5 % Line- und 9,7 % Branch-Coverage**. Die Doku-Zahl ist nicht falsch berechnet, sondern über eine Aggregation aus nur zwei kleinen Packages entstanden; STATUS.md weist das in einem Nebensatz aus, führt die Zahl aber trotzdem als „Aggregat" in der Kopfzeile.

2. **82,9 % aller bestandenen `@grc/web`-Tests stammen aus drei automatisch generierten Smoke-Dateien** (3.798 von 4.580), die gegen ein vollständig gemocktes Auth-, DB- und Event-System laufen. `withAuth` ist in diesen Dateien auf „gib immer 401 zurück" gemockt — die Tests belegen also, dass eine Route den Rückgabewert eines Mocks durchreicht, nicht dass Authentifizierung stattfindet. Nach Abzug dieser Generatoren bleiben **782 handgeschriebene Tests für 1.789 Quelldateien**.

3. **Die 526 übersprungenen Tests stammen restlos aus einer einzigen Datei** und entsprechen exakt den **527 read-only-Routen** (GET/HEAD ohne mutierenden Export). Der Skip-Kommentar behauptet Abdeckung durch eine Schwesterdatei — diese Schwesterdatei akzeptiert jedoch ausdrücklich **Status 200** für eine unauthentifizierte Anfrage. Für die gesamte Lesepfad-Hälfte der API existiert damit **kein Test, der einen Auth-Regress erkennen würde**.

Dazu: `npm run test:coverage` **bricht am HEAD ab** (flakiger Test in `@grc/db`, turbo stoppt die Pipeline, `apps/web`/`apps/worker` messen nie); `packages/ai` (5 Testdateien, darunter Prompt- und Privacy-Router-Tests) und `packages/ui` haben **kein `test`-Skript** und laufen weder lokal noch in CI; die CI führt von 67 E2E-Specs **genau eine** aus; und die schärfsten vorhandenen Negativtests (Cross-Tenant-RLS) laufen in einem separaten CI-Job, nicht in `npm test`.

**Positiv abzugrenzen:** Negative Sicherheitstests _existieren_ und sind teils gut (`packages/db/tests/rls/cross-tenant-isolation.test.ts`, `apps/web/src/__tests__/api/domain-rbac-suite.test.ts`, `packages/events` Webhook-HMAC-Tampering). Es gibt **kein einziges committetes `.only`**. `packages/shared` ist mit 81 % Lines real gut abgedeckt.

### Findings-Übersicht

| ID     | Severity | Titel                                                                                                        |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| S11-01 | High     | Gemessene Coverage 20,4 % vs. 78,4 % in `docs/STATUS.md`; `apps/web` bei 14,5 %                              |
| S11-02 | High     | 526 stille Skips verdecken den kompletten Lesepfad der API; Skip-Begründung ist sachlich falsch              |
| S11-03 | High     | Die drei Auto-Smoke-Dateien (82,9 % aller Web-Tests) prüfen Mocks gegen Mocks                                |
| S11-04 | High     | `npm run test:coverage` bricht am HEAD ab — Coverage der Hauptpakete wird nie gemessen                       |
| S11-05 | Medium   | `packages/ai` und `packages/ui`: Tests existieren, werden nie ausgeführt                                     |
| S11-06 | Medium   | CI führt 1 von 67 E2E-Specs aus                                                                              |
| S11-07 | Medium   | E2E-Regressionstests akzeptieren Erfolg **und** Verweigerung in derselben Assertion                          |
| S11-08 | Medium   | `login()`-Fixture verschluckt Login-Fehler → 15 Specs skippen statt zu scheitern                             |
| S11-09 | Medium   | 103 von 124 Worker-Testdateien enthalten genau einen `toBeDefined()`-Test                                    |
| S11-10 | Medium   | `packages/db`: 409 Tests, 0,04 % Function-Coverage — Schema-Import-Tautologien                               |
| S11-11 | Medium   | Cross-Tenant-/RLS-Negativtests laufen nicht in `npm test`                                                    |
| S11-12 | Low      | Flakiger Test in `@grc/db` (Timeout unter Parallellast)                                                      |
| S11-13 | Low      | Testdateien-Zahl in Plan/Doku (684 / 236) vs. Ist (406)                                                      |
| S11-14 | Low      | `vitest.coverage.shared.ts` setzt keinen Threshold — STATUS.md behauptet 40 %/30 % Floor                     |
| S11-15 | Low      | 40 feste `waitForTimeout`-Sleeps in E2E; `fullyParallel: true` auf geteilter Demo-DB                         |
| S11-16 | Low      | Aggregations-Skript ignoriert `packages/events`, `reporting`, `ai`, `ui`; `packages/db` liefert kein Summary |
| S11-17 | Info     | Kein einziges `.only` im Repo — Kontrolle 3 des Auftrags negativ                                             |
| S11-18 | Info     | Obsoleter, dauerhaft deaktivierter Integrationstest ohne Tilgungspfad                                        |

---

## 2. Methodik-Protokoll

Abgearbeitet wurden die sechs Punkte aus `AUDIT_PLAN.md` §S11.

| #   | Methodikpunkt                                   | Durchgeführt                                                                                                   | Evidenz                                                                                                                                             |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coverage messen, pro Package, gegen Doku halten | `npm run test:coverage` (turbo) + je Package einzeln + `scripts/coverage-aggregate.ts`                         | `evidence/s11/coverage-run.log`, `web-coverage.log`, `worker-coverage.log`, `db-coverage.log`, `shared-coverage.log`, `coverage-per-package-IST.md` |
| 2   | Testqualität systematisch                       | Eigener AST-naher Parser über alle 406 Dateien / 3.317 `it()`-Blöcke; danach manuelle Bewertung der Kandidaten | `evidence/s11/analyze_tests.py`, `tests-weak-assertions.txt`, `tests-without-assertion.txt`, `test-quality-raw.json`                                |
| 3   | `.skip` / `.only` / `todo` zählen und listen    | Volltext-Grep über alle `*.ts`/`*.tsx` + Laufzeit-Auswertung des vitest-JSON-Reports                           | `evidence/s11/skip-todo-raw.txt`, `web-skipped-tests.txt`, `web-tests-per-file.txt`                                                                 |
| 4   | Negative Sicherheitstests                       | Grep auf 403/Cross-Tenant/Tamper + manuelle Sichtung aller Treffer + Abgleich gegen CI-Jobs                    | `evidence/s11/tests-403.txt`, `tests-crosstenant.txt`                                                                                               |
| 5   | E2E-Flakiness (statisch, kein App-Server)       | Grep `waitForTimeout`; Parser für geteilten Modul-State über Testgrenzen; Playwright-Configs                   | `evidence/s11/e2e-waitfortimeout.txt`, `e2e-order-dependencies.txt`, `e2e-density.txt`, `e2e-status-menu-asserts.txt`                               |
| 6   | Test-Isolation                                  | Prüfung DB-Nutzung, `isolate`/`pool`, `fullyParallel`, Aufräumverhalten                                        | siehe §7                                                                                                                                            |

**Verifikation der Baseline-Zahlen.** `npm test` wurde nicht erneut ausgeführt; die Baseline-Zahlen (4.580 bestanden / 526 übersprungen) wurden im eigenen `vitest run --coverage`-Lauf für `apps/web` **exakt reproduziert** (`web-coverage.log`: `Tests 4580 passed | 526 skipped (5106)`).

**Nicht durchgeführt** (Auftragsgrenze): Ausführung der Playwright-Suite — kein laufender App-Server. Alle E2E-Aussagen sind statisch belegt.

**Repo-Integrität:** `git status --porcelain` ist nach allen Läufen leer. Die von vitest erzeugten `coverage/`-Verzeichnisse sind über `.gitignore:12` ausgenommen.

---

## 3. Coverage-Ist vs. dokumentiert

### 3.1 Gemessenes Ist (2026-08-31, Commit `a8d1414f`)

Erhoben mit `vitest run --coverage` je Package (v8-Provider, Konfiguration unverändert), aggregiert mit dem repo-eigenen `scripts/coverage-aggregate.ts`.

| Package                   | Lines                                                           | Statements | Functions            | Branches                 |
| ------------------------- | --------------------------------------------------------------- | ---------- | -------------------- | ------------------------ |
| `packages/email`          | **87,2 %** (171/196)                                            | 86,9 %     | 97,5 %               | 55,9 %                   |
| `packages/shared`         | **81,0 %** (3.760/4.639)                                        | 79,0 %     | 68,8 %               | 69,4 %                   |
| `packages/automation`     | 59,1 % (110/186)                                                | 60,0 %     | 71,4 %               | 47,5 %                   |
| `packages/auth`           | 52,5 % (218/415)                                                | 51,9 %     | 62,5 %               | 43,8 %                   |
| `packages/events`         | 52,9 % (55/104)                                                 | 55,0 %     | 48,1 %               | 50,0 %                   |
| `apps/worker`             | **31,1 %** (1.129/3.631)                                        | 30,5 %     | 37,2 %               | **12,5 %**               |
| `packages/db`             | 31,4 % (923/2.940)                                              | 31,0 %     | **0,04 %** (1/2.047) | **0 %** (0/16)           |
| `packages/graph`          | 27,2 % (64/235)                                                 | 27,4 %     | 6,7 %                | 21,6 %                   |
| `apps/web`                | **14,5 %** (8.722/60.154)                                       | 16,3 %     | 19,1 %               | **9,7 %** (4.530/46.942) |
| `packages/reporting`      | _nicht gemessen_ — kein `test:coverage`-Skript                  |            |                      |                          |
| `packages/ai`             | _nicht gemessen_ — kein `test`-Skript, vitest nicht installiert |            |                      |                          |
| `packages/ui`             | _nicht gemessen_ — kein `test`-Skript                           |            |                      |                          |
| **Aggregat (7 Packages)** | **20,4 %** (14.174/69.456)                                      | 21,7 %     | 23,0 %               | **13,9 %**               |

Rohdaten: `evidence/s11/coverage-per-package-IST.md` / `.json`.

### 3.2 Dokumentierter Soll-/Ist-Stand

| Quelle                    | Zeile   | Aussage                                                                 | Ist                                                               |
| ------------------------- | ------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/STATUS.md`          | 337–342 | „Lines 78,4 % (3.443/4.394)", „Branches 66,4 %" als **Aggregat**        | 20,4 % / 13,9 %                                                   |
| `docs/STATUS.md`          | 335     | Quelle: `coverage/aggregated-summary.md`                                | Pfad ist über `.gitignore:12` ausgeschlossen, liegt nicht im Repo |
| `CLAUDE.md`               | 365–366 | „Backend: Vitest, code coverage > 80 % / Frontend: … > 60 %"            | Backend (`apps/web` API) 14,5 %, Worker 31,1 %                    |
| `docs/DEVELOPER_GUIDE.md` | 314     | „Coverage targets: backend > 80 %, frontend > 60 %."                    | dito                                                              |
| `docs/PRD_Sprint1.md`     | 40, 238 | Akzeptanzkriterium Q-1: „Code coverage backend > 80 %, frontend > 60 %" | nicht erfüllt                                                     |
| `docs/STATUS.md`          | 431     | „`vitest.coverage.shared.ts`: 40 % lines / 30 % branches als Floor" ✅  | Datei setzt **keinen** Threshold (s. S11-14)                      |

Die 78,4 % in STATUS.md sind rechnerisch nachvollziehbar: die Nenner (4.394 Lines) entsprechen der Summe aus `packages/auth` + `packages/shared` zum damaligen Stand. STATUS.md 344 räumt das ein („deckt nur die 2 Packages ab … Reale Plattform-Coverage liegt deutlich darunter"). Die Zahl steht trotzdem unkommentiert in der Kopftabelle unter der Überschrift „Aggregierte Coverage" und ist die Zahl, die in Statusberichten zitiert wird. Das Delta beträgt **58 Prozentpunkte**.

---

## 4. Analyse der 526 übersprungenen Tests

### 4.1 Herkunft — vollständig geklärt

Statische Suche über alle `*.ts`/`*.tsx` (ohne `node_modules`) nach `describe/it/test.skip|todo|failing|skipIf|runIf`, `ctx.skip()`, `this.skip()`:

```
24 Treffer gesamt  →  21× test.skip (Playwright, datenabhängig)
                      2× it.skip     (packages/db Integration)
                      1× ctx.skip()  (apps/web)
```

(`evidence/s11/skip-todo-raw.txt`)

Der **einzige** Skip-Mechanismus im Vitest-Lauf ist damit `ctx.skip()`. Die Auswertung des JSON-Reports bestätigt das ohne Rest:

```
$ python3 … web-results.json
Dateien mit Skips: 1
  526  apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts
```

(`evidence/s11/web-skipped-tests.txt` listet alle 526 Testnamen einzeln.)

Die Skip-Stelle, wörtlich — `apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts:358-366`:

```ts
it(`${cleanPath} [mutating → 401/403]`, async (ctx) => {
  const mod = await importer();
  const methods = MUTATING_METHODS.filter(
    (m) => typeof mod[m] === "function",
  );
  if (methods.length === 0) {
    ctx.skip(); // read-only route — covered by all-routes-smoke
    return;
  }
```

### 4.2 Was genau übersprungen wird

Die Datei globt `../../app/api/**/route.ts` (Zeile 132–134) — alle 1.357 Routen — und überspringt jede, die keinen `POST|PUT|PATCH|DELETE`-Export hat. Unabhängige Gegenzählung im Dateisystem:

```
$ find apps/web/src/app/api -name route.ts | wc -l          → 1357
   davon mit mutierendem Export (statisch)                  →  830
   davon ohne (= read-only, GET/HEAD)                       →  527
```

526 Skips ↔ 527 read-only-Dateien. Die Übereinstimmung ist exakt (Differenz 1 = eine Datei ohne statisch erkennbaren Export). **Die übersprungene Menge ist die vollständige Lesepfad-Hälfte der API.**

Gegenprobe an der Routen-Matrix aus S02 (`evidence/S02-routes-matrix.csv`): von den 527 read-only-Dateien nutzen 506 GET-Handler `withAuth`, 17 gar keinen Auth-Aufruf, 2 `auth()`, 1 `portalToken`.

### 4.3 Warum die Begründung „covered by all-routes-smoke" nicht trägt

`apps/web/src/__tests__/api/all-routes-smoke.test.ts:121-128` definiert die Menge der akzeptierten Statuscodes:

```ts
const ACCEPTABLE_STATUS_CODES = [
  // 308 added for the alias308() helper from Wave 7 …
  200, 201, 202, 204, 301, 302, 304, 307, 308, 400, 401, 403, 404, 405, 409,
  410, 422, 429, 500, 502, 503,
];
```

und Zeile 170–193 die Prüfung:

```ts
      it("each handler returns a Response on smoke call", async () => {
        …
          try {
            res = await fn(req, ctx);
          } catch (err) {
            // Some routes throw on missing-context paths; smoke-OK
            // because we still verify the handler was a function.
            expect(err).toBeDefined();
            continue;
          }
          expect(res).toBeInstanceOf(Response);
          expect(ACCEPTABLE_STATUS_CODES).toContain(res.status);
```

**Fehlerszenario (Eingabe → Wirkung):** Eine Remediation entfernt oder verdreht versehentlich den `withAuth`-Wrapper in `GET /api/v1/risks/route.ts`. Die Route antwortet unauthentifiziert mit `200` und der vollständigen Risikoliste einer Organisation.

- `all-mutating-routes-auth-smoke` → **übersprungen** (kein mutierender Export).
- `all-routes-smoke` → `200` ∈ `ACCEPTABLE_STATUS_CODES` → **grün**.
- Wirft die Route stattdessen, greift `expect(err).toBeDefined()` → ebenfalls **grün**.

Es existiert im Standard-Testlauf kein Test, der diesen Regress erkennt. Die Skip-Begründung im Code suggeriert eine Abdeckung, die nachweisbar nicht existiert — das ist gefährlicher als ein sichtbar fehlender Test.

### 4.4 Seit wann

Die Skips sind kein Rückstand, sondern konstruktionsbedingt: sie entstehen bei jedem Lauf neu aus der Auto-Discovery. Es gibt keinen Zeitpunkt, ab dem sie „auflaufen" — mit jeder neuen read-only-Route wächst die Menge automatisch. Der Zähler „526 skipped" in der CI-Ausgabe ist der einzige Hinweis und trägt keine Begründung.

### 4.5 Was dadurch ungetestet bleibt — Gruppierung

Alle 526 Namen in `evidence/s11/web-skipped-tests.txt`. Nach Modulpräfix gruppiert bleiben u. a. ungetestet, ob ein Lesezugriff ohne Session abgewiesen wird:

- sämtliche `GET /api/v1/{risks,controls,audits,findings}/…`-Listen- und Detail-Endpunkte,
- `GET /api/v1/branding/css/[orgId]` — nimmt eine fremde `orgId` direkt aus dem Pfad,
- `GET /api/v1/calendar/ical/[token]` — tokenbasierter Kalenderexport,
- alle Auswertungs-/Dashboard-Endpunkte (`/compliance/*`, `/reports/*`, `/isms/*`, `/bcms/*`, `/dora/*`),
- alle Portal-Leseendpunkte (`/portal/dd/*`, `/portal/mailbox/*`).

**Falsch-Positiv-Abgrenzung.** Von den 17 read-only-Routen ohne Auth-Aufruf sind mehrere nachweislich harmlose Statik-Stubs und begründen kein eigenes Finding:

- `apps/web/src/app/api/v1/bcms/crisis/dashboard/route.ts:12` — `return problem.notFound({…})`, keine DB-Berührung.
- `apps/web/src/app/api/v1/rcsa/route.ts:5`, `…/marketplace/route.ts:5`, `…/identity/route.ts:9` — statische Discovery-Payloads ohne Mandantenbezug.
  Die Bewertung von `/api/v1/branding/css/[orgId]`, `/api/v1/calendar/ical/[token]`, `/api/v1/compliance`, `/api/v1/isms/nis2` und `/api/v1/reports` obliegt S02; S11 stellt allein fest, dass **keiner** von ihnen durch einen Auth-Test gedeckt ist.

---
