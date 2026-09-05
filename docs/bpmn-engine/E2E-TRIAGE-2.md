# E2E-Triage 2 — ARCTOS, die 32 Restfehlschlaege

**Lauf 2 (Ausgangslage):** 196 Tests — 154 bestanden, **32 gescheitert**, 10 uebersprungen.
**Lauf 4 (nach dieser Runde, gemessen):** 196 Tests — **184 bestanden, 10 gescheitert, 2 uebersprungen**, Laufzeit 9,4 min.
**Stand:** `6362bcb6`, Branch `audit/full-2026-08-31`.
**Umgebung:** `http://127.0.0.1:3000`, Produktionsbau, PostgreSQL 17 auf Port 5433,
Demo-Bestand vorhanden, `E2E_ORG_ID` auf den Demo-Mandanten gepinnt,
`RATE_LIMIT_AUTH=1000/60` fuer den Testlauf (Begruendung unten, C-12).

Alle Befunde sind an dieser laufenden Instanz und an ihrer Datenbank **gemessen**.

---

## 1. Auswertung nach Kategorie

| Kat.  | Bedeutung                | Anzahl |
| ----- | ------------------------ | -----: |
| **A** | Seed-Luecke              |  **0** |
| **B** | Erwartung veraltet       |  **7** |
| **C** | **Echter Produktdefekt** | **23** |
| **D** | Test selbst kaputt       |  **1** |
| **E** | Umgebung                 |  **1** |
|       | **Summe**                | **32** |

Die Seed-Luecken aus Runde 1 sind vollstaendig geschlossen — **kein einziger** der
32 Restfehler geht noch auf fehlende Daten zurueck. Uebrig blieben zu zwei
Dritteln Produktdefekte, darunter **acht neue**, die erst sichtbar wurden,
nachdem C-01 aus Runde 1 die Anwendung ueberhaupt mit Daten versorgt hatte.

---

## 2. Kategorie C — die Produktdefekte, einzeln

### C-03b (10 Fehlschlaege) — die aktive Organisation blieb zufaellig: die ZWEITE Rollenabfrage hatte kein `ORDER BY`

**Codestelle:** `apps/web/src/auth.ts:44` `fetchFreshRoles()`.

Runde 1 hat C-03 in `packages/auth/src/providers.ts:263` (`loadRoles`) behoben —
das ist aber nur die Abfrage im **Anmeldevorgang**. Der `session`-Callback
(`apps/web/src/auth.ts:155-165`) liest die Rollen bei **jedem**
`/api/auth/session` frisch nach und **ersetzt** `token.roles`; diese zweite
Abfrage hatte kein `ORDER BY`. Sie bestimmt `roles[0].orgId` und damit die
aktive Organisation.

**Gemessen vorher** (frische Anmeldung ueber `/api/auth/callback/credentials`):

```
currentOrgId = 0103a430…  ("E2E-F02b-049448")
roles[]      = 0103a430, 3ad9b74f, 6d2a7cf8, 8b53e4a2, c0d04809,
               c2446a5c, ccc4cc1c, e06a2d4b, ed86f3e9   ← nach org_id sortiert
```

`0103a430` ist eine **Wegwerf-Organisation aus einem frueheren E2E-Lauf**:
0 Assets, 0 Controls, 0 SoA-Eintraege, 0 KI-Systeme. Der Demo-Bestand liegt in
`ccc4cc1c` (5 KI-Systeme, 18 Controls, 8 SoA-Eintraege, 10 Assets, 20 Risiken,
10 Findings, 5 Lieferanten — je Org gezaehlt). Damit ist erklaert, warum #4, #5
(`AIS-001`), #11, #12 (`kontrollen|controls`), #13 (`INC`) und #15
(`tr, [role=row]`) rot waren: die Suite prueft gegen einen **leeren Mandanten**.
Fuer das Produkt heisst derselbe Defekt: ein Nutzer mit mehreren
Mitgliedschaften landet bei jeder Anmeldung in einem anderen Mandanten.

_Behoben:_ `.orderBy(asc(createdAt), asc(orgId))`, dieselbe Ordnung wie in
`loadRoles` — Anmeldung und Sitzungsauffrischung duerfen sich nicht
widersprechen. **Nachgemessen nach dem Neubau:**
`activeOrg = 6d2a7cf8 (Arctis Group GmbH)`, die aelteste Mitgliedschaft,
deterministisch.

_Umgebungsseitig zusaetzlich:_ auch deterministisch ist die aelteste
Mitgliedschaft **nicht** der Demo-Mandant. Die Suite gehoert mit
`E2E_ORG_ID=ccc4cc1c-4b09-499c-8420-ebd8da655cd7` gegen den Mandanten
festgenagelt, den `db:seed:demo` fuellt (Schalter existiert seit Runde 1).

### C-04 (2 Fehlschlaege, aus Runde 1 offen) — `organization` liess keine Auflistung ueber die aktive Org hinaus zu

**Codestelle:** Policy `org_isolation_select`,
`packages/db/drizzle/0000_lethal_scorpion.sql:202`:
`USING (bypass OR id = current_setting('app.current_org_id'))`.

**Gemessen vorher** (Sitzung mit 9 Mitgliedschaften, aktive Org `ccc4cc1c`):

```
GET /api/v1/organizations?limit=100  -> 1 Eintrag  (nur die aktive Org)
GET /api/v1/organizations/tree       -> 1 Knoten,  children: []
```

