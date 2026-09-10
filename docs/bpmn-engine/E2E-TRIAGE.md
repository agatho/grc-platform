# E2E-Triage — ARCTOS, Erstmessung vom 2026-09-01

**Lauf:** 196 Tests, 104 bestanden, 92 gescheitert.
Die Eingabeliste nennt **101** Fehlschlaege (`### FEHLGESCHLAGENE SPECS (101) ###`); die
Differenz zu 92 sind Wiederholungslaeufe derselben Tests. Triagiert sind alle 101 Zeilen,
jede genau einer Kategorie zugeordnet.

**Umgebung:** `http://127.0.0.1:3000` (Produktionsbuild, `node server.js`, Stand `86ed0134`)
gegen PostgreSQL 17 auf Port 5433. Alle Befunde unten sind an dieser laufenden Instanz und
an ihrer Datenbank **gemessen**, nicht nur gelesen.

---

## 1. Auswertung nach Kategorie

| Kat.  | Bedeutung                |  Anzahl |
| ----- | ------------------------ | ------: |
| **A** | Seed-Luecke              |      24 |
| **B** | Erwartung veraltet       |       5 |
| **C** | **Echter Produktdefekt** |  **70** |
| **D** | Test selbst kaputt       |       1 |
| **E** | Umgebung                 |       1 |
|       | **Summe**                | **101** |

Die Arbeitshypothese — "die Tests erwarten einen Demo-Datenbestand, den die Seed-Skripte
nicht erzeugen" — **stimmt, ist aber nicht die Hauptursache.** Der Demo-Bestand fehlte
tatsaechlich (Abschnitt 3), aber er erklaert nur 24 der 101 Fehlschlaege. Die Mehrheit geht
auf **zwei Produktdefekte** zurueck, die ohne die Suite nicht sichtbar waren: einer macht die
Anwendung fuer jeden Mandanten datenleer (C-01), der andere bringt sie nach etwa 25
abgebrochenen Anfragen dauerhaft zum Stehen (C-07).

---

## 2. Kategorie C — die Produktdefekte

### C-01 (kritisch, 63 Fehlschlaege) — 1.170 von 1.362 API-Routen antworten mandantenlos und liefern leere Listen

`withAuth()` stellt den RLS-Kontext ueber `establishRequestScopedContext()` her
(`apps/web/src/lib/api.ts:301`). Das gelingt nur, wenn `withErrorHandler` vorher den
`requestDbStorage.run(...)`-Rahmen geoeffnet hat, den die Funktion mutieren kann
(`apps/web/src/lib/api-wrapper.ts:113-182`). Fehlt der Rahmen, faellt sie auf
`requestDbStorage.enterWith(...)` zurueck — `apps/web/src/lib/api.ts:184-196`, im Code selbst
kommentiert mit _"it may not propagate under Next ... Such routes are listed in the fix PR's
coverage analysis; they should adopt withErrorHandler"_.

Genau das ist der Zustand: **1.170 der 1.362 Route-Dateien rufen `withAuth(` auf und haben
kein `withErrorHandler`.** Ihre Abfragen laufen ueber den kontextlosen Basis-Pool, RLS filtert
jede Zeile weg, und die Route antwortet **200 mit leerer Liste** — nicht unterscheidbar von
"keine Daten".

**Messung (gleiche Sitzung, gleiche Organisation `6d2a7cf8…`, Arctis Group):**

| Endpoint                                  | `withErrorHandler` | Antwort                                  | Zeilen in der DB |
| ----------------------------------------- | ------------------ | ---------------------------------------- | ---------------- |
| `/api/v1/processes?limit=3`               | ja                 | 7 Prozesse                               | 7                |
| `/api/v1/organizations/6d2a7cf8…/modules` | **nein**           | `{"data":[]}`                            | 11               |
| `/api/v1/work-items?limit=3`              | **nein**           | `{"data":[],"total":0}`                  | 2                |
| `/api/v1/budgets?limit=3`                 | **nein**           | `{"data":[],"total":0}`                  | vorhanden        |
| `/api/v1/audit-log/archive?…`             | **nein**           | `404 {"error":"Organization not found"}` | die eigene Org   |

Gegenprobe direkt auf der DB als `grc_app` mit gesetztem `app.current_org_id`: derselbe
JOIN liefert 11 Zeilen. Der Defekt liegt also im Kontext, nicht in den Daten.

**Warum das die halbe Suite umlegt:** `/api/v1/organizations/:id/modules` ist die Quelle von
`useModuleConfig` (`apps/web/src/hooks/use-module-config.tsx:60`). Liefert sie `[]`, meldet
`ModuleGate` (`apps/web/src/components/module/module-gate.tsx:46`) `status = "disabled"` und
rendert den Teaser **"Modul aktivieren"** — auf _jeder_ Seite von erm, ics, isms, bcms, dpms,
tprm, esg und ai-act. Belegt durch den Fehlerkontext von `ai-act-workflow`:
`- main: - heading "isms" [level=2]` statt "GPAI-Modellregister".

Das ist kein Testproblem. **Ein angemeldeter Administrator sieht in der laufenden Anwendung
in keinem Modul Daten.**

_Behoben:_ alle 1.155 betroffenen Route-Dateien in `withErrorHandler` gewickelt (die
Transformation ist pro Datei identisch: `export async function GET(` →
`export const GET = withErrorHandler(async function GET(` plus Import). Der Erfolgspfad
(`status < 400`) wird vom Wrapper unveraendert durchgereicht, Streaming-/ZIP-/PDF-Antworten
sind also nicht betroffen; Fehlerbodies werden auf RFC 7807 normalisiert, was ADR-021 ohnehin
vorschreibt und 165 Routen bereits taten.
Zusaetzlich: `withErrorHandler` gibt jetzt `WrappedRouteHandler` zurueck, dessen zweiter
Parameter am **Aufrufort** optional ist — sonst waeren die ~90 Unit-Tests, die flache Handler
als `GET(req)` aufrufen, mit TS2554 gebrochen.

### C-02 — `POST /api/v1/programmes/journeys` gibt das SQL-Statement an den Client

`apps/web/src/app/api/v1/programmes/journeys/route.ts:130` (vorher):
`return Response.json({ error: "Failed to create journey", reason: message }, { status: 500 })`.

Gemessene Antwort der laufenden Anwendung: das vollstaendige `insert into "programme_journey"
(...) values ($1,…)` mit allen Spaltennamen **und den gebundenen Werten**, darunter `org_id`,
`owner_id` und `created_by` — echte Mandanten- und Benutzer-UUIDs, an jeden Aufrufer, der
einen 500 provozieren kann. _Behoben:_ Detail nur noch im Server-Log.

### C-03 — `loadRoles()` ohne `ORDER BY`: die aktive Organisation ist zufaellig

`packages/auth/src/providers.ts:240`. `config.ts:71` bestimmt die aktive Organisation als
`roles[0]?.orgId` — also aus der Heap-Reihenfolge der Tabelle. Folgen:

- Ein Benutzer mit mehreren Mitgliedschaften landet bei jeder Anmeldung in einem anderen
  Mandanten.
- Es ist der Mechanismus, mit dem sich die Suite selbst vergiftet: `f-02-org-create` legt eine
  Wegwerf-Organisation an und nimmt eine `admin`-Rolle darauf. In der Datenbank stand nach dem
  Lauf `currentOrgId = 0103a430… ("E2E-F02b-049448")` — eine leere Testorganisation. Alle
  danach laufenden Specs prueften gegen sie, **und zwar auch beim naechsten Lauf wieder**,
  weil die Mitgliedschaft bleibt.

