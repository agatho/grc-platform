# ARCTOS — Restdefekte O-2, O-3/O-4, O-6

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Branch:** `audit/full-2026-08-31`
**Grundlage:** `/work/audit/remediation/VERIFIKATION.md` Teil D (offene Punkte)
**Datum der Messungen:** 2026-09-01 · **Nicht committet** — alle Änderungen liegen als
Arbeitsbaum-Diff vor.

Gemessen wurde ausschliesslich gegen frisch von Null migrierte Datenbanken (`fix_*`,
`fix2_*`, `fix3_*`), nie gegen `grc_platform` im Container — siehe O-10. Alle
Testdatenbanken sind nach der Messung mit `dropdb` entfernt.

---

## Defekt 1 (hoch) — O-2: Mandantenanlage unter `grc_app` unmöglich

### Ursache

`organization` trug zwei Policies, beide mit demselben Ausdruck:

```
org_isolation_select  FOR SELECT  USING (id = <app.current_org_id>)
org_isolation_modify  FOR ALL     USING (id = <app.current_org_id>)   -- kein WITH CHECK
```

PostgreSQL verwendet bei `FOR ALL` den `USING`-Ausdruck **auch** als `WITH CHECK`. Eine
neue Organisation kann `id = current_org` per Definition nicht erfüllen — ihre `id`
entsteht erst beim INSERT. Jeder Anlageversuch endete mit SQLSTATE 42501. Weil S01-10
`APP_DATABASE_URL` produktiv verpflichtend macht und WP2 die Runtime-Rolle mit
`assertRuntimeRoleIsolation()` erzwingt, war die Mandantenanlage über die API in
Produktion nicht möglich.

**Zweite Hälfte derselben Ursache, beim Nachmessen gefunden:** auch nach einer
INSERT-Policy scheitert die Route weiter, weil sie
`INSERT … RETURNING` benutzt. `RETURNING` muss zusätzlich die **SELECT**-Policy für die
neue Zeile erfüllen (`id = current_org`) — dieselbe Unmöglichkeit, eine Anweisung später.
Und die beiden Folge-Inserts der Route (`user_organization_role`, `module_config`)
schreiben Zeilen der **neuen** Org, während der Org-Kontext noch auf der alten steht;
deren `…_tenant_insert`-Policies (`WITH CHECK org_id = current_org`) lehnen sie ab.
Eine Lösung, die nur die INSERT-Policy gesetzt hätte, wäre ein Placebo gewesen.

### Entscheidung: wer darf Organisationen anlegen?

Konsistent zu WP3/S02-03 (Plattform-Admin) und WP2 (Mandantentrennung):

| Prinzipal                                                                                                   | darf                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Plattform-Admin** (Tabelle `platform_admin`, Migration 0411; Prüffunktion `auth_is_platform_admin`, 0412) | jede Organisation, auch einen neuen Wurzelmandanten                                     |
| **Organisations-Admin**                                                                                     | ausschliesslich eine **Tochter der aktiven Org** (`parent_org_id = app.current_org_id`) |
| alle anderen                                                                                                | nichts (`withAuth("admin")` davor)                                                      |

Begründung der Zweiteilung:

- Ein **neuer Mandant** ist plattformweit wirksam. WP3/S02-03 hält ausdrücklich fest,
  dass `admin` eine **pro Organisation** vergebene Rolle ist und plattformweite Wirkung
  nicht trägt. Der Plattform-Admin ist über keinen API-Pfad vergebbar (kein
  INSERT/UPDATE/DELETE-Grant, keine Policy) — dieser Zweig lässt sich also nicht über
  die Anwendung erschleichen.
- Die **Konzernhierarchie** ist ein bestehendes Produktmerkmal
  (`organization.parent_org_id`, `hierarchy_level`, Elternwähler in
  `app/(dashboard)/organizations/new`, `GET /admin/org-hierarchy`,
  `app_current_org_scope()` aus WP2). Sie an den Betreiber zu binden hätte das Merkmal
  für Mandanten abgeschafft.