Der Org-Switcher listet die Organisationen, in die gewechselt werden koennte —
und bekam immer nur die, in der man schon ist. Er konnte prinzipiell nicht
funktionieren. Ebenso war eine frisch angelegte Tochter fuer ihren Ersteller
unsichtbar, obwohl `POST /organizations` ihm im selben Commit `admin` gibt.

_Behoben ueber die Mitgliedschaft, nicht ueber eine gelockerte Policy_ —
Migration **`packages/db/drizzle/0440_organization_membership_select.sql`**:

- SECURITY-DEFINER-Funktion `public.auth_user_is_org_member(uuid, uuid)` liest
  `user_organization_role`. SECURITY DEFINER ist noetig, weil diese Tabelle
  selbst unter `org_id = current_org` steht: eine Unterabfrage in der Policy
  saehe nur Rollen der AKTIVEN Org und koennte die Frage „in welchen Orgs bin
  ich Mitglied?" gar nicht beantworten. Gehaertet wie 0412 (S01-13): fixierter
  `search_path`, `REVOKE ... FROM PUBLIC`, gezielter `GRANT` an `grc_app`.
- Zusaetzliche Policy `organization_membership_select` **FOR SELECT**:
  Mitgliedschaft ODER `id IN (SELECT app_current_org_scope())` — die
  Nachfahrenmenge aus 0396, die WP2/S01-06 bereits als „eigene Daten"
  entschieden hat und ohne die `/organizations/tree` die Hierarchie nicht
  zeigen kann.