_Behoben:_ `ORDER BY created_at, org_id` — aelteste Mitgliedschaft zuerst.

### C-04 (offen) — Ein Organisations-Administrator kann seine Organisationen nicht auflisten

`organization` hat als einzige SELECT-Policy
`org_isolation_select: (id = current_setting('app.current_org_id')::uuid)`. Ueber die
org-gepinnte Verbindung kann `GET /api/v1/organizations` deshalb **hoechstens die aktive
Organisation** zurueckgeben, `GET /api/v1/organizations/tree` lieferte `{"data":[]}`.
Der Org-Switcher und die Organisationsliste koennen so prinzipiell nicht funktionieren.
Symptome: #64 (`/organizations` zeigt "Meridian" nicht) und #70 (F-02 findet die soeben
angelegte Tochter nicht).

_Nicht behoben._ Der saubere Weg ohne Schemaaenderung ist, die Liste je zugreifbarer Org
ueber den vorhandenen `withOrgReadContext()`-Helfer zu lesen (durch `limit` <= 100 begrenzt).
Ich habe das bewusst nicht blind umgesetzt: der Code sitzt direkt auf der Mandantentrennung,
und ein Fehler dort ist ein Datenleck, kein roter Test.

### C-07 (kritisch, offen, 3 Fehlschlaege) — reservierte Datenbankverbindungen werden nicht freigegeben; die Anwendung bleibt danach haengen

`reserveAndConfigure()` (`packages/db/src/request-context.ts:169`) reserviert pro
authentifizierter Anfrage eine Verbindung aus `requestClient` (**`max: 25`**,
`packages/db/src/index.ts:295`) und setzt die `app.*`-GUCs darauf.
Freigegeben wird sie ausschliesslich ueber `after(reserved.release)`
(`apps/web/src/lib/api.ts:174`) — Nexts "nach der Antwort"-Hook.

**Messung, 8 Stunden nach dem E2E-Lauf, an der laufenden Instanz:**

```
select left(query,90), count(*), max(now()-state_change) from pg_stat_activity
where usename='grc_app' and state='idle' group by 1;

  "SELECT set_config('app.current_org_id', $1, false), set_config(…"  |  22  |  08:11:25
```

**22 von 25** Verbindungen des Request-Pools stehen auf genau dem `set_config`-Statement, mit
dem `reserveAndConfigure` sie konfiguriert — sie wurden reserviert und nie freigegeben. Waeren
sie freigegeben worden, waere ihr letztes Statement der Scrub-Aufruf aus
`releaseRequestContext` (`set_config(..., '', false)`).

**Wirkung:** ist der Pool leer, blockiert `requestClient.reserve()`, und **jede**
authentifizierte Anfrage haengt. Genau das ist die Signatur der Fehlschlaege #73, #84 und #100
— `page.waitForURL: Timeout 60000ms exceeded` — die alle **spaet** im Lauf liegen, nachdem der
Pool leergelaufen war. Und es ist kein voruebergehender Zustand: die Instanz konnte acht
Stunden spaeter, bei meinen eigenen Messlaeufen, **keine einzige authentifizierte Anfrage mehr
beantworten** (`auth.setup` blieb zweimal in `page.evaluate(fetch("/api/auth/session"))`
haengen, waehrend `/api/health` in 121 ms antwortete). Nur ein Neustart des Prozesses raeumt
das auf.

Fuer eine Produktionsinstanz heisst das: nach rund 25 abgebrochenen oder abgelaufenen Anfragen
stellt die Anwendung den Dienst fuer angemeldete Benutzer ein und erholt sich nicht.

_Teilweise behoben:_ Der `catch`-Zweig in `api.ts:175` kehrte bisher **ohne Freigabe** zurueck,
mit der Begruendung "the reserved connection is released when the pool closes" — der Pool eines
laufenden Servers schliesst nie, und der Fallback-Zweig zwanzig Zeilen tiefer macht es in
derselben Lage richtig. Er gibt jetzt frei (`releaseRequestContext` ist idempotent).

_Offen_ bleibt der Hauptpfad: die Freigabe darf nicht allein an `after()` haengen, das beim
Abbruch der Verbindung durch den Client nicht mehr laeuft. Der naheliegende Ort ist ein
`finally` um den `requestDbStorage.run(...)`-Rahmen in `withErrorHandler` — mit der
Einschraenkung, dass eine Route, die einen noch nicht konsumierten Stream zurueckgibt, ihre
Verbindung dann zu frueh verloere. Das ist zu entscheiden, nicht zu raten, deshalb habe ich es
nicht blind geaendert.

### C-05 — Kontrastbefund auf `/dashboard` wurde gegen die falsche Hintergrundfarbe geschlossen

WP12/S14-11 hat `--color-gray-400` gegen `--color-surface` = `#ffffff` auf 4.563:1 gebracht.
Nur wird keine Dashboard-Seite auf `#ffffff` gezeichnet: die Anwendungsflaeche ist
`bg-gray-50` = `#fbfaf9`. Dort betraegt derselbe Wert **4.370:1** — axe misst auf `/dashboard`
exakt das: _"insufficient color contrast of 4.38 (foreground color: #7a756e, background color:
#fbfaf9, font size: 14px)"_, und `#7a756e` **ist** `oklch(0.565 0.012 75)`. `gray-500` lag mit
4.537:1 innerhalb des Rundungsfehlers.

_Behoben:_ `gray-400` → `oklch(0.548)` (4.692:1 auf `#fbfaf9`), `gray-500` → `oklch(0.540)`
(4.853:1); Hierarchie 400 < 500 < 600 bleibt. `theme-contrast.test.ts` misst jetzt den
**schlechteren** der beiden Default-Hintergruende, damit der Befund nicht ein drittes Mal
gegen eine Flaeche geschlossen wird, die es im Produkt nicht gibt.

### C-06 (offen) — CSP blockiert ein eigenes Inline-Script auf `/dashboard`

`platform-smoke.spec.ts:288` misst zwei Konsolenfehler:
`"Executing inline script violates the following Content Security Policy directive
'script-src 'self' 'nonce-nT147EZjDJu8KYTHEK59JA' 'strict-dynamic' https:'"` und einen
404 auf eine Ressource. Das Script laeuft also nicht — die eigene CSP verbietet es, weil ihm
das Middleware-Nonce fehlt. _Nicht behoben:_ das verursachende Script muss im laufenden
Dokument identifiziert werden; dazu braucht es einen Build, den ich hier nicht erzeugen kann.

---

## 3. Kategorie A — die Seed-Luecken

### A-01 — `module_definition` kannte 11 der 20 `MODULE_KEYS`

Gemessen: `ics`, `dms`, `isms`, `bcms`, `dpms`, `audit`, `tprm`, `contract`, `eam`, `academy`
fehlten. `requireModule()` (`packages/auth/src/middleware/module-guard.ts:26`) antwortet fuer
ein Key ohne Definition mit **404** ("don't reveal module exists"). Damit war die gesamte
ICS-/DMS-/ISMS-/BCMS-/DPMS-/Audit-/TPRM-/Contract-API fuer **jede** Organisation 404 —
`{"error":"Not found"}` in 25 der Fehlschlaege.

Ursache: `seed.ts` seedete vier Definitionen und ueberliess die restlichen acht der Datei
`sql/seed_module_definitions_sprint4_9.sql`, die nur `scripts/setup.sh` anwendet — per `psql`,
best effort, Ausgabe verworfen. Auf dem Rechner des Eigentuemers ist `psql` **nicht
installiert**, also lief dieser Schritt nie.