**Die WP2-Invariante bleibt unangetastet.** WP2 stützt die Korrektheit von
`app_current_org_scope()` darauf, dass ein Mandant „eine fremde Org nicht zur eigenen
Nachfahrin machen" kann. Die neue Policy gilt **nur** `FOR INSERT`; UPDATE und DELETE
laufen weiter allein über `org_isolation_modify` (`id = current_org`), also nur auf der
eigenen Zeile. Ein Mandant kann damit ausschliesslich **neue, leere** Zeilen unter die
**eigene** Org hängen; eine bestehende fremde Org umzuhängen bleibt unmöglich, und eine
neue Org unter eine **fremde** Org zu hängen ebenso (der Vergleich geht gegen
`app.current_org_id`, nicht gegen eine Nachfahrenmenge).

### Fix

- **`packages/db/drizzle/0438_organization_insert_policy.sql`** — Policy
  `organization_create FOR INSERT WITH CHECK (auth_is_platform_admin(<current_user>) OR
parent_org_id = <current_org>)`. Die Migration bricht ab, wenn `auth_is_platform_admin`
  fehlt (0412 nicht eingespielt), und prüft danach selbst nach, dass die Policy
  tatsächlich `FOR INSERT` ist und **keinen** `USING`-Ausdruck trägt — eine versehentlich
  als `FOR ALL` geschriebene Policy würde die Lese-Isolation aufweichen.
- **`apps/web/src/app/api/v1/organizations/route.ts`** —
  - `POST` wendet dieselbe Prüfung an (`isPlatformAdmin(ctx.userId)`, sonst
    `parentOrgId === ctx.orgId`) und antwortet sonst 403 `application/problem+json`.
    Die Datenbank bleibt die Kontrolle; die Handler-Prüfung ist die Fehlermeldung.
  - Die Zeilen-`id` wird im Handler erzeugt (`randomUUID()`), der INSERT läuft **ohne**
    `RETURNING` und **weiterhin im Kontext des Aufrufers** — genau dieser INSERT ist
    das, was die Policy autorisieren muss.
  - Erst danach wird der Org-Kontext transaktionslokal auf die neue Org umgestellt
    (`set_config('app.current_org_id', …, true)`); die Folgezeilen
    (`user_organization_role`, `module_config`) gehören der neuen Org, und ihre
    `…_tenant_insert`-Policies sind es, die sie legalisieren.
  - `POST` ist jetzt in `withErrorHandler` gewickelt (RFC-7807 statt leerer 500).

### Nachweis

`apps/web/src/__tests__/rls-route-chain/organizations-create-rls.test.ts` — echte
Routenkette (`withErrorHandler → withAuth → establishRequestScopedContext → db`) unter
`APP_DATABASE_URL` (`grc_app`, RLS aktiv), 5 Tests:

| Fall                                             | Erwartung                                            | Ergebnis |
| ------------------------------------------------ | ---------------------------------------------------- | -------- |
| Org-Admin legt Tochter der aktiven Org an        | 201, Zeile + Admin-Grant + `module_config` in der DB | grün     |
| Org-Admin legt Wurzelmandanten an                | 403, keine Zeile                                     | grün     |
| Org-Admin hängt neue Org unter **fremde** Org    | 403, keine Zeile                                     | grün     |
| Plattform-Admin legt Wurzelmandanten an          | 201, `parent_org_id` NULL                            | grün     |
| direkter INSERT als `grc_app` (Wurzel / Tochter) | 42501 / erlaubt                                      | grün     |

Rot-Probe: mit `DROP POLICY organization_create ON organization` fallen 3 der 5 Tests aus
(`new row violates row-level security policy for table "organization"`); mit der Policy
5/5 grün.

### Gegenprobe auf dasselbe Muster bei anderen Wurzel-Tabellen

```sql
select c.relname, p.polname, pg_get_expr(p.polqual,p.polrelid)
  from pg_policy p join pg_class c on c.oid=p.polrelid
 where p.polcmd='*' and p.polwithcheck is null
   and pg_get_expr(p.polqual,p.polrelid) !~ 'org_id';
```

Einziger weiterer Treffer: `notification_preference` (`user_id = <current_user>`). Das ist
**kein** Fall desselben Defekts — eine neue Zeile mit dem eigenen `user_id` erfüllt den
Ausdruck. Alle übrigen FOR-ALL-Policies vergleichen `org_id`, was eine neue Zeile
erfüllen kann.