- `org_isolation_modify` bleibt unangetastet und ist weiterhin die **einzige**
  Policy, die UPDATE/DELETE auf `organization` erlaubt. Die Invariante, auf der
  WP2 die Korrektheit von `app_current_org_scope()` aufbaut („ein Mandant kann
  eine fremde Org nicht zur eigenen Nachfahrin machen"), gilt unveraendert.
  Selbstpruefungen in der Migration erzwingen `polcmd = 'r'` und einen leeren
  `WITH CHECK`.

**Nachgemessen, ohne Neubau — nur Migration:**

```
GET /api/v1/organizations?limit=100  -> 9 Eintraege  (= genau die 9 Mitgliedschaften)
GET /api/v1/organizations/tree       -> 4 Wurzeln, 9 Knoten, Hierarchie sichtbar
```

**Gegenprobe Isolation** — die 14 Organisationen ohne Mitgliedschaft, je
einzeln geprueft:

```
gelistet = false | GET /api/v1/organizations/<id> = 404 | switch-org = 403
```

Kein Datensatz irgendeiner anderen Tabelle wird durch die Policy lesbar.

### C-05b (2 Fehlschlaege) — der Kontrastbefund wurde zum dritten Mal gegen die falsche Flaeche geschlossen

- `apps/web/src/app/(dashboard)/dashboard/modern-dashboard.tsx:431` — die
  Aktions-Chips des Audit-Trails: `text-emerald-600` auf `bg-emerald-50` =
  **3.47:1**, `text-red-500` auf `bg-red-50` = **3.48:1**, beide bei 10 px, also
  ohne die 3:1-Ausnahme fuer grosse Schrift. axe meldet beide als _serious_.
  _Behoben:_ `emerald-700` (5.09:1), `red-700` (5.87:1). `blue-600` ist
  theme-ueberschrieben und besteht bereits — gemessen, nicht angenommen.
- `apps/web/src/app/(dashboard)/risks/new/page.tsx:394` — der Schritt-Button:
  `text-gray-400` auf `bg-gray-100` = **4.47:1** (`#757069` auf `#f6f4f2`,
  14 px). Runde 1 hat gegen `#ffffff` **und** `#fbfaf9` gemessen;
  `--color-gray-100` = `#f6f4f2` ist dunkler als beide. Auf dieser Flaeche
  laesst sich `gray-400` nicht reparieren, ohne `gray-500` (dort 4.61:1) zu
  ueberholen und die Hierarchie zu zerstoeren — es ist keine
  Fliesstext-Farbe auf `gray-100`. _Behoben:_ die Aufrufstellen auf
  `text-gray-600` (6.94:1); dieselbe Stelle zusaetzlich in `admin/roles`,
  `isms/threat-landscape`, `bcms/exercises/[id]`, `connectors`,
  `esg/report/[year]`.

### C-06 (1 Fehlschlag, aus Runde 1 offen) — die CSP blockiert das Anti-Flash-Script von `next-themes`

**Gemessen am gerenderten Dokument:** 23 `<script>`-Tags, **22 mit Nonce, genau
eines ohne** — das synchrone Inline-Script, das `next-themes` schreibt, um das
gespeicherte Theme vor dem ersten Paint anzuwenden. Next stempelt sein Nonce
nur auf die Scripts, die **es** erzeugt; von diesem weiss es nichts, weil es
Markup einer Komponente ist. Seit WP12/S12-04 `script-src` von
`'unsafe-inline'` auf `'nonce-…' 'strict-dynamic'` umgestellt hat, wird es auf
**jeder Seite** blockiert. Die CSP ist richtig — dem Script fehlt das Nonce.

Fachliche Wirkung ueber die Konsolenmeldung hinaus: wer `dark` oder
`high-contrast` gespeichert hat, sieht bis zur Hydration das Default-Theme —
genau das Flackern, das dieses Script verhindern soll.

_Behoben:_ `apps/web/src/components/theme-provider.tsx` nimmt `nonce` entgegen
und reicht es an `NextThemesProvider`; `apps/web/src/app/layout.tsx` liest es
aus dem `x-nonce`-Request-Header, den die Middleware ohnehin setzt.
**Nachgemessen:** `platform-smoke:288` („dashboard has no console errors")
besteht in Lauf 4.

### C-07 (Hauptpfad, aus Runde 1 offen) — reservierte Verbindungen wurden nur ueber `after()` freigegeben

**Codestelle:** `apps/web/src/lib/api.ts` (`establishRequestScopedContext`,
`after(reserved.release)`), Pool `requestClient` mit `max: 25`
(`packages/db/src/index.ts:295`).

**Erneut gemessen, waehrend dieser Triage:**

```
select usename, state, count(*) from pg_stat_activity where datname='grc_platform' group by 1,2;
  grc_app | idle | 25     ← alle 25 Verbindungen des Request-Pools
```

Der Pool war leer; **jede** authentifizierte Anfrage blieb an
`requestClient.reserve()` haengen (meine eigene Messung lief nach 3 Minuten in
`UND_ERR_HEADERS_TIMEOUT`). Nur ein Neustart raeumte das auf. Fuer eine
Produktionsinstanz: nach rund 25 abgebrochenen Anfragen stellt die Anwendung
den Dienst fuer angemeldete Nutzer ein und erholt sich nicht.

_Die Entscheidung_, die Runde 1 offen gelassen hatte: **kein** blankes
`finally` um den Handler. Eine Route, die einen noch nicht produzierten Stream
zurueckgibt (`/audit-log/archive` als ZIP, die Report-PDFs, die CSV-Exporte),
liest die Datenbank **waehrend** der Body konsumiert wird; ein `finally` zoege
ihr die Verbindung darunter weg.

_Behoben_ in `apps/web/src/lib/api-wrapper.ts`
(`releaseReservedWhenSettled`) — die Freigabe haengt an der **Antwort**, an
drei Ausloesern:

1. kein Body → sofort;
2. mit Body → der Body wird in einen `pull`-getriebenen Stream gewickelt, der
   freigibt, wenn die Quelle endet, scheitert oder abgebrochen wird
   (Backpressure unveraendert);
3. **das Abbruchsignal der Anfrage.** Das ist der Fall, den weder `after()`
   noch ein reiner Body-Hook erwischt: bricht der Client ab, bevor die Antwort
   geschrieben wird, verwirft die Laufzeit das Body-Objekt, ohne es je zu lesen
   oder zu canceln. Zwischenmessung mit nur den ersten beiden Ausloesern:
   25 von 28 Verbindungen wieder sechs Minuten lang belegt, auf den
   Widget-Abfragen von Seiten, von denen Playwright laengst weggeblaettert war.
   Der Abbruch-Handler **cancelt zuerst den Reader** und gibt erst danach frei,
   damit ein noch laufender Stream-Generator die Verbindung nicht weiterbenutzt,
   nachdem sie im Pool liegt.

Der Listener wird erst angehaengt, **nachdem** der Handler zurueckgekehrt ist;
ein Abbruch mitten im Handler kann ihm die Verbindung also nicht entziehen.
`releaseRequestContext` ist idempotent, `after()` bleibt als weiteres Netz.

**Nachgemessen nach dem Neubau:** waehrend des Laufs zeigen Verbindungen den
Scrub-Aufruf `SELECT set_config('app.current_user_id', '', false)` — sie
kehren aufgeraeumt in den Pool zurueck. Der Pool lief in Lauf 4 nicht mehr
leer; die Laufzeit der Suite fiel von „ueber 40 Minuten mit Haengern" auf
**9,4 Minuten**.

### C-08 (2 Fehlschlaege) — Schema-Drift: `notification_channel` kennt `'both'` nicht, 40 Aufrufstellen benutzen es

**Codestelle:** `packages/db/src/schema/platform.ts:137` deklariert
`["in_app","email","teams","both"]`; die Datenbank kennt **drei** Werte.
Es hat nie eine Migration gegeben, die `both` hinzufuegt. Weil der
TypeScript-Typ aus der Drizzle-Deklaration kommt, typprueft `channel: "both"`
anstandslos — **40 Aufrufstellen** benutzen es (gegen 6× `in_app`, 4× `email`).

**Gemessen** (requestId `7d9f8d1dfcba66b1`):

```
PUT /api/v1/processes/<id>/ropa-profile -> 500
Serverlog: Failed query: insert into "notification" (...)
           params: …,approval_request,dpia,…,both,dpia_auto_created,…
```

Betroffen: Prozess-Statuswechsel und Freigabeketten, die automatische
DSFA-Anlage aus dem ROPA-Profil, Findings- und Control-Statuswechsel,
Task-Zuweisungen, KRI-Schwellwertverletzungen, Policy-Verteilungen, der Abbruch
von Signaturanfragen. In jedem Fall ist die fachliche Handlung bereits
geschrieben, wenn die Benachrichtigung scheitert — der Aufrufer sieht einen 500
auf eine Aktion, die stattgefunden hat.

_Behoben:_ Migration **`packages/db/drizzle/0441_notification_channel_both.sql`**
(`ALTER TYPE … ADD VALUE IF NOT EXISTS`; `migrate-all.ts:66` erkennt das Muster
und faehrt die Datei ausserhalb einer Transaktion). Der Drift wird in die
Richtung aufgeloest, in die das Schema zeigt — `platform-advanced.ts:89` setzt
`both` sogar als Spalten-Default.

**Nachgemessen, ohne Neubau — nur Migration:**
`PUT /api/v1/processes/<id>/ropa-profile` → **200**, DSFA wird angelegt.

### C-09 (4 Fehlschlaege) — `POST /api/v1/processes` lieferte kein `data.id`

**Codestelle:** `apps/web/src/app/api/v1/processes/route.ts` antwortete
`{ data: { process, version } }`. Jedes andere Create im Produkt antwortet
`{ data: <entity> }` (`/findings`, `/vendors`, `/audit-mgmt/audits`,
`/organizations` — gemessen).

Das ist kein Testproblem: **die eigene Oberflaeche liest genau `data.id`.**
`apps/web/src/app/(dashboard)/processes/new/page.tsx:199`:

```ts
const processId = json.data?.id;
router.push(processId ? `/processes/${processId}` : "/processes");
```

Wer einen Prozess ueber das Formular anlegt, wird seit jeher auf die **Liste**
zurueckgeworfen statt in den soeben angelegten Prozess. Nichts im Repository
liest `data.process` oder `data.version`. In der Suite wurde daraus der String
`"undefined"` in der Folgeanfrage — daher
`PUT /api/v1/processes/undefined/ropa-profile → 500` im Serverlog.

_Behoben:_ `return Response.json({ data: result.process }, { status: 201 })`.
**Nachgemessen:** `POST /api/v1/processes` → `data.id` gesetzt.

### C-10 (Folgedefekt zu C-01) — 15 Route-Dateien hatten weiterhin einen ungewickelten Handler

Die Sweep aus Runde 1 hat 1.155 Dateien gewickelt, in 15 aber den **POST**
stehen lassen: `vendors`, `tasks`, `assets`, `isms/{incidents,threats,
vulnerabilities}`, `kris`, `processes`, `bcms/bia`, `playbooks`,
`audit-mgmt/audits`, `dpms/{dpia,ropa}`, `automation/rules/[id]/test`,
`risk-acceptances`.

**Gemessen** — jede Prozessanlage schrieb ins Serverlog:

```
[EventBus] Failed to persist event_log: new row violates row-level security
policy for table "event_log"   (SQLSTATE 42501)
```

`emitEntityCreated()` laeuft nach dem Commit ohne reservierte Verbindung, also
ohne `app.current_org_id`; die `event_log_tenant_insert`-Policy weist die Zeile
ab. Der Audit-/Webhook-Ereignisstrom war fuer alle Anlagen dieser Endpunkte
**still leer**.

_Behoben:_ 14 davon in `withErrorHandler` gewickelt. `risk-acceptances` POST
bleibt bewusst ungewickelt — er nimmt keinen Request, ruft kein `withAuth` und
beruehrt keine Datenbank (konstante 405).

### C-11 (1 Fehlschlag) — `POST /audits/[id]/checklists` verlangte ein Feld, das es ignoriert

**Codestelle:** `createAuditChecklistSchema`
(`packages/shared/src/schemas/audit.ts:169`) deklariert `auditId` als
**Pflichtfeld**; der Handler
(`apps/web/src/app/api/v1/audit-mgmt/audits/[id]/checklists/route.ts:46`)
benutzt ausschliesslich die Id aus dem Pfad und das Body-Feld gar nicht.

**Gemessen:** `POST …/audits/<id>/checklists` mit
`{"name":"T","sourceType":"custom"}` → **422 `auditId: Required`**. Der Endpunkt
war nur benutzbar, wenn man die Id im Body wiederholte.

_Behoben:_ der Handler parst mit `.partial({ auditId: true })`; ein trotzdem
mitgeschicktes, **abweichendes** `auditId` wird weiterhin mit 422 abgewiesen —
still auf die Pfad-Id zu schreiben waere schlimmer als der 422, den das ersetzt.

### C-12 (3 Fehlschlaege) — der Org-Wechsel teilte sich den Login-Eimer

**Codestelle:** `apps/web/src/lib/rate-limit.ts`, Praefix `/api/v1/auth/` mit
der `auth`-Policy: **10 Anfragen pro Minute, nach Client-Adresse
geschluesselt, fail-closed**. Darunter fiel auch
`POST /api/v1/auth/switch-org` — der keine Anmeldung ist: er verlangt eine
bestehende Sitzung, praesentiert kein Credential und schreibt nur das
Org-Cookie um, nachdem er das Ziel gegen die Rollen der Sitzung geprueft hat.

**Gemessen:** `E2E-401` bekam **429** beim Wechsel in die Organisation, in der
seine eigene Sitzung bereits war. Drei weitere Specs (#23 f-17, #30 p-04,
#32 x-01b) liefen danach in `page.waitForURL: Timeout 60000ms` — die
Login-Seite navigierte nicht mehr, weil das gemeinsame Adress-Budget
aufgebraucht war. In Produktion ist die Form schlimmer: elf Org-Wechsel pro
Minute aus einem Buero sperren **alle** hinter dieser Adresse vom Anmelden aus,
fail-closed, ohne degradierten Modus.

_Behoben:_ eigene Policy `session-switch` fuer `/api/v1/auth/switch-org`,
oberhalb von `/api/v1/auth/` (erster Praefix-Treffer gewinnt),
**subjektgeschluesselt** und weiterhin gedeckelt. Die Anmeldeflaechen
(`/api/auth/callback`, `/api/auth/signin`, `/api/v1/sso/`, `/api/v1/scim/`)
bleiben unveraendert adressgeschluesselt und fail-closed — der Unit-Test
„keys anonymous auth buckets on the address, not the subject" bleibt gruen.

_Zusaetzlich:_ `tests/e2e/fixtures/auth.ts` benennt einen 429 auf dem Login
jetzt ausdruecklich, statt 60 Sekunden auf eine Navigation zu warten, die nicht
mehr kommen kann.

### C-13 (1 Fehlschlag) — sechs Bedienelemente auf `/risks` ohne zugaenglichen Namen

axe meldet `button-name` mit Wirkung **critical**:

- `apps/web/src/components/ui/data-table.tsx:138/145` — die beiden
  Blaetter-Buttons, nur ein Icon. **Jede** Listenansicht des Produkts benutzt
  diese Komponente; ein Screenreader-Nutzer hoert „Button, Button" und kann
  keine Tabelle blaettern. Dieselbe Kopie in
  `apps/web/src/app/(dashboard)/audit-log/page.tsx:1385/1392`.
- `apps/web/src/app/(dashboard)/risks/page.tsx:645` — der
  Aktualisieren-Button (`<RefreshCcw/>`, sonst nichts) und die vier
  `SelectTrigger` (Status, Kategorie, Verantwortlicher, Massenaktion).

_Behoben:_ `aria-label` + `title` an allen, `aria-hidden` auf den Glyphen; die
Blaetter-Beschriftungen sind Props mit englischem Default, passend zur uebrigen
(unuebersetzten) Chrome dieser Komponente.

### C-14 (neu, 1 Fehlschlag; erst nach C-09 sichtbar) — jeder Prozess-Statuswechsel antwortete 500

**Codestelle:** `apps/web/src/lib/process-gates.ts:74/80`. Die beiden
`NOT IN`-Listen nannten je ein Label, das ihr Enum nicht hat:

```
finding_status = identified, in_remediation, remediated, verified, accepted, closed   -> kein 'cancelled'
risk_status    = identified, assessed, treated, accepted, closed, reopened            -> kein 'mitigated'
```

PostgreSQL weist die **ganze** Anweisung mit SQLSTATE 22P02 zurueck. Weil diese
Abfrage bei **jedem** Statuswechsel laeuft, antwortete
`PUT /api/v1/processes/:id/status` auf jeden Schritt
draft → in_review → approved → published mit **500**: die BPMN-Freigabe- und
Veroeffentlichungskette war unbenutzbar. Sichtbar wurde das erst, als C-09
behoben war und die Aufrufer diese Route ueberhaupt erreichten.

_Behoben:_ nur die beiden unmoeglichen Labels entfernt; welche der **echten**
Labels als „abgeschlossen" gelten, bleibt unveraendert.
**Nachgemessen:** `PUT /api/v1/processes/<id>/status` → **422 „Transition
blocked by unmet gates"** statt 500 — genau das, was
`bpm-approval-pipeline.spec.ts:51` erwartet.

### C-15 (neu, 2 Fehlschlaege) — drei API-Routen fehlen im Repository, weil `.gitignore` sie wieder ausschliesst

**Codestelle:** `.gitignore`. Zeile 17 nimmt API-Routen namens `coverage`
ausdruecklich von der Testartefakt-Regel aus (`#WAVE14-CROSS-05`, mit dem
Kommentar _„so future routes (e.g. processes/[id]/coverage) are tracked too"_).
Zeile 79 — spaeter aus der Audit-Remediation hinzugefuegt — setzt mit
`**/coverage/` diese Ausnahme wieder ausser Kraft: in `.gitignore` gewinnt die
**zuletzt** passende Regel.

Folge: drei Routendateien sind nicht versioniert —

```
apps/web/src/app/api/v1/compliance/coverage/route.ts
apps/web/src/app/api/v1/audit-mgmt/universe/coverage/route.ts
apps/web/src/app/api/v1/processes/[id]/coverage/route.ts
```

**Gemessen am Produktionsbau des Eigentuemers:** keine der drei steht in
`app-paths-manifest.json`, und `POST /api/v1/processes/<id>/coverage` antwortet
dort mit der **HTML-404-Seite**. `bpm-approval-pipeline` und `process-portal`
scheitern genau daran — das Framework-Mapping ist das harte Gatter fuer
approved → published.

_Behoben:_ die Ausnahme steht jetzt **nach** `**/coverage/` (das Verzeichnis
selbst muss ausgenommen werden, nicht die Datei darin — eine Datei laesst sich
nicht wieder einschliessen, wenn ihr Verzeichnis ausgeschlossen ist).
Verifiziert: die drei Routen sind trackbar, `apps/web/coverage/` &c. bleiben
ignoriert. **Die drei Dateien muessen noch eingecheckt werden** — ich committe
nicht.

---

## 3. Kategorien B, D, E

**B (7)** — veraltete Erwartungen; die geprueften Eigenschaften sind in allen
sieben Faellen **schaerfer** gefasst, nie schwaecher:

- **#6 audit-cis, #22 f-15** — `/api/v1/catalogs?type=control&limit=200` wird
  mit 422 abgewiesen (`paginate()` deckelt auf 100), gemessen. Beide Specs
  paginieren jetzt mit 100 **und** pruefen den Status, statt den 422 als „nicht
  geseedet" zu melden.
- **#24 i-01** — der Setup-Wizard verlangt `name, description, frameworks[],
leadAssessorId, periodStart, periodEnd`
  (`packages/shared/src/schemas/isms.ts:223`); die Spec schickte
  `{scope, framework, methodKey}` — drei Felder, die das Schema nicht kennt → 422. `data` ist die `assessment_run`-Zeile, also `data.id`, nicht
  `data.assessmentId`. Die Spec spricht jetzt den echten Vertrag und prueft
  **201 exakt** (statt `[200,201]`), Status `planning`, das gesetzte Framework
  und die Gate-G1-Checkliste.
- **#25 i-03** — der Endpunkt hat kein `from`/`to`, sondern `?since=<ISO-8601>`
  (Run-Modus ueber `fromRunId`/`toRunId` ist 501); ohne Parameter antwortet er
  `400 Missing 'since' parameter`. Die alte Liste `[200, 404]` haette ausserdem
  ein **nicht existierendes** Endpoint als Erfolg durchgehen lassen. Jetzt:
  200 + Struktur (`totalChanged == created + modified`, `entries.*` Arrays) und
  501 fuer den Run-Modus. Gegen die Instanz verifiziert.
- **#26 n-02** — `data` ist das Readiness-Objekt, nie ein Array; die alte Zeile
  uebersprang sich zudem still, wenn `data` fehlte. Jetzt wird geprueft, was der
  Testname sagt: **zehn** Art.-21(2)-Anforderungen (a–j), gegen die Instanz
  verifiziert.
- **#27 n-03, #28 n-05** — die Specs navigierten auf `/findings/<id>` bzw.
  `/audit-mgmt/audits/<id>`. **Beide Routen existieren nicht**; die Seite war
  die 404-Seite, gemeldet als „Titel nicht persistiert". Die Detailansichten
  sind `controls/findings/[id]` und `audit/executions/[id]`. Zusaetzlich wird
  jetzt geprueft, dass die Navigation dort auch landet.

**D (1)** — **#29 n-06**: `category: "saas"` war nie ein gueltiger Wert
(`vendorCategoryValues`, `packages/shared/src/schemas/tprm.ts:19`). Der „Happy
Path" hat nie einen Happy Path geprueft. Auf `cloud_provider` korrigiert; die
Zusicherung, dass eine **unbekannte** Kategorie 422 ergibt, steht unveraendert
im selben Test. (Der Persistenz-Schritt zeigte zusaetzlich auf `/vendors/<id>`,
das es nicht gibt — die Detailansicht ist `tprm/vendors/[id]`.)

**E (1)** — **#21 f-02b**, unveraendert aus Runde 1: das Konto `E2E_EMAIL` ist
Plattform-Admin, fuer den 201 beim Anlegen eines Top-Level-Mandanten die
**richtige** Antwort ist. Die Zusicherung bleibt 403; die Fehlermeldung nennt
die Provisionierung. Fix: E2E-Konto ohne `--platform-admin` anlegen.

---

## 4. Vollstaendige Tabelle (alle 32)

| #   | Spec / Test                 | Kat. | Ursache                                                       | Zustand in Lauf 4                             |
| --- | --------------------------- | ---- | ------------------------------------------------------------- | --------------------------------------------- |
| 1   | a11y-smoke:71 dashboard     | C    | C-05b (emerald/red-Chip 3.47 / 3.48:1)                        | **gruen**                                     |
| 2   | a11y-smoke:81 risk register | C    | C-13 (`button-name`, critical)                                | **gruen**                                     |
| 3   | a11y-smoke:90 risk wizard   | C    | C-05b (gray-400 auf gray-100, 4.47:1)                         | **gruen**                                     |
| 4   | ai-act-workflow:28          | C    | C-03b (leerer Wegwerf-Mandant)                                | **gruen**                                     |
| 5   | ai-act-workflow:34          | C    | C-03b                                                         | **gruen**                                     |
| 6   | audit-cis-ig-flow:23        | B    | `catalogs?limit=200` → 422                                    | **gruen**                                     |
| 7   | audit-cis-ig-flow:188       | C    | C-11 (`auditId` Pflicht, aber ignoriert)                      | **gruen**                                     |
| 8   | bpm-approval-pipeline:28    | C    | C-09; danach C-14; danach **C-15**; zuletzt Funktionstrennung | rot — laeuft jetzt bis Zeile 240/250          |
| 9   | bpm-ropa-flow:17            | C    | C-09 + C-08                                                   | **gruen**                                     |
| 10  | bpm-ropa-flow:73            | C    | C-09                                                          | **gruen**                                     |
| 11  | isms-workflow:85            | C    | C-03b                                                         | **gruen**                                     |
| 12  | isms-workflow:96 SoA        | C    | C-03b; Rest offen (s. Abschnitt 6)                            | rot                                           |
| 13  | isms-workflow:120           | C    | C-03b                                                         | **gruen**                                     |
| 14  | management-review:27        | C    | C-08; Rest offen (`actionElementId`)                          | rot                                           |
| 15  | platform-smoke:120          | C    | C-03b                                                         | **gruen**                                     |
| 16  | platform-smoke:152 org list | C    | **C-04**                                                      | **gruen**                                     |
| 17  | platform-smoke:288 console  | C    | **C-06**                                                      | **gruen**                                     |
| 18  | process-map:37              | C    | C-09; Rest offen (`childCount`)                               | rot                                           |
| 19  | process-portal:26           | C    | C-09; danach **C-15**                                         | **gruen** (nach dem C-15-Neubau nachgemessen) |
| 20  | f-02-org-create:16          | C    | **C-04**                                                      | **gruen**                                     |
| 21  | f-02-org-create:91          | E    | E2E-Konto ist Plattform-Admin                                 | rot (Umgebung)                                |
| 22  | f-15-checklist-catalog:8    | B    | `catalogs?limit=200` → 422                                    | **gruen**                                     |
| 23  | f-17-schema-drift:8         | C    | **C-12** (Login-Eimer leer)                                   | **gruen**                                     |
| 24  | i-01-isms-setup-wizard:7    | B    | Vertrag des Wizards veraltet                                  | **gruen**                                     |
| 25  | i-03-soa-diff-export:6      | B    | `?from/to` gibt es nicht                                      | **gruen**                                     |
| 26  | n-02-nis2-readiness:18      | B    | `data` ist ein Objekt                                         | **gruen**                                     |
| 27  | n-03-finding-form:7         | B    | `/findings/<id>` existiert nicht                              | **gruen**                                     |
| 28  | n-05-audit-form:7           | B    | `/audit-mgmt/audits/<id>` existiert nicht                     | **gruen**                                     |
| 29  | n-06-vendor-form:7          | D    | `category:"saas"` ist kein Enum-Wert                          | **gruen**                                     |
| 30  | p-04-dashboard:6            | C    | **C-12**                                                      | **gruen**                                     |
| 31  | x-01-org-switch:18          | C    | **C-12** (gemessen: 429)                                      | **gruen**                                     |
| 32  | x-01-org-switch:31          | C    | **C-12**                                                      | **gruen**                                     |

**27 von 32 sind gruen.** Von den fuenf verbleibenden ist einer die Umgebung
(#21, Plattform-Admin), einer die Funktionstrennung mit nur einem Testkonto
(#8), und drei sind neue, erst jetzt sichtbare Befunde (#12, #14, #18 —
Abschnitt 6).

---

## 5. Messungen

**Vollauf 4 (nach Neubau + Migrationen):**

```
196 Tests — 184 passed, 10 failed, 2 skipped   (9,4 min)
Lauf 2:    154 passed, 32 failed, 10 skipped
```

Die 10 Fehlschlaege aus Lauf 4: `bpm-approval-pipeline`, `process-portal`
(beide C-15), `isms-workflow:96`, `management-review:27`, `process-map:37`
(offen, s. Abschnitt 6), `f-02b` (Umgebung), `f-18-integrity` (Limiter, s. u.)
sowie **drei Tests, die vorher UEBERSPRUNGEN wurden** und jetzt tatsaechlich
laufen (`b-01-bia-lifecycle`, `b-02-bcp-lifecycle`, `i-02-assessment-lifecycle`).
Deren `test.skip(!id, "no BIA available")` griff bisher, weil die Suite im
leeren Mandanten lief; mit echten Daten schlagen sie auf eine veraltete
Erwartung an (`expect(gate).toMatchObject({ ok: expect.any(Boolean) })` — die
Gate-Antwort ist `{data:{b1,b2,coverageStats,snapshot}}`, ohne `ok`). Das ist
ein Gewinn an Abdeckung, kein Rueckschritt: die Zahl der uebersprungenen Tests
faellt von 10 auf 2.

**Ohne Neubau gemessen** (nur Migration bzw. Datenbank):

| Messung                                          | vorher                 | nachher                         |
| ------------------------------------------------ | ---------------------- | ------------------------------- |
| `GET /api/v1/organizations?limit=100`            | 1 Eintrag              | **9** (= alle Mitgliedschaften) |
| `GET /api/v1/organizations/tree`                 | 1 Knoten, keine Kinder | **9 Knoten, 4 Wurzeln**         |
| 14 Nicht-Mitglieds-Orgs: gelistet / GET / switch | –                      | **false / 404 / 403**           |
| `PUT /api/v1/processes/<id>/ropa-profile`        | **500**                | **200**, DSFA angelegt          |

**Nach dem Neubau gemessen:**

| Messung                                      | vorher                    | nachher                                  |
| -------------------------------------------- | ------------------------- | ---------------------------------------- |
| `session.currentOrgId` (frische Anmeldung)   | `0103a430` (Wegwerf-Org)  | **`6d2a7cf8`** (aelteste Mitgliedschaft) |
| `POST /api/v1/processes` → `data.id`         | `undefined`               | **gesetzt**                              |
| `PUT /api/v1/processes/<id>/status`          | **500**                   | **422 „blocked by unmet gates"**         |
| Verbindungen des Request-Pools nach dem Lauf | 25/25 belegt, Instanz tot | belegen sich nicht mehr; Scrub sichtbar  |
| Laufzeit der Suite                           | > 40 min mit Haengern     | **9,4 min**                              |

**Migrationen von Null** — frische Datenbank `grc_migcheck` auf dem Rechner des
Eigentuemers, Extensions wie in `docker/init-extensions.sql`, dann
`tsx src/migrate-all.ts`:

```
Pass 2: 4 recovered, 0 still failing
✓ 406/406 migrations applied
All migrations applied successfully.
```

(Ohne `pgcrypto`/`uuid-ossp` scheitern 27 Migrationen — das ist der bestehende
Setup-Weg, keine Folge dieser Aenderungen.)

**Gruen geblieben:**
`npx tsc --noEmit -p apps/web/tsconfig.json` → keine Ausgabe.
`cd apps/web && npx vitest run` → **101 Dateien, 2.430 Tests, alle bestanden.**

---

## 6. Offen

- **C-15: die drei `coverage`-Routen muessen eingecheckt werden.** Der
  `.gitignore` ist korrigiert; die Dateien selbst sind noch untracked (ich
  committe nicht). Ohne sie antwortet jeder frische Klon — und jedes
  Produktionsimage — auf `/api/v1/compliance/coverage`,
  `/api/v1/audit-mgmt/universe/coverage` und `/api/v1/processes/:id/coverage`
  mit 404. **Nachgemessen** mit der wiederhergestellten Route im Bau
  (`app-paths-manifest.json` enthaelt sie jetzt): `process-portal` ist
  **gruen**; Teillauf `bpm-approval-pipeline + process-portal + bpm-ropa-flow +
a11y-smoke + platform-smoke` = **48 von 49 bestanden**.
- **`bpm-approval-pipeline` (der eine Rest dieses Teillaufs).** Der Test laeuft
  jetzt bis Zeile **240 von ~250** (vorher: 41, dann 51, dann 111) und scheitert
  an einer Produktregel, die richtig arbeitet:
  `422 „Separation of duties: the person defining the approval chain cannot be
the reviewer"`. Die Suite hat genau **ein** Konto, das beide Rollen einnimmt.
  Das ist keine Produktschwaeche — die Spec braucht einen zweiten
  provisionierten Nutzer. Nicht abgeschwaecht.
- **`isms-workflow:96` (SoA-Seite).** `getByText(/kontrollen|controls/i)` findet
  nichts, obwohl das gerenderte HTML von `/isms/soa` den Text enthaelt
  (gemessen: `hasKontrollen true` bei 553 KB Seitenlaenge). Riecht nach einem
  Sichtbarkeits-/Hydrationsproblem, nicht nach fehlenden Daten — noch nicht
  eingeordnet.
- **`management-review:27`.** `POST /api/v1/isms/reviews/:id/items` liefert
  `actionWorkItemId` (gemessen), aber **kein** `actionElementId`; die Spec
  verlangt beides. Zu entscheiden, ob das Feld in der Antwort fehlt (C) oder
  die Erwartung veraltet ist (B) — nicht geraten.
- **`process-map:37`.** `parentTile.childCount` ist 0 statt >= 1, nachdem ein
  Kindprozess angelegt wurde. Erst jetzt sichtbar, weil C-09 die Spec vorher
  abbrach.
- **`f-18-integrity`.** Der Endpunkt antwortet direkt gemessen **200**; im Lauf
  war er es nicht. Die Ursache ist mit hoher Wahrscheinlichkeit die
  `AUDIT_INTEGRITY`-Policy mit **einer** Anfrage pro Minute
  (`rate-limit.ts`): seit die Suite viermal so schnell laeuft, fallen zwei
  Audit-Integritaetsabfragen in dieselbe Minute. Das Limit ist ungewoehnlich
  eng; ob es so gemeint ist, gehoert entschieden — die Spec wurde nicht
  angefasst.
- **`b-01`, `b-02`, `i-02`** (vorher uebersprungen, jetzt rot): veraltete
  Erwartung `{ ok: boolean }` gegen die tatsaechliche Gate-Antwort
  `{ data: { b1, b2, coverageStats, snapshot } }`. Gehoert in dieselbe
  B-Behandlung wie #24/#25/#26, war aber nicht Teil der beauftragten 32.
- **Login-Limit vs. Suite.** `RATE_LIMIT_AUTH` steht auf 10/min pro Adresse,
  fail-closed; die Regressions-Specs melden sich einzeln an (46 Anmeldungen aus
  einer Adresse). Das Produkt ist hier nicht falsch — die Suite braucht
  entweder einen erhoehten Wert in ihrer Umgebung (so gemessen:
  `RATE_LIMIT_AUTH=1000/60`) oder einen gemeinsamen Storage-State fuer das
  `regression`-Projekt. Der Fixture benennt den Fall jetzt, statt zu timeouten.
- **`E2E_ORG_ID`.** Auch mit deterministischer Rollenordnung ist die aelteste
  Mitgliedschaft nicht der Demo-Mandant. Bis `db:seed:demo` das Konto
  ausdruecklich im Demo-Mandanten verankert, muss die Suite gepinnt werden.
- **Schema-Drift-Endpunkt** meldet 4 fehlende Tabellen (`account`, `session`,
  `verification_token`, `audit_anchor_seal`) und antwortet deshalb 503. `f-17`
  toleriert bis zu 5; drei davon sind Auth.js-Adaptertabellen, die die
  JWT-Strategie nicht braucht — eigener offener Punkt.
- **Detailrouten.** `finding`, `audit` und `vendor` haben Detailseiten nur unter
  Modulpfaden (`controls/findings/[id]`, `audit/executions/[id]`,
  `tprm/vendors/[id]`), waehrend die Listen unter `/findings`, `/audit-mgmt`,
  `/vendors` liegen. Keine Fehlfunktion, aber die Ursache dafuer, dass drei
  Specs auf die 404-Seite zeigten.