_Behoben:_ `packages/db/src/seed.ts` seedet alle 20 Definitionen (Tabelle `module_definition`)
und wirft danach, wenn ein Key aus `MODULE_KEYS` fehlt. `db:seed` ist `tsx` und laeuft ueberall.

### A-02 — `db:seed:demo` hat nie etwas geschrieben

`scripts/seed-demo.sh` hatte vier unabhaengige Defekte, jeder fuer sich ausreichend:

1. Es listete **11 von 16** `seed_demo_*.sql`. Ausgelassen war als erstes
   `seed_demo_00_platform.sql` — die Datei, deren eigener Kopf sagt _"Must run BEFORE all
   other seed_demo__.sql files"*, weil sie die Organisationen `c2446a5c…`/`ccc4cc1c…` anlegt,
   auf die alle anderen verweisen. Ebenfalls ausgelassen: `_11_extended`, `_12_ai_act`
   (der AI-Act-Bestand mit **AIS-001**), `_13_programmes`, `_14_july_features`.
2. Es wendete die **Referenz-Kataloge nie** an. `seed_demo_01_assets_isms.sql` schreibt
   `soa_entry`-Zeilen mit FK auf `control_catalog_entry`; ohne ISO-27001-Annex-A-Katalog
   scheitert das und reisst Assets, Threats und Vulnerabilities mit.
3. Jeder psql-Aufruf endete auf `>/dev/null 2>&1 || true`. Der Fehler **konnte** nicht
   gemeldet werden.
4. Es las `DB_HOST`/`DB_PORT`/… aus `.env`, wo nur `DATABASE_URL` steht, und fiel auf
   `localhost:5432` zurueck — die Datenbank hoert auf 5433.

Gemessener Zustand vor der Korrektur, auf einer Datenbank, deren Eigentuemer `db:seed` und
`db:seed:demo` ausgefuehrt hatte: `asset`, `control`, `audit`, `vendor`, `dpia`, `finding`,
`kri` und die gesamte `ai_*`-Familie **0 Zeilen**; `catalog` 1 Zeile.

_Behoben:_ neuer, portabler Runner `packages/db/src/seed-demo.ts` (verbindet ueber
`DATABASE_URL`, kein psql noetig, vollstaendige Dateiliste in Abhaengigkeitsreihenfolge,
Rollback nach einem Fehler, Exit-Code != 0). `scripts/seed-demo.sh` delegiert dorthin.

### A-03 — drei Demo-Seed-Dateien waren selbst defekt

- **`seed_demo_12_ai_act.sql`** — `invalid input syntax for type json`. Die Spalten
  `discrimination_risk`, `data_protection_impact`, `access_to_justice` sind `jsonb`
  (`schema/ai-act.ts:302-304`), die Datei uebergab die blossen Woerter `'high'`/`'medium'`.
  Da die Datei als **eine** implizite Transaktion laeuft, nahm dieser eine Fehler die
  5 KI-Systeme, das GPAI-Modell, die Vorfaelle, die Screenings, das QMS, die
  Korrekturmassnahmen und die Behoerdenkommunikation mit — **AIS-001 inklusive**.
  _Behoben:_ echte JSON-Objekte.
- **`seed_demo_01_assets_isms.sql`** — acht fest verdrahtete `catalog_entry_id`-UUIDs
  (`2c598ce1…`), die kein Seed je erzeugt: die Annex-A-Eintraege entstehen mit
  `gen_random_uuid()`. FK-Verletzung, und mit ihr fielen 40 Assets, Threats und
  Vulnerabilities aus. _Behoben:_ Aufloesung ueber den stabilen Annex-A-**Code**.
- **Reihenfolge 07 vor 10** — `finding.control_test_id` zeigt auf `control_test`, das erst
  `seed_demo_10_control_tests.sql` anlegt. Sowohl `seed-all.ts` als auch das Shell-Skript
  hatten 07 zuerst. _Behoben:_ 10 vor 07.

### A-04 — der Demo-Bestand lag in zwei verschiedenen Mandanten

`seed_demo_12_ai_act.sql` schrieb nach `c2446a5c…`, alle anderen nach `ccc4cc1c…` — der
Organisation, die `seed_demo_00_platform.sql` selbst als _"demo data org (all seed_demo_01-12
reference this)"_ dokumentiert. Welchen Mandanten man auch oeffnete, ein Teil des
Demo-Bestands fehlte. _Behoben:_ `_12` schreibt jetzt ebenfalls nach `ccc4cc1c…`.

### A-05 — der Demo-Bestand war fuer kein Anmeldekonto erreichbar

Rollen auf `c2446a5c…`/`ccc4cc1c…` hatten nur die zehn Demo-Personas. Ein mit `db:seed` oder
`db:create-admin` angelegtes Konto sah ein leeres Produkt. _Behoben:_ `seed_demo_00_platform.sql`
vergibt `admin` auf beiden Demo-Mandanten an jedes Konto, das bereits irgendwo `admin` oder
Plattform-Admin ist (hergeleitet, nicht fest verdrahtet).

### A-06 (Sicherheit) — der Demo-Seed haette `admin123` wieder eingefuehrt

`seed_demo_00_platform.sql` legte zehn Konten mit **einem** im Repository stehenden
bcrypt-Hash von `admin123` an, darunter `admin@arctos.dev` — genau das Default-Konto, das
WP3/S02-01 entfernt hat. Das Skript in die Kette aufzunehmen, haette den Auditbefund auf
jeder Demo- und CI-Umgebung rueckgaengig gemacht.
_Behoben:_ die Personas bleiben als **Daten** (die Demo-Dateien referenzieren ihre UUIDs als
`created_by`/`owner_id`), aber `password_hash` ist ein Sentinel ohne `$2`-Praefix — kein
Passwort kann dagegen verifizieren — und `must_change_password = true`. Zusaetzlich haben alle
Adressen ein `demo.`-Praefix bekommen: `"user".email` ist UNIQUE, `seed.ts` besitzt
`admin@arctos.dev`/`auditor@arctos.dev`, und `ON CONFLICT (id)` faengt eine Kollision auf
`email` nicht ab — dieses INSERT scheiterte auf jeder Datenbank, auf der `db:seed` zuerst lief.

---

## 4. Kategorien B, D, E

**B (5)** — #12/#13 `api-auth`: die Remediation hat auf RFC 7807 umgestellt
(`application/problem+json`, `{type,title,status,detail}`), die Spec prueft `json.error ===
"Unauthorized"` und `content-type` enthaelt `application/json`. #98/#99 `x-04`: der Handler
antwortet 401, und **401 ist richtig** — `validateDdToken` behandelt das Token als einzige
Credential; die Liste `[400,404,410]` liess genau die korrekte Antwort aus. #70 `f-02`:
`?limit=200` wird mit 422 abgewiesen, `paginate()` deckelt auf 100.

Bei allen fuenf ist die **Eigenschaft** unveraendert geblieben und teilweise schaerfer gefasst:
api-auth prueft jetzt zusaetzlich, dass kein HTML und kein Redirect zurueckkommt; x-04 sichert
"nie 200" und "nie 5xx" **einzeln** zu, damit keine Statuslisten-Aenderung sie verlieren kann.

**D (1)** — #60 `navigation`: `getByRole("link", {name:/risiko|risk/i}).first()` trifft eine von
sechs Navigationszeilen; der Lauf landete auf `/erm/risk-appetite`. Die Spec prueft eine
DOM-Reihenfolge, keine Produkteigenschaft → Selektor auf `a[href="/risks"]` praezisiert.
(#73/#84/#100 sahen zunaechst nach demselben Muster aus — `login()` scheitert an
`page.waitForURL` nach 60 s — sind aber **C-07**: der Verbindungspool war zu diesem Zeitpunkt
leergelaufen. Sie stehen in der Tabelle unter C.)