Zweite Gegenprobe (Tabellen mit RLS, aber ohne INSERT-fähige Policy):
`account`, `session`, `verification_token`, `platform_admin`. `platform_admin` ist so
gewollt (WP3/S02-03). Die drei Auth.js-Tabellen sind seit 0392 bewusst deny-all und
werden von der Anwendung nicht beschrieben (JWT-Strategie, kein Datenbank-Adapter) —
kein Defekt, aber als Beobachtung notiert.
Onboarding (`/api/v1/onboarding`) und Einladungen (`/api/v1/invitations/[token]/accept`)
schreiben in `org_id`-Tabellen und sind nicht betroffen. Einen Self-Service-Signup gibt
es im Repository nicht.

---

## Defekt 2 (hoch) — O-3 und O-4: zwei Routen mit 500

### O-3 · `GET /api/v1/isms/threats/heatmap`

**Ursache — drei Fehler in einer Anweisung** (`packages/reporting/src/threat-dashboard.ts`,
`getThreatHeatmap`):

1. `LEFT JOIN asset a ON v.asset_id = a.id` — `vulnerability` hat **nie** ein `asset_id`
   getragen. Die Spalte heisst `affected_asset_id` (FK
   `vulnerability_affected_asset_id_asset_id_fk`, Index `vuln_asset_idx`). 42703.
   Die Abfrage konnte auf keiner Datenbank und mit keinen Daten je laufen.
2. Dahinter verborgen: `GROUP BY t.threat_category, asset_tier`. `asset` **hat** eine
   echte Spalte `asset_tier`, und PostgreSQL löst einen blossen Bezeichner in `GROUP BY`
   zuerst gegen eine **Eingabespalte** auf, erst danach gegen einen Ausgabe-Alias. Die
   Gruppierung band an `a.asset_tier`; sobald Fehler 1 behoben war, schlug die Anweisung
   mit 42803 fehl (`ac.overall_protection must appear in the GROUP BY clause`).
3. Der Weg zum Asset lief ausschliesslich über die Verwundbarkeit, obwohl
   `risk_scenario.asset_id` existiert und indiziert ist. Nur den Spaltennamen zu
   korrigieren hätte jedes direkt zugeordnete Szenario in den Eimer `normal` gekippt.

**Fix.** Join auf `a.id = COALESCE(rs.asset_id, v.affected_asset_id)`; Gruppierung
ausgeschrieben (`GROUP BY t.threat_category, COALESCE(ac.overall_protection,'normal')`).