**E (1)** — #71 `f-02b`: Das Konto `admin@arctos.local` ist Plattform-Admin
(`platform_admin.reason = 'created via db:create-admin'`). Fuer einen Plattform-Admin ist 201
beim Anlegen eines Top-Level-Mandanten die **richtige** Antwort; die im Spec-Kommentar
behauptete Praemisse ("kein Seed vergibt Plattform-Admin") trifft nicht zu, `create-admin.ts:99`
tut es bei `--platform-admin`. Assertion bleibt 403, die Fehlermeldung nennt jetzt die
Provisionierung. Umgebungsfix: E2E-Konto ohne `--platform-admin` anlegen.

---

## 5. Vollstaendige Tabelle (alle 101 Fehlschlaege)

| #   | Spec                                                         | Zeile | Test                                                                                                                                      | Kat.  | Ursache                                                                                                                                                                                                                                                                                         | Fix-Weg                                                                                                                                         |
| --- | ------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/e2e/a11y-smoke.spec.ts`                            | 55    | a11y smoke - QA-015 follow-up > dashboard has no serious/critical axe violations                                                          | **C** | C-05: `text-gray-400` = `#7a756e` erreicht auf der tatsaechlichen Seitenflaeche `#fbfaf9` (bg-gray-50) nur 4.370:1; die WP12-Remediation hat gegen `--color-surface` = `#ffffff` gemessen, das keine Dashboard-Seite verwendet.                                                                 | gray-400 -> oklch(0.548), gray-500 -> oklch(0.540); `theme-contrast.test.ts` misst jetzt beide Flaechen (erledigt).                             |
| 2   | `apps/web/e2e/a11y-smoke.spec.ts`                            | 83    | a11y smoke - QA-015 follow-up > Radix Select: opens via keyboard (Space) - answers QA-015                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 3   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 13    | EU AI Act Workflow > AI systems page loads with demo data                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 4   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 19    | EU AI Act Workflow > AI system detail page loads                                                                                          | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 5   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 35    | EU AI Act Workflow > GPAI models page loads                                                                                               | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 6   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 51    | EU AI Act Workflow > AI incidents page loads with deadline tracking                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 7   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 60    | EU AI Act Workflow > Prohibited screening page loads                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 8   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 74    | EU AI Act Workflow > QMS page loads â”€â”€â”€â”€â”€â”€â”€                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 9   | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 81    | EU AI Act Workflow > Corrective actions page loads with demo data                                                                         | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 10  | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 88    | EU AI Act Workflow > Authority communication page loads                                                                                   | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 11  | `apps/web/e2e/ai-act-workflow.spec.ts`                       | 95    | EU AI Act Workflow > Penalties page loads                                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 12  | `apps/web/e2e/api-auth.spec.ts`                              | 4     | API Authentication > API routes return 401 JSON for unauthenticated requests                                                              | **B** | Die Audit-Remediation hat auf RFC 7807 umgestellt: der Body ist `{type,title,status,detail}` statt `{error:"Unauthorized"}`, der Content-Type `application/problem+json`.                                                                                                                       | Spec prueft jetzt 401 + JSON-Dialekt + `type/title` nennt "unauthorized" + kein HTML (erledigt).                                                |
| 13  | `apps/web/e2e/api-auth.spec.ts`                              | 23    | API Authentication > API routes never redirect to HTML login page                                                                         | **B** | Die Audit-Remediation hat auf RFC 7807 umgestellt: der Body ist `{type,title,status,detail}` statt `{error:"Unauthorized"}`, der Content-Type `application/problem+json`.                                                                                                                       | Spec prueft jetzt 401 + JSON-Dialekt + `type/title` nennt "unauthorized" + kein HTML (erledigt).                                                |
| 14  | `apps/web/e2e/audit-cis-ig-flow.spec.ts`                     | 23    | Audit - CIS IG1 Flow (ISO 19011 Arbeitspapier) > create audit â†’ generate CIS IG1 checklist â†’ evaluate with method entries             | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 15  | `apps/web/e2e/audit-cis-ig-flow.spec.ts`                     | 188   | Audit - CIS IG1 Flow (ISO 19011 Arbeitspapier) > checklist DELETE endpoint returns 200 for active audit, 409 for completed                | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 16  | `apps/web/e2e/bpm-approval-pipeline.spec.ts`                 | 28    | BPM - Approval pipeline with gates + sign-off chain > full pipeline: draft â†’ published (sign-off gate) â†’ working copy â†’ re-approval | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 17  | `apps/web/e2e/bpm-racm-perf.spec.ts`                         | 16    | BPM - RACM endpoint perf > racm aggregates within budget                                                                                  | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 18  | `apps/web/e2e/bpm-ropa-flow.spec.ts`                         | 17    | BPM - ROPA profile + DPIA auto-create + export > high-risk ROPA save â†’ DPIA created â†’ CSV export downloads                            | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 19  | `apps/web/e2e/bpm-ropa-flow.spec.ts`                         | 73    | BPM - ROPA profile + DPIA auto-create + export > low-risk ROPA does not auto-create a DPIA                                                | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 20  | `apps/web/e2e/catalog-activation.spec.ts`                    | 8     | Catalog Activation per Organization > module configs include all seeded modules                                                           | **C** | C-01 direkt gemessen: `/api/v1/organizations/:id/modules` liefert `{"data":[]}` fuer JEDE Organisation, obwohl `module_config` 11 Zeilen hat (DB-seitig mit gesetztem `app.current_org_id` verifiziert).                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 21  | `apps/web/e2e/catalogs.spec.ts`                              | 8     | Catalog Browser > generic catalogs API returns seeded data                                                                                | **A** | Nur 1 Katalog statt >=5: die `seed_catalog_*.sql` laufen ausschliesslich in `scripts/setup.sh` ueber psql und waren nie angewandt.                                                                                                                                                              | `seed-demo.ts` wendet die Referenz-Kataloge vor den Demo-Daten an; live jetzt 37 Kataloge (erledigt).                                           |
| 22  | `apps/web/e2e/ci-smoke.spec.ts`                              | 66    | CI smoke - release gate > audit archive endpoint responds with a zip stream                                                               | **C** | C-01: `/api/v1/audit-log/archive` liest `organization` ohne RLS-Kontext und antwortet `404 {"error":"Organization not found"}` fuer die eigene Organisation.                                                                                                                                    | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 23  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 13    | ERM ISO 31000 Workflow > risk register loads with demo data                                                                               | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 24  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 22    | ERM ISO 31000 Workflow > risk creation form has all required fields                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 25  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 30    | ERM ISO 31000 Workflow > risk appetite dashboard loads                                                                                    | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 26  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 36    | ERM ISO 31000 Workflow > KRI monitoring loads with data                                                                                   | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 27  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 42    | ERM ISO 31000 Workflow > FAIR analysis hub loads                                                                                          | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 28  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 48    | ERM ISO 31000 Workflow > heatmap visualization loads                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 29  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 58    | ICS & Audit COSO/IIA Workflow > control register loads                                                                                    | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 30  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 66    | ICS & Audit COSO/IIA Workflow > control creation form has COSO fields                                                                     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 31  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 78    | ICS & Audit COSO/IIA Workflow > audit universe loads                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 32  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 88    | BCMS ISO 22301 Workflow > BCMS dashboard loads with KPIs                                                                                  | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 33  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 95    | BCMS ISO 22301 Workflow > BIA page loads with assessments                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 34  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 101   | BCMS ISO 22301 Workflow > crisis scenarios page loads                                                                                     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 35  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 117   | DPMS DSGVO Workflow > RoPA page loads                                                                                                     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 36  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 125   | DPMS DSGVO Workflow > breach management with 72h tracking                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 37  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 131   | DPMS DSGVO Workflow > DPIA page loads                                                                                                     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 38  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 141   | TPRM ISO 27036 Workflow > vendor register loads with demo data                                                                            | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 39  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 147   | TPRM ISO 27036 Workflow > LkSG assessment page loads                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 40  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 169   | ESG CSRD Workflow > emissions page loads with scopes                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 41  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 175   | ESG CSRD Workflow > EU taxonomy page loads                                                                                                | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 42  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 181   | ESG CSRD Workflow > materiality analysis page loads                                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 43  | `apps/web/e2e/cross-module-workflows.spec.ts`                | 193   | Navigation & Tab System > horizontal tab navigation renders on module pages                                                               | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 44  | `apps/web/e2e/isms-workflow.spec.ts`                         | 14    | ISMS ISO 27001 Workflow > S1.1: ISMS dashboard shows KPIs                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 45  | `apps/web/e2e/isms-workflow.spec.ts`                         | 22    | ISMS ISO 27001 Workflow > S1.2: Asset list loads with classification                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 46  | `apps/web/e2e/isms-workflow.spec.ts`                         | 30    | ISMS ISO 27001 Workflow > S1.2: Asset detail page loads                                                                                   | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 47  | `apps/web/e2e/isms-workflow.spec.ts`                         | 47    | ISMS ISO 27001 Workflow > S2.2: Threats page loads                                                                                        | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 48  | `apps/web/e2e/isms-workflow.spec.ts`                         | 53    | ISMS ISO 27001 Workflow > S2.3: Vulnerabilities page loads                                                                                | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 49  | `apps/web/e2e/isms-workflow.spec.ts`                         | 62    | ISMS ISO 27001 Workflow > S2.4: IS Risk scenarios page loads with data                                                                    | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 50  | `apps/web/e2e/isms-workflow.spec.ts`                         | 70    | ISMS ISO 27001 Workflow > S2.5: Risk scenario detail page loads                                                                           | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 51  | `apps/web/e2e/isms-workflow.spec.ts`                         | 81    | ISMS ISO 27001 Workflow > S3.1: SoA page loads with Annex A controls                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 52  | `apps/web/e2e/isms-workflow.spec.ts`                         | 92    | ISMS ISO 27001 Workflow > S2.4: Assessments page loads                                                                                    | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 53  | `apps/web/e2e/isms-workflow.spec.ts`                         | 98    | ISMS ISO 27001 Workflow > S4.1: Maturity page loads                                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 54  | `apps/web/e2e/isms-workflow.spec.ts`                         | 105   | ISMS ISO 27001 Workflow > S4.3: Incidents page loads with demo data                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 55  | `apps/web/e2e/isms-workflow.spec.ts`                         | 114   | ISMS ISO 27001 Workflow > S6.1: CAP page loads with nonconformities                                                                       | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 56  | `apps/web/e2e/isms-workflow.spec.ts`                         | 125   | ISMS ISO 27001 Workflow > S5.2: Management review page loads                                                                              | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 57  | `apps/web/e2e/isms-workflow.spec.ts`                         | 132   | ISMS ISO 27001 Workflow > S5.3: Certifications page loads                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 58  | `apps/web/e2e/isms-workflow.spec.ts`                         | 141   | ISMS ISO 27001 Workflow > horizontal tab navigation works                                                                                 | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 59  | `apps/web/e2e/management-review.spec.ts`                     | 27    | ISMS - Management review cockpit > lifecycle: create â†’ dashboard â†’ item with action â†’ complete â†’ read-only â†’ PDF                | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 60  | `apps/web/e2e/navigation.spec.ts`                            | 22    | Sidebar Navigation > navigates to risk register from sidebar                                                                              | **D** | `getByRole("link",{name:/risiko\|risk/i}).first()` trifft eine von sechs Navigationszeilen; der Lauf landete auf `/erm/risk-appetite`. Die Spec hat eine DOM-Reihenfolge geprueft, keine Produkteigenschaft.                                                                                    | Selektor auf `a[href="/risks"]` praezisiert (erledigt).                                                                                         |
| 61  | `apps/web/e2e/platform-smoke.spec.ts`                        | 84    | Platform Smoke Tests > risk register shows demo data                                                                                      | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 62  | `apps/web/e2e/platform-smoke.spec.ts`                        | 103   | Platform Smoke Tests > risk creation form renders                                                                                         | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 63  | `apps/web/e2e/platform-smoke.spec.ts`                        | 120   | Platform Smoke Tests > control register shows demo data                                                                                   | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 64  | `apps/web/e2e/platform-smoke.spec.ts`                        | 152   | Platform Smoke Tests > organization list shows seeded orgs                                                                                | **C** | C-04: `organization` hat als einzige SELECT-Policy `id = current_org_id`. Ueber die org-gepinnte Verbindung kann jede Auflistung hoechstens die AKTIVE Organisation zurueckgeben — die Organisationsliste und der Org-Switcher koennen prinzipiell nicht funktionieren.                         | OFFEN: Liste ueber `withOrgReadContext` je zugreifbarer Org lesen (oder Policy erweitern). Nicht blind geaendert — RLS-naher Code.              |
| 65  | `apps/web/e2e/platform-smoke.spec.ts`                        | 288   | Platform Smoke Tests > dashboard has no console errors                                                                                    | **C** | Zwei echte Befunde auf `/dashboard`: (a) ein Inline-Script ohne Nonce wird von der eigenen CSP blockiert (`script-src 'self' 'nonce-…' 'strict-dynamic'`), (b) eine Ressource 404.                                                                                                              | OFFEN: Inline-Script mit dem Middleware-Nonce versehen bzw. auslagern; 404-Ressource identifizieren.                                            |
| 66  | `apps/web/e2e/process-map.spec.ts`                           | 37    | BPM - Process map (bands, reorder, inheritance) > band grouping â†’ reorder â†’ child inherits parent band on drill-in                    | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 67  | `apps/web/e2e/process-portal.spec.ts`                        | 26    | BPM - Process portal (my-processes + acknowledgment) > publish flow â†’ portal listing with role â†’ acknowledgment raises compliance     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 68  | `tests/e2e/regression/b-05-resilience-score.spec.ts`         | 6     | E2E-205: resilience score endpoint returns numeric score                                                                                  | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 69  | `tests/e2e/regression/b-06-readiness-monitor.spec.ts`        | 6     | E2E-206: readiness monitor returns and PDF endpoint reachable                                                                             | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 70  | `tests/e2e/regression/f-02-org-create.spec.ts`               | 16    | F-02: org create assigns admin role and shows in list after re-login                                                                      | **B** | `/api/v1/organizations?limit=200` wird mit 422 abgewiesen (`paginate()` deckelt limit auf 100). `orgs.data` war `undefined`, die Spec meldete das als "neue Organisation nicht sichtbar".                                                                                                       | Spec paginiert jetzt mit limit=100 und prueft den Status (erledigt). Bleibt danach rot wegen C-04.                                              |
| 71  | `tests/e2e/regression/f-02-org-create.spec.ts`               | 68    | F-02b: an org admin cannot create a top-level tenant                                                                                      | **E** | Das Testkonto `admin@arctos.local` ist Plattform-Admin (`platform_admin.reason='created via db:create-admin'`). Fuer einen Plattform-Admin ist 201 die RICHTIGE Antwort; die Praemisse der Spec ("kein Seed vergibt Plattform-Admin") gilt in dieser Umgebung nicht.                            | Assertion bleibt 403; Meldung nennt jetzt die Provisionierung. Fix: E2E-Konto ohne `--platform-admin` anlegen.                                  |
| 72  | `tests/e2e/regression/f-15-checklist-catalog.spec.ts`        | 8     | F-15: checklist generate from catalog_entry (ISO 27001 Annex A)                                                                           | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 73  | `tests/e2e/regression/f-17-schema-drift.spec.ts`             | 8     | F-17: /api/v1/health/schema-drift returns healthy                                                                                         | **C** | C-07: der Verbindungs-Reservierungs-Leck. `login()` haengt in `page.waitForURL` (60 s), weil der `requestClient`-Pool (max 25) erschoepft ist — in `pg_stat_activity` stehen 22 `grc_app`-Verbindungen, deren letztes Statement der Reservierungs-`set_config`-Block ist, seit 8 h 11 min idle. | OFFEN: Freigabe der reservierten Verbindung darf nicht allein an Nexts `after()` haengen. Ein Teilfix (Freigabe wenn `after()` wirft) ist drin. |
| 74  | `tests/e2e/regression/i-01-isms-setup-wizard.spec.ts`        | 7     | E2E-101: ISMS setup wizard initializes assessment + SoA                                                                                   | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 75  | `tests/e2e/regression/i-03-soa-diff-export.spec.ts`          | 19    | E2E-103b: SoA export delivers a downloadable file                                                                                         | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 76  | `tests/e2e/regression/i-04-management-review.spec.ts`        | 6     | E2E-104: management review can be created with pflicht-inputs                                                                             | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 77  | `tests/e2e/regression/i-05-nc-lifecycle.spec.ts`             | 7     | E2E-105: NC creation, valid transition, forbidden jump, closure-gate                                                                      | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 78  | `tests/e2e/regression/i-07-threat-heatmap.spec.ts`           | 6     | E2E-107: threat heatmap endpoints respond                                                                                                 | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 79  | `tests/e2e/regression/i-08-cve-flow.spec.ts`                 | 6     | E2E-108: CVE matches list returns and acknowledge endpoint exists                                                                         | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 80  | `tests/e2e/regression/n-01-nis2-reporting.spec.ts`           | 6     | E2E-301: NIS2 reporting tracker returns timeline                                                                                          | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 81  | `tests/e2e/regression/n-01-risk-form-validation.spec.ts`     | 25    | W19-N1: Risk-Create UI form - required validation + happy path + persistence                                                              | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 82  | `tests/e2e/regression/n-02-control-form-validation.spec.ts`  | 7     | W22-C1-02: Control-Create UI form - required validation + happy path + persistence                                                        | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 83  | `tests/e2e/regression/n-02-nis2-readiness.spec.ts`           | 6     | E2E-302: NIS2 readiness score endpoint returns score for 10 cats                                                                          | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 84  | `tests/e2e/regression/n-02-nis2-readiness.spec.ts`           | 18    | E2E-302b: NIS2 status returns 10 art21 requirements                                                                                       | **C** | C-07: der Verbindungs-Reservierungs-Leck. `login()` haengt in `page.waitForURL` (60 s), weil der `requestClient`-Pool (max 25) erschoepft ist — in `pg_stat_activity` stehen 22 `grc_app`-Verbindungen, deren letztes Statement der Reservierungs-`set_config`-Block ist, seit 8 h 11 min idle. | OFFEN: Freigabe der reservierten Verbindung darf nicht allein an Nexts `after()` haengen. Ein Teilfix (Freigabe wenn `after()` wirft) ist drin. |
| 85  | `tests/e2e/regression/n-03-finding-form-validation.spec.ts`  | 7     | W22-C1-03: Finding-Create UI form - required validation + happy path + persistence                                                        | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 86  | `tests/e2e/regression/n-04-dpia-form-validation.spec.ts`     | 8     | W22-C1-04: DPIA-Create UI form - required validation + happy path + persistence                                                           | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 87  | `tests/e2e/regression/n-05-audit-form-validation.spec.ts`    | 7     | W22-C1-05: Audit-Create UI form - required validation + happy path + persistence                                                          | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 88  | `tests/e2e/regression/n-06-vendor-form-validation.spec.ts`   | 7     | W22-C1-06: Vendor-Create UI form - required validation + happy path + persistence                                                         | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 89  | `tests/e2e/regression/n-07-contract-form-validation.spec.ts` | 8     | W22-C1-07: Contract-Create UI form - required + happy path + name-alias + Warning                                                         | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |
| 90  | `tests/e2e/regression/p-02-programme-create-flow.spec.ts`    | 7     | E2E-P02: create journey from ISO 27001 template instantiates phases and steps                                                             | **C** | C-02 + C-03: `POST /api/v1/programmes/journeys` antwortet 500, weil der INSERT ohne RLS-Kontext laeuft (C-01) — UND der 500-Body enthaelt das vollstaendige INSERT-Statement samt gebundener Werte (`org_id`, `owner_id`, `created_by`).                                                        | Route gewickelt; `reason: message` aus dem Body entfernt, Detail nur noch im Server-Log (erledigt).                                             |
| 91  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 GRC Composite Dashboard: /grc-composite renders without errors                           | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 92  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 Cross-Module Findings: /grc-findings renders without errors                              | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 93  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 AI-Act Annual Report (current year): /ai-act/annual-report renders without errors        | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 94  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 AI-Act Incidents Monitor: /ai-act/incidents/monitor renders without errors               | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 95  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 DPMS Deadline Monitor: /dpms/deadline-monitor renders without errors                     | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 96  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 BCMS Readiness Monitor: /bcms/readiness-monitor renders without errors                   | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 97  | `tests/e2e/regression/r-02-new-monitor-pages.spec.ts`        | 54    | R-02: New monitor + composite pages smoke > R-02 ISMS CAP Monitor: /isms/cap-monitor renders without errors                               | **C** | C-01: die Route hat kein `withErrorHandler`, laeuft daher ohne RLS-Kontext; `/api/v1/organizations/:id/modules` liefert `{"data":[]}`, `ModuleGate` zeigt auf jeder Seite den Teaser "Modul aktivieren".                                                                                        | Route in `withErrorHandler` gewickelt (erledigt).                                                                                               |
| 98  | `tests/e2e/regression/x-04-supplier-portal.spec.ts`          | 18    | E2E-404: an unknown DD token resolves to nothing                                                                                          | **B** | Der Handler antwortet 401 — und 401 ist hier korrekt: `validateDdToken` behandelt das Token als einzige Credential. Die erlaubte Statusliste `[400,404,410]` liess genau die richtige Antwort aus.                                                                                              | Liste um 401/403 erweitert, dafuer "nie 200" und "nie 5xx" einzeln zugesichert (erledigt).                                                      |
| 99  | `tests/e2e/regression/x-04-supplier-portal.spec.ts`          | 31    | E2E-404b: a malformed DD token is rejected, not crashed on                                                                                | **B** | Der Handler antwortet 401 — und 401 ist hier korrekt: `validateDdToken` behandelt das Token als einzige Credential. Die erlaubte Statusliste `[400,404,410]` liess genau die richtige Antwort aus.                                                                                              | Liste um 401/403 erweitert, dafuer "nie 200" und "nie 5xx" einzeln zugesichert (erledigt).                                                      |
| 100 | `tests/e2e/regression/x-05-whistleblowing.spec.ts`           | 34    | E2E-405b: whistleblowing cases follow the role list exactly                                                                               | **C** | C-07: der Verbindungs-Reservierungs-Leck. `login()` haengt in `page.waitForURL` (60 s), weil der `requestClient`-Pool (max 25) erschoepft ist — in `pg_stat_activity` stehen 22 `grc_app`-Verbindungen, deren letztes Statement der Reservierungs-`set_config`-Block ist, seit 8 h 11 min idle. | OFFEN: Freigabe der reservierten Verbindung darf nicht allein an Nexts `after()` haengen. Ein Teilfix (Freigabe wenn `after()` wirft) ist drin. |
| 101 | `tests/e2e/regression/x-06-framework-mapping.spec.ts`        | 6     | E2E-406: framework mappings list reachable                                                                                                | **A** | `module_definition` enthielt 11 der 20 `MODULE_KEYS`; `requireModule()` antwortet fuer ein fehlendes Key mit 404.                                                                                                                                                                               | `seed.ts` seedet jetzt alle 20 Definitionen + Selbstpruefung (erledigt).                                                                        |