**Zweite Fundstelle, gleiche Wurzel.** `getTopThreats` (`GET /api/v1/isms/threats/top`)
trug dasselbe `v.asset_id` **und** zusätzlich
`sum(COALESCE(t.likelihood_rating,1) * count(DISTINCT rs.id))` — ein geschachtelter
Aggregat, den PostgreSQL rundheraus ablehnt („aggregate function calls cannot be
nested"). Auch diese Route antwortete 500. Da `t.id` in der Gruppierung steht, ist
`t.likelihood_rating` funktional abhängig; die äussere Aggregation ist ersatzlos
entfallen: `(COALESCE(t.likelihood_rating,1) * count(DISTINCT rs.id))::int`.
Nur die im Befund genannte Route zu reparieren hätte die zweite auf denselben zwei
Zeilen weiter 500-en lassen.

`getControlCoverage` ist von keiner Route erreichbar und wurde nicht angefasst.

### O-4 · `POST /api/v1/findings`

**Ursache.** Kein Fehler im Handler, sondern eine Lücke in den **Katalogdaten**. Die
Route schreibt ein `work_item` mit `type_key = 'finding'`; dasselbe tut der
BEFORE-INSERT-Trigger `finding_auto_create_work_item()` für jeden Pfad, der `finding`
direkt schreibt. `work_item.type_key` hat einen Fremdschlüssel auf
`work_item_type.type_key`, und `'finding'` war dort nie registriert →
`work_item_type_key_work_item_type_type_key_fk` verletzt, Transaktion zurückgerollt, 500.
`packages/db/sql/seed_platform_baseline.sql` führt `finding` zwar auf, läuft aber nur bei
`db:seed`, nicht bei `db:migrate-all`. Identische Teilursache und identische Lösung wie
0301 (`risk_treatment`) und 0310 (`audit`) — dies ist der dritte Fall.

**Vollständigkeit statt Einzelfall.** Eine Gegenprobe aller `typeKey`-Literale im
Anwendungscode gegen `work_item_type` fand nicht einen, sondern **fünf** nicht
registrierte Schlüssel, alle auf produktiven POST-Pfaden, alle mit demselben 500:

| `type_key`    | Routen                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `finding`     | `/findings`, `/findings/bulk`, `/audit-mgmt/…/create-finding`, `/audit-mgmt/…/bulk-create-findings` (+ Trigger) |
| `data_breach` | `/dpms/breaches`                                                                                                |
| `dsr`         | `/dpms/dsr`                                                                                                     |
| `ropa_entry`  | `/dpms/ropa`                                                                                                    |
| `tia`         | `/dpms/tia`                                                                                                     |

**Fix.** `packages/db/drizzle/0439_work_item_type_catalog_gaps.sql` registriert alle fünf
(idempotent, `ON CONFLICT (type_key) DO NOTHING`, mit `element_id_prefix`, damit der
Generator-Trigger `element_id` vergibt statt NULL zu lassen). Die Migration prüft am Ende
selbst nach, dass alle fünf vorhanden sind. Der Wert gehört in die Katalogdaten, nicht in
ein Test-Fixture.

### Nachweis

`apps/web/src/__tests__/rls-route-chain/isms-findings-routes.test.ts` — echte Routen unter
`grc_app`, 4 Tests:

| Test                                                                                                      | Ergebnis |
| --------------------------------------------------------------------------------------------------------- | -------- |
| `GET /isms/threats/heatmap` → 200, Zelle `cyber` mit `count ≥ 1` (nicht nur „wirft nicht mehr")           | grün     |
| `GET /isms/threats/top` → 200, `riskScenarioCount = 1`, `impactScore = 3` (= `likelihood_rating 3 × 1`)   | grün     |
| `POST /findings` → 201, verknüpftes `work_item` mit `type_key = 'finding'` und `element_id ~ ^FND-\d{3}$` | grün     |
| Registry-Gegenprobe: jeder vom Code geschriebene `type_key` existiert im Katalog                          | grün     |

Rot-Proben:

- O-3: `ERROR: column "v.asset_id" does not exist` bzw.
  `ERROR: column "ac.overall_protection" must appear in the GROUP BY clause` bzw.
  `ERROR: aggregate function calls cannot be nested` — alle drei am psql-Prompt gegen die
  frisch migrierte Datenbank reproduziert.
- O-4: nach `DELETE FROM work_item_type WHERE type_key='finding'` fallen die beiden
  O-4-Tests aus, die beiden O-3-Tests bleiben grün.

**Zusätzlich beseitigt: der eine begründete Skip.**
`packages/db/tests/integration/schema-drift-finding-fk.test.ts` verschluckte den
Rundlauf-Test mit `catch { console.warn(...) }` und der Begründung, `work_item_type_key
'finding'` sei „auf dieser DB noch nicht geseedet" — der verschluckte Fehler **war** O-4.
Der `catch` ist entfernt, der Test legt seine eigene Organisation an (statt auf eine
vorhandene zu hoffen) und behauptet zusätzlich, dass das vom Trigger erzeugte `work_item`
den Typ `finding` trägt.

---

## Defekt 3 (mittel) — O-6: Drift-Check war einäugig

### Ursache

`ColumnDrift.kind` in `packages/db/tests/schema-drift.ts` kannte `missing-in-db`,
`type-mismatch` und `nullability-mismatch` — aber keine Spalten, die **nur in der
Datenbank** stehen. Der Check fragte also ausschliesslich „hat die Datenbank alles, was
der Code deklariert?", nie „kennt der Code alles, was die Datenbank hat?". Deshalb blieb
`control.source_library_ref` unsichtbar, obwohl die Route
`ics/control-library/adopt` es schreibt. „Drift leer" war die halbe Wahrheit; der Check
ist die tragende Kontrolle S09-09.

Eine undeklarierte Spalte ist nicht kosmetisch: `db.select()` lässt sie stillschweigend
weg, `$inferSelect` bestreitet ihre Existenz, und jeder Zugriff darauf muss die ORM
verlassen.

### Fix — die Richtung

`compareSchema()` meldet jetzt zusätzlich `kind: "extra-in-db"` für jede DB-Spalte auf
einer Tabelle, **die der Code beansprucht** und die er nicht deklariert; sie geht in
`healthy` ein und failt `--fail-on-drift`. Tabellen, die der Schema-Code gar nicht kennt,
bleiben wie bisher als `extraInDb` rein informativ (mehrere Tabellen sind älter als das
TypeScript-Schema und werden per SQL verwaltet) — sonst hätte die neue Richtung 14
Alttabellen als Spaltenflut gemeldet. Der CLI-Zähler ist entsprechend beschriftet
(`missing tables` / `extra tables` / `column drift (thereof N only-in-DB columns)`).

**Es gibt bewusst keine Ausnahmeliste für die neue Richtung.** Der einzige Fall, der eine
gebraucht hätte — fünf `GENERATED ALWAYS`-Spalten, die die ORM niemals schreiben darf —
ist stattdessen im Schema ausgedrückt: `.generatedAlwaysAs(sql\`…\`)` hält sie aus den
Insert-/Update-Typen heraus. Damit steht „die ORM darf das nicht schreiben" im Schema
statt in einem Freibrief.

### Fix — die Bereinigung

Der Check meldete daraufhin **204** Spalten in 30 Schema-Dateien (die von A.5 bereits
nachdeklarierte `control.source_library_ref` war nicht mehr darunter). Alle 204 sind
**echte, benutzte Spalten**, die per SQL-Migration entstanden und im Drizzle-Schema
fehlten — `tags`-Arrays, `custom_fields`, die ERM-Sync-Spalten, die AI-Souveränitäts-
Spalten (`prompt_sha256`, `ai_provider`, `egress_log_id`), die Bewertungssteuerung auf
`risk` und andere. Keine einzige war ein Überbleibsel, das per Migration hätte entfernt
werden dürfen; die fachlich richtige Richtung war durchgängig „ins Schema aufnehmen".

Umgesetzt:

- 204 Spaltendeklarationen ergänzt, aus `information_schema` abgeleitet (Typ, Länge/
  Präzision, `NOT NULL`, Default als `sql\`…\``). **Keine** der 204 ist NOT NULL ohne
  Default, es wird also kein Feld beim Insert zur Pflicht — nachgemessen, nicht vermutet.
- Fünf `GENERATED ALWAYS`-Spalten (`document.search_vector`, `search_index.tsv`,
  `dpia_risk.risk_score`, `risk_scenario.risk_score`, `risk_scenario.residual_score`)
  mit `.generatedAlwaysAs(...)` und der echten Erzeugungsformel.
- Neu `packages/db/src/schema/custom-types.ts`: `tsvector`-`customType`, weil drizzle
  keinen Builder dafür hat.
- Neu `packages/db/src/schema/risk-evaluation-enums.ts`: die vier Enums
  (`risk_object_type`, `evaluation_phase`, `evaluation_cycle`, `evaluation_type`) lagen in
  `risk-evaluation.ts`, wurden dort aber nie benutzt — sie beschreiben Spalten von `risk`.
  Sie in `risk.ts` zu deklarieren hätte einen Importzyklus erzeugt
  (`risk-evaluation.ts` importiert `risk`), und ein Zyklus zwischen zwei Modulen, die
  beide `pgEnum(...)` auf Modulebene auswerten, löst sich je nach Ladereihenfolge
  unterschiedlich auf. Das blattseitige Modul löst das; `risk-evaluation.ts` re-exportiert
  alle vier, die öffentliche Oberfläche von `@grc/db` ist unverändert.

### Nachweis

- `packages/db/tests/unit/schema-drift.test.ts`: zwei neue Tests — eine nur in der DB
  vorhandene Spalte wird als `extra-in-db` gemeldet **und** macht den Report `unhealthy`;
  Spalten auf Tabellen, die das Schema nicht beansprucht, fluten den Spaltenreport nicht.
- Messung gegen die frisch migrierte Datenbank:

```
$ npx tsx tests/schema-drift-report.ts --fail-on-drift
Drizzle tables: 581   DB tables: 595
missing tables: 0
extra tables  : 14 (informational)
column drift  : 0 (thereof 0 only-in-DB columns)
RLS drift     : 0
duplicate defs: 0
EXIT=0
```

---

## Abnahme — gemessen, nicht angenommen

Reproduktion: frische Datenbank `fix3_*`, `migrate-all.ts` von Null,
`deploy/provision-grc-app.sh`, dann die Messungen.

| Kriterium                               | Ergebnis                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrationen von Null                    | **Exit 0**, `404/404 migrations applied`, **603 Tabellen erzeugt** (595 Basistabellen in `information_schema`, Rest Timescale-/Journal-Objekte) |
| Schema-Drift, **beide Richtungen**      | **leer**: `missing tables 0`, `column drift 0 (thereof 0 only-in-DB)`, `RLS drift 0`, `duplicate defs 0`, Exit 0                                |
| `npx tsc --noEmit` `apps/web`           | **0 Fehler**                                                                                                                                    |
| `npx tsc --noEmit` `apps/worker`        | **0 Fehler**                                                                                                                                    |
| `npx tsc --noEmit` alle 10 `packages/*` | **0 Fehler** (unverändert mit den abgeschwächten Optionen aus O-8)                                                                              |
| `npm test`                              | **Exit 0**, 12/12 Tasks, **5781 Tests grün + 1 erwarteter Fehlschlag**, **0 Skips**                                                             |
| `node scripts/audit-gate.mjs`           | **Exit 0**                                                                                                                                      |
| `npx eslint .` in `apps/web`            | **Exit 0**                                                                                                                                      |
| `node scripts/lint-ratchet.mjs`         | **Exit 0**; `no-unused-vars` von 251 auf **249** gesunken, Baseline nachgezogen (406 → 404)                                                     |

Neue Tests in dieser Sitzung: 5 (O-2) + 4 (O-3/O-4) + 2 (O-6) = **11**, plus ein
entschärfter Schluck-`catch` und ein zusätzlicher E2E-Fall.

Aufgeräumt: `dropdb fix_*`, `fix2_*`, `fix3_*`.

---

## Weiterhin offen

Unverändert und in dieser Sitzung bewusst nicht angefasst:

| Punkt    | Stand                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O-1**  | 406 → **404** eingefrorene Lint-Altbefunde (zwei durch diese Arbeit weggefallen, Baseline nachgezogen). Das Plankriterium „0 Fehler in allen Workspaces" bleibt unerfüllt.                                                                                              |
| **O-5**  | E2E-Restfehler. `f-02-org-create` ist an die neue Berechtigungsregel angepasst (Tochteranlage statt Wurzelmandant) und um einen Verweigerungsfall ergänzt — **nicht ausgeführt**, weil dafür eine laufende Anwendung nötig ist. Die übrigen neun Fehler sind unberührt. |
| **O-7**  | Produktionsbuild nicht herstellbar (> 7 GB RAM).                                                                                                                                                                                                                        |
| **O-8**  | `packages/db` / `packages/shared` / `packages/auth` typechecken weiter mit abgeschaltetem `noUncheckedIndexedAccess` / `noUnusedLocals`.                                                                                                                                |
| **O-9**  | `0394` bleibt ein Einmal-Scan.                                                                                                                                                                                                                                          |
| **O-10** | `grc_platform` im Container ist weiterhin nicht auf Branch-Stand. Es wurde nicht dagegen gemessen und nichts daran verändert.                                                                                                                                           |

Neu beobachtet, nicht behoben:

- **Prettier-Tor rot im Arbeitsbaum.** `npx prettier --check "**/*.{ts,tsx,js,json,md}"
--ignore-path .gitignore` meldet 159 Dateien — überwiegend eingecheckte
  `coverage/`-Artefakte (die `.gitignore` nicht ausnimmt) plus rund zehn Quelldateien aus
  WP2–WP12. Bestand vor dieser Sitzung; alle in dieser Sitzung geänderten Dateien sind
  formatiert. Nicht angefasst, weil eine Formatierung von 159 Dateien den Prüfdiff
  unlesbar machen würde.
- **`account`, `session`, `verification_token`** tragen RLS ohne jede Policy (deny-all
  seit 0392) und werden von der Anwendung nicht benutzt (JWT-Strategie, kein
  Datenbank-Adapter). Kein Defekt, aber ein Rest, den ein späterer Aufräumschritt
  entweder entfernen oder als bewusst tot dokumentieren sollte.
- **`getControlCoverage`** (`packages/reporting`) enthält einen sinnlosen
  `LEFT JOIN process_control pc ON pc.process_id IS NOT NULL` (Kreuzprodukt). Von keiner
  Route erreichbar, deshalb kein Funktionsdefekt und nicht angefasst.