---

## 6. Was behoben wurde

### Kategorie C — Produktdefekte (Prioritaet)

| #    | Befund                                                                                                                               | Ort                                                                                                               | Status                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| C-01 | 1.170 von 1.362 Routen ohne `withErrorHandler` → kein RLS-Kontext → 200 mit leerer Liste                                             | `apps/web/src/app/api/**/route.ts`, Mechanik in `apps/web/src/lib/api.ts:184-196` + `api-wrapper.ts:113-182`      | **behoben** (1.155 Dateien gewickelt; `withErrorHandler` gibt jetzt `WrappedRouteHandler` zurueck) |
| C-02 | 500-Body von `POST /programmes/journeys` enthaelt das SQL-Statement samt `org_id`/`owner_id`/`created_by`                            | `apps/web/src/app/api/v1/programmes/journeys/route.ts:130`                                                        | **behoben**                                                                                        |
| C-03 | `loadRoles()` ohne `ORDER BY` → aktive Organisation zufaellig, Suite vergiftet sich selbst                                           | `packages/auth/src/providers.ts:240`                                                                              | **behoben**                                                                                        |
| C-04 | `organization`-RLS `id = current_org` → Organisationsliste/Org-Switcher koennen nicht funktionieren                                  | Policy `org_isolation_select`; `apps/web/src/app/api/v1/organizations/route.ts:23`, `organizations/tree/route.ts` | **offen** (Vorgehen in 2. C-04)                                                                    |
| C-05 | Kontrastbefund gegen `#ffffff` statt gegen die reale Flaeche `#fbfaf9` geschlossen; 4.370:1 auf `/dashboard`                         | `apps/web/src/styles/globals.css:28-29`, Gate `src/__tests__/a11y/theme-contrast.test.ts`                         | **behoben**                                                                                        |
| C-06 | CSP blockiert ein eigenes Inline-Script auf `/dashboard` (`script-src ... 'nonce-...'`)                                              | `apps/web/src/middleware.ts` (CSP) + das erzeugende Script                                                        | **offen**                                                                                          |
| C-07 | Reservierte DB-Verbindungen werden nicht freigegeben; nach ~25 abgebrochenen Anfragen haengt jede authentifizierte Anfrage dauerhaft | `apps/web/src/lib/api.ts:174`, `packages/db/src/request-context.ts:169`, Pool `packages/db/src/index.ts:295`      | **teilweise** (Freigabe im `catch`-Zweig ergaenzt; Hauptpfad offen)                                |

### Kategorie A — Seed

- `packages/db/src/seed.ts` — seedet alle 20 `MODULE_KEYS` als `module_definition`, setzt
  `is_active_in_platform`, und **wirft**, wenn danach noch ein Key fehlt.
- `packages/db/src/seed-demo.ts` (**neu**) — portabler Runner ueber `DATABASE_URL`, ohne psql,
  vollstaendige Datei- und Abhaengigkeitsreihenfolge (Referenz-Kataloge → `00_platform` →
  Demo-Module), Rollback nach Fehlern, Exit != 0. `packages/db/package.json`:
  `db:seed:demo`.
- `scripts/seed-demo.sh` — delegiert dorthin; die verschluckenden psql-Aufrufe sind weg.
- `packages/db/sql/seed_demo_00_platform.sql` — Personas login-unfaehig (Sentinel-Hash +
  `must_change_password`), Adressen kollisionsfrei, Rollenvergabe fuer die echten
  Administratoren auf beiden Demo-Mandanten.
- `packages/db/sql/seed_demo_12_ai_act.sql` — jsonb-Spalten korrekt befuellt; Mandant auf
  `ccc4cc1c…` vereinheitlicht.
- `packages/db/sql/seed_demo_01_assets_isms.sql` — SoA-Eintraege loesen den
  `control_catalog_entry` ueber den Annex-A-Code statt ueber tote UUIDs auf.

**Gemessene Wirkung auf der laufenden Datenbank** (vorher → nachher):

| Tabelle                             |        vorher |       nachher |
| ----------------------------------- | ------------: | ------------: |
| `catalog`                           |             1 |            37 |
| `control_catalog_entry`             |             0 |            97 |
| `module_definition`                 |            11 |            21 |
| `asset`                             |             0 |            10 |
| `control`                           |             0 |            18 |
| `risk`                              |             3 |            23 |
| `vendor` / `audit` / `dpia` / `kri` | 0 / 0 / 0 / 0 | 5 / 2 / 2 / 5 |
| `finding`                           |             0 |            10 |
| `ai_system` (AIS-001 … AIS-005)     |             0 |             5 |
| `soa_entry`                         |             0 |           101 |

Alle 54 Seed-Dateien laufen jetzt fehlerfrei durch; vorher meldete das Kommando "Done." ueber
einer leeren Datenbank.

### Kategorien B und D

- `apps/web/e2e/api-auth.spec.ts` — RFC-7807-Form; zusaetzlich abgesichert: kein Redirect,
  kein HTML.
- `tests/e2e/regression/x-04-supplier-portal.spec.ts` — 401/403 in die Liste aufgenommen,
  "nie 200" und "nie 5xx" separat zugesichert.
- `tests/e2e/regression/f-02-org-create.spec.ts` — paginiert mit `limit=100` und prueft den
  HTTP-Status; F-02b nennt in der Fehlermeldung die Plattform-Admin-Provisionierung.
- `apps/web/e2e/navigation.spec.ts` — Selektor auf `a[href="/risks"]`.
- **Mandanten-Fixture (neu):** `E2E_ORG_ID` in `apps/web/e2e/auth.setup.ts` und
  `tests/e2e/fixtures/auth.ts`. Ohne die Variable aendert sich nichts; gesetzt, wird die Suite
  auf den Mandanten festgenagelt, den `db:seed:demo` befuellt, und ein fehlgeschlagener Wechsel
  ist ein harter Fehler. Das schliesst die Luecke, die C-03 im Testlauf oeffnet, und die
  Root-Config im eigenen Kommentar beklagt ("until the suites carry per-worker fixtures").

### Verifikation

- `npx tsc --noEmit -p apps/web/tsconfig.json` — **0 Fehler**.
- `cd apps/web && npx vitest run` — **101 Dateien, 2.430 Tests, alle gruen.**
  (Die vier `*-rbac-matrix`-Tests lesen die Rollen per Regex aus dem Routen-Quelltext; ihr
  Extraktor kennt jetzt zusaetzlich die gewickelte Exportform. Die RBAC-Erwartungen selbst
  sind unveraendert — es waeren sonst 50 Tests gewesen, die nichts mehr pruefen.)
- `npx tsc --noEmit` in `packages/db` und `packages/auth` — 0 Fehler.

### Zusaetzlich behoben: 90-Sekunden-Haenger in der Suite (D)

`await page.waitForLoadState("networkidle")` steht 52x in vier Web-Specs und hat **kein
eigenes Timeout** — es wartet, bis der TEST ablaeuft, also 90 s. Auf der neu befuellten
Datenbank erreichen `/esg`, `/audit`, `/dpms` und `/contracts` nie "networkidle" (ein Widget
pollt), und vier Specs, die vorher gruen waren, wurden zu 90-Sekunden-Haengern, deren Meldung
`waitForLoadState` nennt statt der eigentlichen Zusicherung.

Ersetzt durch `awaitAppReady(page)` — den Helfer, den WP11/S11-15 genau dafuer eingefuehrt hat
(`apps/web/e2e/fixtures/wait.ts`): `domcontentloaded`, dann 15 s Kulanz fuer das Netz, dann
weiter. Nichts wird abgeschwaecht: die Zusicherung danach ist die eigentliche Pruefung und
wiederholt sich selbst. Nebeneffekt: der Lauf wird um Stunden kuerzer.

---

## 6a. Gemessenes Ergebnis

**Was gemessen werden konnte.** Die laufende Instanz ist ein Produktionsbuild von `86ed0134`;
Anwendungscode-Korrekturen (C-01, C-02, C-03, C-05, C-07-Teilfix) wirken erst nach
`npm run build` + Neustart. Gemessen sind daher **Seed- und Testseite gegen den alten Build**.

Teillauf nach den Seed- und Testkorrekturen, bis zu dem Punkt, an dem der urspruengliche Lauf
43 Fehlschlaege hatte (Test 65 von 196):

|                                     | urspruenglich | nach den Seed-/Test-Fixes |
| ----------------------------------- | ------------: | ------------------------: |
| Fehlschlaege in den ersten 65 Tests |            43 |                        43 |

Die Zahl steht still, aber die **Zusammensetzung** hat sich geaendert:

- **gruen geworden:** `api-auth.spec.ts:4` und `:23` (B, RFC 7807) sowie `catalogs.spec.ts:8`
  (A, Kataloge 1 → 37).
- **neu rot:** vier Specs (`cross-module-workflows.spec.ts:72`, `:111`, `:153`, `:163`), die
  vorher nur deshalb gruen waren, weil auf dem leeren Mandanten nichts pollte — die
  `networkidle`-Haenger oben. Deren Ursache ist gefunden und behoben, aber nicht mehr gemessen.
- **unveraendert rot:** alles, was an C-01 haengt — also die Mehrheit. Das ist zu erwarten:
  `ModuleGate` bekommt seine Modulliste weiterhin leer, weil die Korrektur im Build fehlt.

**Warum der Vollauf nicht abgeschlossen wurde.** Beim Neustart des vollstaendigen Laufs blieb
`auth.setup` zweimal in `page.evaluate(fetch("/api/auth/session"))` haengen — **C-07**: der
Request-Pool der laufenden Instanz ist seit dem urspruenglichen Lauf leergelaufen (22 von 25
Verbindungen reserviert, seit 8 h idle). Die Instanz beantwortet `/api/health` in 121 ms, aber
keine authentifizierte Anfrage mehr. Das ist kein Messproblem, sondern der Befund selbst.

**Damit ist die belastbare Aussage:** von den 101 Fehlschlaegen sind 3 nachweislich gruen
geworden (#12, #13, #21) und 4 weitere Ursachen (die `networkidle`-Haenger) gefunden und
behoben; alles Uebrige haengt an einem Build und einem Neustart, die ich hier nicht ausfuehren
konnte.

---

## 7. Was offen bleibt

1. **Ein Build und ein erneuter Vollauf stehen aus.** Die laufende Instanz ist ein
   Produktionsbuild von `86ed0134` (`node server.js`); die Korrekturen an C-01/C-02/C-03/C-05
   sind Anwendungscode und wirken erst nach `npm run build` + Neustart. Gemessen werden konnten
   deshalb nur die Datenbank- und Testseite. **Die Zahl der wieder gruenen Tests ist erst nach
   dem Rebuild belastbar.**
2. **C-04** (Organisationsliste unter RLS) und **C-06** (CSP-Inline-Script) — bewusst nicht
   blind geaendert; Begruendung und Vorgehen in Abschnitt 2.
3. **C-07, Hauptpfad** — die Freigabe der reservierten Verbindung. Solange sie nur an `after()`
   haengt, laeuft der Pool bei jedem Lauf mit Abbruechen wieder leer. **Die Instanz auf dem
   Rechner des Eigentuemers befindet sich aktuell in genau diesem Zustand und braucht einen
   Neustart des `node server.js`-Prozesses**, bevor weitere E2E-Messungen moeglich sind; ich
   habe sie nicht neu gestartet, weil das Arbeitsverzeichnis des Prozesses von aussen nicht
   feststellbar war und ein misslungener Start schlimmer waere als der jetzige Zustand.
4. **E: Testkonto** (#71). `admin@arctos.local` ist Plattform-Admin. Solange das so bleibt,
   kann F-02b nicht gruen werden, ohne seine Aussage zu verlieren. Das Konto gehoert ohne
   `--platform-admin` angelegt.
5. **Die uebrigen 1.170-Routen-Frage.** Alle sind gewickelt, aber keine wurde zur Laufzeit
   ueberprueft. Die Transformation ist pro Datei identisch und durch `tsc` und 2.430 Unit-Tests
   abgedeckt; der Erfolgspfad wird vom Wrapper unveraendert durchgereicht. Trotzdem gehoert
   nach dem Build ein Smoke-Durchlauf ueber die grossen Listenendpunkte, bevor das Ergebnis
   als bestaetigt gilt.
6. **Nicht angefasst:** kein Commit, kein Schema, keine Migration. `HEAD` steht unveraendert
   auf `28bc6f78`; geaendert sind 1.193 Dateien im Arbeitsverzeichnis plus die neue
   `packages/db/src/seed-demo.ts` (davon 1.168 die mechanisch gewickelten Route-Dateien).

7. **Hinweis zur Umgebung des Eigentuemers.** Zum Messen wurden auf
   `C:\Users\daimon\Downloads\grcfiles\arctos-audit-build` (Stand `86ed0134`) drei Dinge
   veraendert, die dort bestehen bleiben:
   - die Datenbank auf 5433 ist jetzt vollstaendig geseedet (Referenz-Kataloge, Demo-Daten,
     alle 20 Moduldefinitionen, Rollen der Admin-Konten auf beiden Demo-Mandanten);
   - in `apps/web/e2e/` und `tests/e2e/` sind die oben beschriebenen Test-Korrekturen und der
     `E2E_ORG_ID`-Pin gespiegelt, damit sie ueberhaupt messbar waren;
   - temporaere Hilfsdateien (`packages/db/_*.mjs`, `tests/e2e/regression/zz-probe.spec.ts`)
     sind wieder entfernt.

   Der Lauf, der das reproduziert:

   ```
   set E2E_EMAIL=admin@arctos.local
   set E2E_PASSWORD=...
   set E2E_ORG_ID=ccc4cc1c-4b09-499c-8420-ebd8da655cd7
   set TARGET_URL=http://127.0.0.1:3000
   npx playwright test --reporter=line
   ```

   **Vorher: `node server.js` neu starten** (C-07).
