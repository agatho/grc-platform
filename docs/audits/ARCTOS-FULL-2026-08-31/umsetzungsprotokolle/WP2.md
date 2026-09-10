# WP2 — Mandantentrennung und Row Level Security

**Audit:** `ARCTOS-FULL-2026-08-31` · **Branch:** `audit/full-2026-08-31`
**Umfang:** `S01-01` … `S01-26` (26 Findings: 1 Critical, 7 High, 10 Medium, 7 Low, 1 Info)
**Welle:** 2, parallel zu WP3/WP4/WP5 · **Abgeschlossen:** 2026-09-01

---

## 1. Neumessung des Ist-Zustands (Pflicht vor jeder Änderung)

Der Auditbericht S01 hat gegen ein Schema gemessen, in dem
`0315_rls_gap_closure_v4.sql` auf der ersten von 142 Tabellen abbrach. WP1 hat
das repariert. **Alle Zahlen unten sind neu gemessen**, gegen eine von Null
migrationsgebaute Datenbank auf dem aktuellen Branch-Stand; weder der
S01-Bericht noch `docs/security/rls-coverage-report.md` waren Grundlage.

```bash
export PGPASSWORD=grc_dev_password
dropdb -h localhost -U grc --if-exists wp2_verify && createdb -h localhost -U grc wp2_verify
psql -q -h localhost -U grc -d wp2_verify -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS timescaledb;'
cd packages/db && DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/wp2_verify \
  npx tsx src/migrate-all.ts
DIRECT_PSQL=1 GRC_APP_PASSWORD=grc_app_dev_password PGUSER=grc \
  bash deploy/provision-grc-app.sh wp2_verify
```

Die Vergleichsdatenbank `wp2_before` entsteht aus **demselben Baum ohne die
zehn WP2-Migrationen** (`0390`–`0399`) plus den historischen Grants
(`GRANT … ON ALL TABLES/FUNCTIONS`), damit der Vergleich nicht an fehlenden
Rechten scheitert, sondern die RLS-Lage misst.

| Messung (`public`)                                                 | vorher (`wp2_before`) | nachher (`wp2_verify`) |
| ------------------------------------------------------------------ | --------------------- | ---------------------- |
| Tabellen                                                           | 583                   | 583                    |
| Policies                                                           | 2.555                 | **2.593**              |
| Tabellen mit RLS                                                   | 511                   | **537**                |
| Tabellen mit `FORCE`                                               | 496                   | **537**                |
| RLS ohne `FORCE`                                                   | 15                    | **0**                  |
| Policies mit `app.bypass_rls`                                      | 55                    | **0**                  |
| Policies mit `::uuid`-Cast ohne `NULLIF`                           | 589                   | **0**                  |
| Policies mit `(org_id)::text`-Vergleich                            | 52                    | **0**                  |
| Tabellen mit `org_id` ohne RLS                                     | 4                     | **0**                  |
| Views ohne `security_invoker`                                      | 7                     | **0**                  |
| `SECURITY DEFINER` ohne `search_path` oder mit `EXECUTE` an PUBLIC | 13                    | **0**                  |
| Objekte gesamt / RLS-Lücken (`audit-rls-coverage.mjs`)             | 592 / **530**         | 592 / **0**            |

Migrationen laufen weiterhin vollständig durch (`381/381`, Exit 0, 590
Tabellen inkl. der Objekte der parallel laufenden Pakete).

**Präzisierungen gegenüber dem S01-Bericht** (kein Finding verworfen, aber die
Zahlen des Berichts sind teils überholt):

- Der Bericht nennt für `whistleblowing_audit_log` eine `org_id`-Spalte. Nach
  WP1 hat die Tabelle **keine** `org_id`; die Mandantenbindung läuft über
  `case_id` → `wb_case.org_id`. Das Prädikat ist entsprechend als `EXISTS` auf
  `wb_case` formuliert (S01-17).
- Der Bericht nennt 10 Tabellen mit RLS ohne `FORCE`; gemessen waren es 15,
  und 4 statt 3 Tabellen mit `org_id` ohne RLS (`audit_chain_verification` aus
  WP4 kam während der Umsetzung dazu). Die zusätzlichen existierten vor WP1
  nicht, weil ihre Migrationen scheiterten.
- Der Bericht nennt 18 Kindtabellen ohne `org_id`. Vier davon
  (`approval_decision`, `attestation_response`, `connector_field_mapping`,
  `review_decision`) hatten nach dem WP1-Fix von `0315` bereits eine
  EXISTS-Policy — allerdings ohne `FORCE` und ohne `NULLIF`-Guard.

---

## 2. Der Abnahmetest

`packages/db/tests/rls/tenant-isolation-systemtest.test.ts` (22 Tests), mit
`tenant-isolation-seed.sql` und `tenant-isolation-cleanup.sql`.

Der Seed legt **je eine Zeile pro Mandant in jedem Objekt mit Mandantenbezug**
an — 534 Objekte, darunter alle Kindtabellen ohne `org_id`, die
Auth-Kerntabellen und die drei Log-Tabellen — und merkt sich die
Primärschlüssel. Der Probe-Teil fragt danach als Rolle `grc_app`
(`rolsuper=f`, `rolbypassrls=f`) im Kontext von Org A **per ID** nach den
Zeilen von Org B. ID-basiert und nicht `WHERE org_id = B`, weil die Lecks
gerade in den Objekten OHNE `org_id` lagen — ein org_id-basierter Test kann
sie konstruktionsbedingt nicht sehen. Für jedes Objekt wird geprüft:

- die **eigene** Zeile ist sichtbar (sonst wäre „0 fremde Zeilen" nur ein
  Artefakt einer deny-all-Policy und bewiese nichts),
- die **fremde** Zeile ist nicht sichtbar,
- `UPDATE` auf die fremde Zeile trifft 0 Zeilen,
- `DELETE` auf die fremde Zeile trifft 0 Zeilen.

Dazu die gezielten Negativtests je Befundklasse (bypass_rls wirkungslos,
`org_id = NULL` nicht schreibbar, Views/Matviews, Auth-Tabellen,
`tombstone_audit_entry` cross-tenant, Fail-Modus des leeren GUC,
`SECURITY DEFINER`-Härtung, `runRlsAudit()` ohne Lücke).

```
$ cd packages/db && DATABASE_URL=…/wp2_verify APP_DATABASE_URL=postgresql://grc_app:…@localhost:5432/wp2_verify \
    npx vitest run --config vitest.rls.config.ts
 Test Files  10 passed (10)
      Tests  79 passed (79)

$ npx vitest run                       # packages/db Default-Suite
 Test Files  8 passed (8)
      Tests  433 passed (433)
```

**Gegen den Vorher-Stand schlägt er fehl** — 17 der 22 Tests:

```
$ … DATABASE_URL=…/wp2_before … npx vitest run --config vitest.rls.config.ts \
      tests/rls/tenant-isolation-systemtest.test.ts
 × denies cross-tenant SELECT on every seeded object
     access_log, api_key_scope, architecture_change_vote, audit_anchor,
     audit_chain_verification, audit_log, bc_exercise_inject_log, bowtie_path,
     crisis_contact_node, custom_dashboard_widget, dd_evidence, dd_response,
     esg_materiality_topic, esg_materiality_vote, onboarding_step,
     playbook_phase, playbook_task_template, questionnaire_question,
     questionnaire_section, recovery_procedure_step, role_permission, user,
     wb_anonymous_mailbox        (23 Objekte, foreign row visible)
 × denies cross-tenant UPDATE and DELETE on every seeded object
 × denies cross-tenant reads through views
 × every view is security_invoker
 × materialized views are not readable by the runtime role
 × SET app.bypass_rls has no effect any more
 × no policy in the schema references app.bypass_rls
 × rows with org_id = NULL cannot be written by a tenant
 × session, account and verification_token are unreachable
 × user rows of another tenant are invisible from a tenant context
 × the log tables carry RLS + FORCE and no exception list remains
 × app_current_org_scope() returns exactly the own org for an unrelated tenant
 × tombstone_audit_entry refuses a foreign tenant's audit entry
 × every SECURITY DEFINER function has a fixed search_path and no PUBLIC EXECUTE
 × an empty org GUC yields zero rows instead of an error
 × no policy casts app.current_org_id without a NULLIF guard
 × runRlsAudit reports zero gaps
      Tests  17 failed | 5 passed (22)
```

**Grenze des Tests, ausdrücklich benannt:** fünf Tabellen liessen sich nicht
generisch mit zwei Mandantenzeilen befüllen (`asset_classification_override`,
`control_embedding` (pgvector `NOT NULL`), `framework_mapping`,
`notification_preference`, `programme_template` — CHECK-Constraints bzw.
UNIQUE-Indizes, die der typgetriebene Generator nicht erfüllt). Sie werden
vom Test **namentlich als „nicht geprüft" ausgegeben** statt stillschweigend
übersprungen; ihre Policy-Form deckt das statische Gate ab. Der Test bricht
ab, wenn diese Zahl über 20 steigt.

---

## 3. Die Entscheidung zu S01-06 (Log-Tabellen)

**Entschieden: RLS aktivieren, Descendant-Logik anders lösen.** Die Ausnahme
aus `0379_logtables_rls_exception.sql` ist aufgehoben, die Ausnahmeliste
`TENANT_TABLE_RLS_EXCEPTIONS` ist leer und ein Test hält sie leer.

Die Ausnahme ruhte auf zwei Begründungen:

1. **Org-loses INSERT beim Login** — trägt. `access_log` wird beim
   Anmeldeversuch geschrieben, bevor eine Org feststeht, und der
   Brute-Force-Check liest diese Zeilen kontextlos zurück. Das rechtfertigt
   aber nur eine permissive **INSERT**-Policy, nicht das Abschalten der
   Lese-Isolation — `0381` führt für `notification`/`data_export_log` genau
   diese getrennte Form bereits vor. `0396` übernimmt sie.
2. **Lesen über die Org-Hierarchie** (`includeDescendants`, ADR-011 rev.2) —
   **trägt nicht**. S01-26 weist nach, dass die rekursive CTE auf
   `organization` unter `grc_app` nur die eigene Org sieht; `orgIdScope`
   enthält immer genau eine ID. Die Ausnahme schützte eine Funktion, die im
   abgesicherten Betrieb gar nicht existierte.

Die Alternative — Ausnahme behalten und kompensieren — ist **verworfen**: die
Kompensation bestünde aus neun handgeschriebenen `WHERE org_id = …`-Klauseln
in neun Routen, von denen eine zu vergessen die Offenlegung des Audit-Trails
aller Kunden bedeutet. Für die zentrale Compliance-Zusage des Produkts ist
eine erzwungene DB-Kontrolle die richtige Ebene. Die handgeschriebenen Filter
bleiben zusätzlich bestehen (Defense in Depth).

Die Descendant-Sicht ist durch `app_current_org_scope()` gelöst: eine
`SECURITY DEFINER`-Funktion mit fixiertem `search_path`, ohne PUBLIC-EXECUTE,
die die eigene Org plus ihre Nachfahren aus `organization.parent_org_id`
liefert (Tiefe ≤ 32). Sie umgeht die `organization`-RLS bewusst — sonst käme
sie nie über die eigene Zeile hinaus — kann aber nicht missbraucht werden:
eine fremde Org zur eigenen Nachfahrin zu machen hiesse,
`organization.parent_org_id` der **fremden** Zeile zu setzen, und das
verbietet `org_isolation_modify`. Der Systemtest prüft beides.

---

## 4. Umsetzung je Finding

### S01-01 — Critical — Cross-Tenant-IDOR `bowtie_path` · **behoben**

**Geändert:** `packages/db/drizzle/0391_rls_child_tables.sql`,
`apps/web/src/app/api/v1/erm/bowtie/[riskId]/route.ts`.

Bewusst beide Hälften:

- **DB:** `bowtie_path` bekommt RLS + `FORCE` und eine Policy
  `FOR ALL USING (EXISTS (SELECT 1 FROM risk p WHERE p.id = bowtie_path.risk_id
AND p.org_id = <org-GUC>))`. Bei `FOR ALL` gilt `USING` auch als
  `WITH CHECK` — ein Pfad kann also weder gelesen noch unter ein fremdes
  Risiko gehängt werden.
- **Route:** `assertRiskInOrg()` prüft vor GET und PUT, dass das Risiko der
  eigenen Org gehört, und antwortet sonst 404. Ohne diese Hälfte lieferte ein
  Zugriff auf ein fremdes Risiko still `paths: []` und ein PUT liefe
  wirkungslos, aber ohne Rückmeldung ins Leere.

**Nachweis:** im Systemtest `bowtie_path` unter den 534 geprüften Objekten;
im Vorher-Lauf als `foreign row visible` gemeldet, im Nachher-Lauf nicht.

---

### S01-02 — High — Escape-Hatch `app.bypass_rls` · **behoben**

**Geändert:** `packages/db/drizzle/0390_rls_remove_bypass_hatch.sql`,
`packages/db/src/seed-control.ts`.

Der Hatch ist **ersatzlos entfernt**, nicht an eine Rolle gebunden: der einzige
dokumentierte Zweck („group admin aggregation") hat im Produktivcode keine
Fundstelle, und eine zweite privilegierte Rolle wäre Angriffsfläche ohne
Nutzen. Die Migration arbeitet katalog-getrieben über `pg_policies`, schneidet
die Bypass-Disjunktion aus 33 `org_isolation`-Policies heraus (das
org-Prädikat bleibt unverändert) und löscht die 22 `reporting_bypass`-Policies,
deren Ausdruck **ausschliesslich** aus der Bypass-Prüfung besteht. Sie bricht
ab, wenn danach auch nur eine Policy den GUC noch nennt.

**Nachweis:**

```
NOTICE:  S01-02: 33 Policies bereinigt, 22 Bypass-Policies gelöscht
select count(*) from pg_policies where schemaname='public'
  and (qual like '%bypass_rls%' or with_check like '%bypass_rls%');   -->  0   (vorher 55)
```

Systemtest: `SET app.bypass_rls='true'` ändert an `risk`, `document`,
`evidence`, `organization` nichts, und `DELETE FROM risk WHERE org_id=<B>`
trifft 0 Zeilen.

---

### S01-03 — High — 18 Kindtabellen ohne `org_id` und ohne RLS · **behoben**

**Geändert:** `packages/db/drizzle/0391_rls_child_tables.sql`.

15 direkte Kindtabellen bekommen eine `EXISTS`-Policy auf die org-skalierte
Elterntabelle, drei Enkeltabellen (`esg_materiality_vote`,
`playbook_task_template`, `questionnaire_question`) den zweistufigen `EXISTS`
ausgeschrieben — redundant zur RLS der Zwischentabelle, aber unabhängig von
der Auswertungsreihenfolge verschachtelter Policies lesbar und prüfbar. Alle
18 FK-Spalten sind `NOT NULL` (gegen `information_schema` geprüft), es
verschwinden also keine elternlosen Zeilen. Die vier bereits von `0315`
versorgten Kindtabellen bekommen `FORCE`.

**Nachweis:** `NOTICE: S01-03: RLS auf 18 Kindtabellen ohne org_id gesetzt`;
im Vorher-Lauf des Systemtests melden alle 18 `foreign row visible`, im
Nachher-Lauf keine.

---

### S01-04 — High — Auth-Kerntabellen ohne RLS · **teilweise**

**Geändert:** `packages/db/drizzle/0392_rls_auth_core_tables.sql`,
`deploy/provision-grc-app.sh`, `packages/db/drizzle/0399_grc_app_grants.sql`.

- `session`, `account`, `verification_token`: **deny-all** — RLS + `FORCE`
  ohne jede Policy, zusätzlich `REVOKE ALL … FROM grc_app`. Begründung: das
  Projekt fährt die JWT-Strategie ohne DrizzleAdapter; die Volltextsuche über
  `apps/**` und `packages/**` findet keinen Import und keine SQL-Referenz auf
  diese drei Tabellen ausserhalb der Schema-Definition. Sie sind unbenutzt und
  tragen die sensibelsten Spalten (`session_token`, `refresh_token`,
  `access_token`, `id_token`). Wird Auth.js je auf den DB-Adapter umgestellt,
  schlägt das sofort und laut fehl statt still.
- `user`: Policy `id = <user-GUC>` **oder** Mitgliedschaft über
  `user_organization_role` in der aktuellen Org **oder** kontextlose
  Verbindung. `DELETE` bekommt die kontextlose Disjunktion bewusst **nicht**.

**Warum „teilweise" und nicht „behoben":** die kontextlose Disjunktion auf
`user` ist eine echte, benannte Lücke. Der Anmeldepfad muss `user` per E-Mail
lesen, bevor eine Identität feststeht
(`packages/auth/src/providers.ts:197`, `:341`), und PostgreSQL bietet für
benutzerdefinierte GUCs keinen Rechteschutz — ein „nur der Login darf
das"-Marker wäre exakt der Escape-Hatch, den `0390` gerade entfernt hat. Der
saubere Weg (Anmeldeabfrage über eine `SECURITY DEFINER`-Funktion) verlangt
eine Änderung an `packages/auth/**`, das WP3 gehört. **Übergabe an WP3
(S02-05).**

Was der Fix leistet: jede Abfrage aus einem etablierten Request-Kontext — also
der gesamte authentifizierte HTTP-Verkehr über `withAuth` — sieht nur eigene
Org-Mitglieder und sich selbst. Was er nicht leistet: kontextlose Codepfade
(Login, SSO-Provisionierung, Worker) und die 115 nicht in `withErrorHandler`
eingepackten Routen (S01-21) bleiben ungefiltert.

**Nachweis:** Systemtest — `session`/`account`/`verification_token` werfen
`permission denied`; `user`-Zeile von Org B im Org-A-Kontext unsichtbar, eigene
Zeile sichtbar.

---

### S01-05 — High — `GET /api/v1/users/:id` ohne Mitgliedschaftsprüfung · **behoben**

**Geändert:** `apps/web/src/app/api/v1/users/[id]/route.ts`.

Vor dem Lesen des Nutzerdatensatzes wird — sofern nicht die eigene Zeile
angefragt ist — die Mitgliedschaft in der aktuellen Org über
`user_organization_role` geprüft; sonst 404. Der explizite Join bleibt
zusätzlich zur neuen `user`-Policy aus `0392` bestehen: er macht die Regel im
Code sichtbar und trägt auch dann, wenn die Route ausserhalb eines
Request-Kontexts liefe.

---

### S01-06 — High — Log-Tabellen ohne RLS · **behoben**

**Geändert:** `packages/db/drizzle/0396_rls_log_tables.sql`,
`packages/db/src/rls-audit.ts`, `packages/db/tests/rls/logtable-rls-exception.test.ts`.
Begründung der Entscheidung siehe Abschnitt 3.

Policies je Tabelle nach dem `0381`-Muster: permissives `INSERT`
(`WITH CHECK true` — die org-losen Login- und Trigger-Schreibvorgänge müssen
durchgehen), `SELECT` über `app_current_org_scope()`, `UPDATE`/`DELETE` strikt
auf die eigene Org. Bei `access_log` zusätzlich: org-lose Zeilen sind sichtbar,
**wenn die Verbindung keinen Org-Kontext trägt** — genau der kontextlose
Brute-Force-Check, und kein Mandantendatum. Eine Mandanten-Session sieht sie
nicht. Dazu `FORCE` auf allen dreien.

`TENANT_TABLE_RLS_EXCEPTIONS` ist jetzt leer;
`tests/rls/logtable-rls-exception.test.ts` hat sich umgedreht und prüft das
Gegenteil dessen, was es vorher zementierte.

**Nachweis:**

```
NOTICE: S01-06: RLS auf audit_log/access_log/audit_anchor aktiviert (0379-Ausnahme aufgehoben)
```

Systemtest: alle drei mit RLS + FORCE + Policies; org-loses `INSERT` in
`access_log` liefert weiterhin `count = 1`; Cross-Tenant-Lesen und -Schreiben
für alle drei verboten (im Vorher-Lauf `access_log`/`audit_log`/`audit_anchor`
als Leck gemeldet).

---

### S01-07 — High — `org_id IS NULL`-Policies · **behoben**

**Geändert:** `packages/db/drizzle/0394_rls_global_row_policies.sql`.

Die eine `FOR ALL`-Policy je Tabelle ist durch vier kommandospezifische
ersetzt: `SELECT` erlaubt weiterhin `org_id IS NULL OR org_id = <org>` (die
fachlich gewollte plattformweite Vorlage bleibt lesbar), `INSERT`/`UPDATE`/
`DELETE` verlangen `org_id = <org>`. Damit verschwindet der Schreibkanal:
eine globale Zeile ist unantastbar, und eine eigene Zeile lässt sich nicht
nach „global" umhängen. Wer Plattformvorlagen pflegen muss, tut das als
Superuser über Migration oder Seed — dieselbe Trennung, die S02-03 (WP3)
ohnehin einführen soll.

**Nachweis:**

```
NOTICE: S01-07: 7 Tabellen von FOR-ALL auf kommandospezifische Policies umgestellt
```

Systemtest: für jede der 7 Tabellen trifft `UPDATE … WHERE org_id IS NULL`
und `DELETE … WHERE org_id IS NULL` 0 Zeilen; der konkrete
`INSERT … (NULL,'WP2-GLOBAL-POISON', …)` aus `evidence/S01_nullorg_probe.txt`
wird von der Policy abgelehnt.

---

### S01-08 — High — Views und Materialized Views · **behoben**

**Geändert:** `packages/db/drizzle/0393_rls_views_security_invoker.sql`,
`deploy/provision-grc-app.sh`, `0399`.

Alle 7 Views bekommen `security_invoker = true`, katalog-getrieben statt über
eine Namensliste. Die 2 Materialized Views können konstruktionsbedingt keine
RLS tragen (Inhalt entsteht beim `REFRESH` unter dem Eigentümer): ihnen wird
`grc_app` und PUBLIC das Leserecht entzogen — hart geschlossen statt
scheinbar geschützt. Beide sind im Anwendungscode nicht referenziert
(Volltextsuche). Der pauschale `GRANT … ON ALL TABLES` erfasst auch Views und
Matviews, deshalb wiederholen `0399` und `provision-grc-app.sh` den REVOKE
**nach** dem GRANT; dasselbe gilt für die acht RLS-Testdateien, die in ihrem
`beforeAll` granten.

**Nachweis:** Systemtest — `v_budget_usage` und `v_ai_documentation_status`
liefern im Org-A-Kontext 0 Zeilen von Org B (vorher 1); jede Matview antwortet
`permission denied`; kein View ohne `security_invoker`.

---

### S01-09 — Medium — Worker als Superuser · **teilweise**

**Geändert:** `deploy/provision-grc-app.sh`, `packages/db/src/index.ts`.

Die Entscheidung, den Worker org-übergreifend arbeiten zu lassen, ist
nachvollziehbar; die gewählte Rolle ist es nicht — SUPERUSER bringt neben
`BYPASSRLS` auch `COPY FROM PROGRAM`, `ALTER SYSTEM` und Eigentümerrechte auf
jedes Objekt mit, nichts davon braucht ein Cron-Job.

Was WP2 liefert: `provision-grc-app.sh` legt bei gesetztem
`GRC_WORKER_PASSWORD` die Rolle `grc_worker` an — `NOSUPERUSER`,
`NOCREATEDB`, `NOCREATEROLE`, aber `BYPASSRLS` — mit denselben DML-Grants und
Default-Privilegien wie `grc_app`. Zusätzlich macht die Startup-Assertion aus
S01-10 die bisherige Superuser-Verbindung **sichtbar und einzeln widerrufbar**
(`ARCTOS_ALLOW_PRIVILEGED_DB=true`) statt sie still aus einer fehlenden
Variablen folgen zu lassen.

Was WP2 **nicht** liefert und nicht darf: `docker-compose.production.yml` und
`.github/workflows/ci.yml` (WP10) auf `grc_worker` umzustellen und die
Worker-Prozesse (WP9) darauf zu prüfen. **Übergabe an WP9/WP10.**

---

### S01-10 — Medium — Superuser-Fallback ohne Startup-Assertion · **behoben**

**Geändert:** `packages/db/src/index.ts`.

Neu: `checkRuntimeRoleIsolation()` und `assertRuntimeRoleIsolation()`. Die
Assertion läuft beim Modul-Load nach dem Prewarm und stellt fest, ob der
Runtime-Pool als `rolsuper`/`rolbypassrls` verbindet. In `NODE_ENV=production`
ist das **fatal** (`process.exit(1)`) mit einer Meldung, die sagt, ob
`APP_DATABASE_URL` gesetzt war und was zu tun ist; ausserhalb Produktion eine
Warnung. Ausnahme nur über das ausdrückliche `ARCTOS_ALLOW_PRIVILEGED_DB=true`
— das ist der Worker (S01-09), und die Ausnahme steht damit im Deployment
sichtbar, greppbar und einzeln widerrufbar.

Der veraltete Kommentar in `index.ts:157`, der `create-missing-tables.ts` noch
als Teil des Ablaufs nannte (Übergabe aus WP1), ist entfernt.

**Abstimmung:** dieser Fix ist zugleich der Kern von **WP10/S13-10**.

---

### S01-11 — Medium — `GRC_APP_PASSWORD` ohne `:?`-Pflichtprüfung · **teilweise**

`docker-compose.production.yml` gehört nicht zur Dateihoheit von WP2. Die
Einzeilenänderung `${GRC_APP_PASSWORD:-}` → `${GRC_APP_PASSWORD:?…}` ist an
**WP10** übergeben (siehe Abschnitt 6).

Was WP2 beisteuert: der gefährlichere der beiden Ausgänge — leeres Passwort
plus `trust`-Authentifizierung, also stille Verbindung als privilegierte Rolle
— wird jetzt von der Startup-Assertion aus S01-10 abgefangen. Der andere
Ausgang (Verbindung scheitert) war schon vorher laut. Zusätzlich prüft
`provision-grc-app.sh` am Ende selbst, dass `grc_app` tatsächlich Rechte
bekommen hat **und** unprivilegiert ist, und bricht sonst ab.

---

### S01-12 — Medium — Grants und `FORCE` nur im Shell-Skript · **behoben**

**Geändert:** `packages/db/drizzle/0399_grc_app_grants.sql`,
`packages/db/drizzle/0395_rls_force_and_policy_gaps.sql`,
`deploy/provision-grc-app.sh`.

`0399` vergibt die Grants und Default-Privilegien für `grc_app` im
versionierten Schema — und zwar `ALTER DEFAULT PRIVILEGES` für **jede** Rolle,
die aktuell Tabellen in `public` besitzt, nicht nur für `grc` (das war die
dritte Teilursache des Findings). Die Migration legt bewusst **keine** Rolle
an: Rollen sind clusterweit und Passwörter gehören nicht in eine
Migrationsdatei; fehlt `grc_app`, ist sie ein No-Op. `FORCE` auf
`organization` (#SEC-F09) setzt `0395` katalog-getrieben und `0399` noch
einmal benannt.

**Nachweis:**

```
NOTICE: S01-12: Grants für grc_app gesetzt, Default-Privilegien für 1 Eigentümerrolle(n)
$ PGPASSWORD=grc_app_dev_password psql -U grc_app -d wp2_verify -c "select count(*) from risk;"
 0                                    # vorher: ERROR: permission denied for table risk
```

Die Migration bricht ab, wenn `grc_app` danach kein `SELECT` auf `risk` hat.

---

### S01-13 — Medium — `SECURITY DEFINER` ohne `search_path`, `EXECUTE` an PUBLIC · **behoben**

**Geändert:** `packages/db/drizzle/0398_secdef_function_hardening.sql`,
`packages/db/drizzle/0397_rls_policy_normalization.sql` (Event-Trigger),
`deploy/provision-grc-app.sh`.

Drei Massnahmen:

1. `SET search_path = pg_catalog, public` auf allen `SECURITY DEFINER`-
   Funktionen — per `ALTER FUNCTION`, also **ohne** die Rümpfe der
   Trigger-Funktionen anzufassen (die gehören WP4/WP8).
2. `REVOKE ALL … FROM PUBLIC`. Für Trigger-Funktionen folgenlos (PostgreSQL
   prüft `EXECUTE` bei `CREATE TRIGGER`, nicht beim Auslösen); ein direkter
   Aufruf durch `grc_app` ist danach verboten. Aus `provision-grc-app.sh` ist
   das pauschale `GRANT EXECUTE ON ALL FUNCTIONS` entfernt, das genau das
   wieder aufgehoben hätte.
3. **Org-Prüfung in `tombstone_audit_entry`.** Die Funktion suchte und änderte
   `audit_log` allein über die ID — ein Aufruf mit einer fremden UUID
   redigierte unwiederbringlich E-Mail, Name, IP und PII eines fremden
   Audit-Eintrags. Sie prüft jetzt `app.current_org_id` gegen `audit_log.org_id`
   und wirft `insufficient_privilege`. Ein kontextloser Aufruf bleibt erlaubt
   (der DSGVO-Löschlauf im Worker läuft org-übergreifend als Superuser); der
   Guard greift genau im HTTP-Pfad. Der Rumpf ist im Übrigen unverändert
   übernommen.

**Ehrliche Grenze:** solange die Anwendung mehrere dieser Funktionen selbst
aufruft (`record_migration_anchor`, `audit_anchor_verify`,
`tombstone_audit_entry`), muss `grc_app` `EXECUTE` behalten. Der Entzug von
PUBLIC schränkt damit nur **andere** Rollen ein. Die eigentliche Kontrolle
gegen mandantenübergreifenden Missbrauch ist die Org-Prüfung im Rumpf — für
`tombstone_audit_entry` erledigt, für die Audit-Trail-Funktionen von WP4
übergeben.

**Nachweis:**

```
NOTICE: S01-13: 4 SECURITY-DEFINER-Funktionen gehärtet
select count(*) from pg_proc p … where p.prosecdef
  and (p.proconfig is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee=0));
 -->  0     (vorher 13, inkl. der neun neuen Funktionen von WP4)
```

Systemtest: `tombstone_audit_entry(<Audit-Eintrag von Org B>, 'wp2')` wirft
`… belongs to a different organization`.

---

### S01-14 — Medium — Coverage-Report widerspricht der Datenbank · **behoben**

**Geändert:** `scripts/audit-rls-coverage.mjs` (Neufassung),
`docs/security/rls-coverage-report.md` + `.csv` (neu erzeugt).

Das Skript liest jetzt die **laufende Datenbank** (`pg_class`, `pg_policies`,
`pg_trigger`, `information_schema`) statt Migrationstexte per Regex. Damit
verschwindet die Ursache: `0379` (das RLS wieder abschaltete) kam in der
Textanalyse nicht vor, weshalb der Report `session`, `account`,
`verification_token` und `audit_log` als „RLS ✅ Policy ✅" auswies, während
`pg_class` für alle vier `relrowsecurity = false` meldete. Der Report nennt
jetzt zusätzlich die Geltungsbereiche (`TENANT_CHILD`, `AUTH`, `VIEW`,
`MATVIEW`) und die konkreten Policy-Defekte, und er hält ausdrücklich fest,
dass ein grüner Report ohne den Systemtest nur eine Behauptung wäre.

**Nachweis:**

```
$ DATABASE_URL=…/wp2_verify node scripts/audit-rls-coverage.mjs
→ docs/security/rls-coverage-report.{md,csv} geschrieben — 592 Objekte, 0 Lücke(n).
$ DATABASE_URL=…/wp2_before node scripts/audit-rls-coverage.mjs --check ; echo $?
✗ 530 RLS-Lücke(n) in der Datenbank: …
1
```

---

### S01-15 — Medium — Prüfwerkzeug blind für die gefundenen Lücken · **behoben**

**Geändert:** `packages/db/src/rls-audit.ts` (Neufassung),
`packages/db/drizzle/0397_rls_policy_normalization.sql` (Teil 2).

Alle drei blinden Flecken sind geschlossen:

1. Tabellen ohne `org_id` gelten nicht mehr pauschal als `platform_ignored`.
   Sie werden gegen ihre Fremdschlüssel geprüft (bis zu vier Sprünge); führt
   ein Pfad auf eine org-skalierte Tabelle, ist die Tabelle `tenant_child` und
   braucht eine Policy über den Elternbezug. `user`/`session`/`account`/
   `verification_token` bilden den eigenen Geltungsbereich `auth`.
2. Views und Materialized Views werden betrachtet (`security_invoker` bzw.
   Leserecht von `grc_app`).
3. **Policy-Ausdrücke werden gelesen.** Erkannt werden `app.bypass_rls`,
   `USING/CHECK (true)` auf einem anderen Kommando als `INSERT`, schreibbares
   `org_id IS NULL`, `::uuid`-Cast ohne `NULLIF` und Textvergleich.

**Nachweis der Wirksamkeit** (das Werkzeug findet, was der Audit fand):

```
gegen wp2_before : 592 Objekte, 528 gaps  (RLS_MISSING access_log/audit_log/user/…,
                                           WEAK_POLICY … app.bypass_rls, no NULLIF guard, …)
gegen wp2_verify : 592 Objekte,   0 gaps
```

Zusätzlich hält ein **Event-Trigger** (`arctos_rls_guard_trg`, Migration
`0397` Teil 2) die Invarianten für jede künftig angelegte Tabelle, Policy,
View und `SECURITY DEFINER`-Funktion aufrecht. Das ist kein Luxus, sondern
gemessen notwendig: vier Migrationen laufen bei einem Neuaufbau
grundsätzlich in einem **zweiten Durchgang** nach allen anderen (`0068`,
`0069`, `0071`, `0106` — WP1, Restrisiko 4) und nahmen dabei
`security_invoker` und die NULLIF-Form wieder zurück; und
`audit_chain_verification` aus WP4s `0404` kam mit `org_id`, aber ohne RLS
hinzu. Ohne den Trigger meldete das Gate nach einem vollständigen Neuaufbau
neun Lücken, mit ihm null. Der Trigger fängt jede Ausnahme ab und warnt nur —
ein werfender Event-Trigger würde sämtliche DDL der Datenbank blockieren.

---

### S01-16 — Medium — RLS-Testsuite prüft live nur drei Tabellen · **behoben**

**Neu:** `packages/db/tests/rls/tenant-isolation-systemtest.test.ts`,
`tenant-isolation-seed.sql`, `tenant-isolation-cleanup.sql` (Abschnitt 2).
**Geändert:** `packages/db/tests/rls/rls-coverage-systemtest.test.ts` (die
widerlegte Annahme im Kopfkommentar ist durch die Messung ersetzt, die sie
widerlegt), `logtable-rls-exception.test.ts` (umgedreht).

Die fünf im Finding vermissten Negativtests existieren jetzt alle: View/
Matview, Kindtabelle ohne `org_id`, `SET app.bypass_rls` wirkungslos,
`org_id = NULL` nicht schreibbar, Runtime-Rolle weder `rolsuper` noch
`rolbypassrls`.

---

### S01-17 — Medium — `whistleblowing_audit_log` ohne Mandantenprädikat · **behoben**

**Geändert:** `packages/db/drizzle/0395_rls_force_and_policy_gaps.sql`.

`wb_audit_log_officer_read` bekommt das Mandantenprädikat per `AND` ergänzt;
die Rollenprüfung bleibt unverändert **zusätzlich** bestehen. Da die Tabelle
entgegen der Tabellenmatrix des Berichts keine `org_id` trägt (siehe
Abschnitt 1), ist das Prädikat als `EXISTS` auf `wb_case.org_id` formuliert.
`FORCE` kommt aus demselben Migrationsschritt. Die Migration ist idempotent
und bricht ab, wenn das Prädikat nicht eingefügt werden konnte.

**Nachweis:**

```
wb_audit_log_officer_read | ((EXISTS ( SELECT 1 FROM wb_case wc
   WHERE ((wc.id = whistleblowing_audit_log.case_id)
     AND (wc.org_id = (NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid))))
  AND (current_setting('app.current_user_role'::text, true) = ANY (ARRAY['whistleblowing_officer',…])))
```

---

### S01-18 — Medium — 373 Tabellen mit `''::uuid`-anfälligen Policies · **behoben**

**Geändert:** `packages/db/drizzle/0397_rls_policy_normalization.sql`,
`packages/db/tests/rls/catalog-budget-isolation.test.ts`.

Jede org_id-Policy ist auf die Form gebracht, die 442 andere bereits richtig
hatten:
`org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid`.
Damit ist der Ausdruck bei jedem GUC-Zustand definiert — nicht gesetzt →
NULL, leer → NULL, gesetzt → UUID — und `org_id = NULL` ist kein Treffer. Die
Fehlrichtung bleibt fail-closed, aber ohne Exception. Der Zwei-Pool-Aufbau
bleibt bestehen (er hat weitere Gründe: exklusive Verbindung je Request,
PII-Scrubbing), er ist nur nicht mehr die einzige Absicherung gegen einen
500er.

Drei Tests in `catalog-budget-isolation.test.ts` hatten den Defekt als
Sollverhalten festgeschrieben („an empty/unset value causes a cast error,
which effectively denies access — correct behavior"). Eine Exception ist keine
Zugriffskontrolle, sondern ein Verfügbarkeitsdefekt; die Tests prüfen jetzt
`cnt = 0` statt `rejects.toThrow()`.

**Nachweis:**

```
NOTICE: S01-18/-25: 582 Policies auf die NULLIF-geschützte UUID-Form normalisiert
$ psql -U grc_app -d wp2_verify -c "set app.current_org_id=''; select count(*) from risk;"
 0            # vorher: ERROR: invalid input syntax for type uuid: ""
select count(*) … ohne NULLIF-Guard  -->  0   (vorher 589)
```

---

### S01-19 — Low — `notification_preference` deny-all · **behoben**

**Geändert:** `packages/db/drizzle/0395_rls_force_and_policy_gaps.sql`.

Die Tabelle hat keine `org_id`, wohl aber `user_id` (`NOT NULL`) — die
fachlich richtige Isolation ist nutzer-, nicht org-bezogen. Policy:
`FOR ALL USING (user_id = <user-GUC>)`, plus `FORCE`. `app.current_user_id`
setzt `reserveRequestContext` bei jedem authentifizierten Request.

---

### S01-20 — Low — 10 Tabellen mit RLS ohne `FORCE` · **behoben**

**Geändert:** `packages/db/drizzle/0395_rls_force_and_policy_gaps.sql`.

Katalog-getrieben statt über eine Namensliste: **jede** Tabelle in `public`
mit aktivem RLS bekommt `FORCE`. Gemessen waren es 15 statt der im Bericht
genannten 10. Die Migration bricht ab, wenn danach eine übrig bleibt.

**Nachweis:** `select count(*) … relrowsecurity and not relforcerowsecurity`
→ **0** (vorher 15).

---

### S01-21 — Low — Kontextverlust ist still · **behoben**

**Geändert:** `apps/web/src/lib/api.ts` (nur diese Stelle).

`establishRequestScopedContext()` gibt jetzt eine `Response` zurück, wenn der
Kontext nicht hergestellt werden konnte, und `withAuth` antwortet damit
**503 `application/problem+json`** mit `Retry-After` statt still auf den
kontextlosen Basis-Pool zurückzufallen.

Die alte Zusage („RLS-filtered (empty) reads, which is the safe direction to
fail") galt nur für die Tabellenklasse mit org_id-Policy. Für `audit_log`,
`access_log`, `user`, die Kindtabellen und die Views galt sie nicht — dort
entschied allein ein handgeschriebener Filter. Nach den Fixes oben wäre der
Fallback zwar fail-closed, wird aber trotzdem abgelehnt: ein stiller Fallback
macht eine Sicherheitsvoraussetzung von der Pool-Auslastung abhängig, und
„leere Antwort" ist für den Aufrufer nicht von „es gibt keine Daten" zu
unterscheiden.

Die Kommentare an `scripts/check-route-rls-context.mjs` und der Umbau der 115
nicht umschlossenen Routen gehören WP3 — **notiert, nicht getan**
(Abschnitt 6).

---

### S01-22 — Low — Org-Zugehörigkeit nur gegen das JWT geprüft · **verworfen (Zuständigkeit WP3)**

Kein Falsch-Positiv — der Befund besteht unverändert: nach Entzug einer
Mitgliedschaft behält das JWT die Rolle bis zum nächsten Refresh, und RLS
kennt nur den GUC, nicht die Mitgliedschaft.

Ein Fix liegt aber vollständig ausserhalb der Dateihoheit von WP2: er verlangt
serverseitige Session-Invalidierung beim Rollenentzug
(`packages/auth/**`, `apps/web/src/auth.ts`) oder eine Verkürzung der
Session-Lebensdauer. Beides gehört zu WP3; der Auditbericht sagt das selbst
(„Detailbewertung der Session-Lebensdauer gehört zu S02"). **Übergeben an
WP3** (Abschnitt 6). Innerhalb WP2 wurde nichts geändert, damit der Befund
nicht als erledigt erscheint.

---

### S01-23 — Low — Seeds setzen `app.bypass_rls` sitzungsweit · **behoben**

**Geändert:** `packages/db/src/seed-control.ts`.

Die Zeile `SET app.bypass_rls = 'true'` ist entfernt. Sie ist durch `0390`
ohnehin gegenstandslos geworden, und das Seed braucht sie nicht: es öffnet
einen eigenen Client auf `DATABASE_URL`, also die Superuser-Rolle `grc`, und
Superuser umgehen RLS unabhängig von `FORCE`. Der Kommentar an der Stelle
benennt den richtigen Weg, falls das Seed je unprivilegiert läuft
(`set_config('app.current_org_id', <org>, true)` je Org).

`seed-risk.ts:277` war bereits die korrekte, transaktionslokale Variante und
bleibt unverändert (gehört ausserdem nicht zur Dateihoheit von WP2).

---

### S01-24 — Low — kein `--check`-Modus, Report wird bei jedem Lauf überschrieben · **behoben**

**Geändert:** `scripts/audit-rls-coverage.mjs`.

`--check` schreibt nichts und beendet mit Exit 1, wenn (a) eine RLS-Lücke
besteht **oder** (b) der eingecheckte Report vom gemessenen Ist abweicht. Die
zweite Bedingung ist der eigentliche Fix: bisher erzeugte eine Regression
keinen Fehler, sondern nur eine Dateiänderung — Drift zwischen Report und
Datenbank fiel nie auf.

**Nachweis:**

```
$ DATABASE_URL=…/wp2_verify node scripts/audit-rls-coverage.mjs --check ; echo $?
✓ RLS-Abdeckung vollständig (592 Objekte, 0 Lücken) und Report aktuell.
0
$ DATABASE_URL=…/wp2_before node scripts/audit-rls-coverage.mjs --check ; echo $?
✗ 530 RLS-Lücke(n) … ✗ docs/security/rls-coverage-report.md weicht vom gemessenen Ist ab.
1
```

Die Verdrahtung in CI gehört WP10 — Vorschlag in Abschnitt 6.

---

### S01-25 — Low — 45+ Policies vergleichen `(org_id)::text` · **behoben**

Teil derselben Normalisierung wie S01-18 (`0397`). Gemessen waren es 52
Policies. Der Vergleich ist jetzt durchgehend UUID-typisiert; fachlich
äquivalent, aber einheitlich und damit automatisiert prüfbar — was die
Voraussetzung für das Policy-Ausdrucks-Gate aus S01-15 ist.

**Nachweis:** `select count(*) … qual like '%(org_id)::text = current_setting%'`
→ **0** (vorher 52).

---

### S01-26 — Info — `includeDescendants` unter RLS wirkungslos · **teilweise**

Die Beobachtung ist bestätigt und war tragend für die Entscheidung zu S01-06
(Abschnitt 3). Die DB-Seite ist gelöst: `app_current_org_scope()` liefert die
eigene Org **plus ihre Nachfahren**, die `SELECT`-Policies der drei
Log-Tabellen nutzen sie, und die Isolation gegen unverwandte Mandanten ist im
Systemtest nachgewiesen.

**Offen bleibt die Route.** `apps/web/src/app/api/v1/audit-log/route.ts:48-60`
gehört WP4. Ihre rekursive CTE auf `organization` liefert weiterhin genau eine
ID, weil die `organization`-Policy bewusst nur die eigene Zeile zeigt. Der
Ersatz ist eine Zeile — `SELECT * FROM app_current_org_scope()` — und liegt
bereit. **Übergeben an WP4** (Abschnitt 6). Solange das nicht geschieht,
verhält sich der Parameter wie bisher; er ist jetzt aber wenigstens nicht mehr
die Begründung für eine abgeschaltete Mandantentrennung.

---

## 5. Neue Migrationen (Nummernkreis 0390–0399)

| Datei                                 | Zweck                                                                             | Findings                        |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| `0390_rls_remove_bypass_hatch.sql`    | `app.bypass_rls` aus 55 Policies entfernen                                        | S01-02, S01-23                  |
| `0391_rls_child_tables.sql`           | RLS + Eltern-Policy für 18 Kindtabellen ohne `org_id`                             | S01-01, S01-03                  |
| `0392_rls_auth_core_tables.sql`       | `user` mitgliedschaftsskaliert; `session`/`account`/`verification_token` deny-all | S01-04                          |
| `0393_rls_views_security_invoker.sql` | `security_invoker` auf allen Views; Matviews entziehen                            | S01-08                          |
| `0394_rls_global_row_policies.sql`    | `org_id IS NULL` nur noch lesbar, nicht schreibbar                                | S01-07                          |
| `0395_rls_force_and_policy_gaps.sql`  | `FORCE` flächendeckend; `notification_preference`; WB-Log-Prädikat                | S01-12b, S01-17, S01-19, S01-20 |
| `0396_rls_log_tables.sql`             | RLS auf den drei Log-Tabellen; `app_current_org_scope()`                          | S01-06, S01-26                  |
| `0397_rls_policy_normalization.sql`   | einheitliche NULLIF-Form + Event-Trigger `arctos_rls_guard_trg`                   | S01-15, S01-18, S01-25          |
| `0398_secdef_function_hardening.sql`  | `search_path`, `EXECUTE`, Org-Prüfung in `tombstone_audit_entry`                  | S01-13                          |
| `0399_grc_app_grants.sql`             | Grants + Default-Privilegien im versionierten Schema                              | S01-12                          |

Alle tragen den ADR-023-Metadaten-Header. Alle sind idempotent und
katalog-getrieben (keine fest verdrahteten Tabellenlisten ausser dort, wo die
Eltern-Kind-Beziehung fachlich benannt werden muss). Sieben von zehn prüfen
ihren eigenen Endzustand und brechen mit `RAISE EXCEPTION` ab, wenn er nicht
erreicht ist — eine Migration, die stillschweigend nichts bewirkt, wäre genau
der Placebo-Fix, den der Plan verbietet.

---

## 6. Restrisiko und Übergaben

### An WP3 (Authentifizierung/Autorisierung)

1. **S01-04, Restlücke:** die `user`-Policy hat eine kontextlose Disjunktion,
   weil `packages/auth/src/providers.ts:197` und `:341` `user` per E-Mail
   lesen müssen, bevor eine Identität feststeht. Der saubere Weg ist eine
   `SECURITY DEFINER`-Funktion für die Anmeldeabfrage (Muster:
   `app_current_org_scope()` in `0396`). Gehört zu S02-05.
2. **S01-21/S01-22:** die 115 nicht in `withErrorHandler` umschlossenen Routen
   nutzen weiterhin den kontextlosen Basis-Pool; `scripts/check-route-rls-context.mjs`
   verspricht dafür „fail-closed", was nur für Tabellen mit org_id-Policy gilt
   (nach WP2 sind das alle mandantenbezogenen Objekte, die Zusage stimmt also
   jetzt — der Kommentar sollte das aber sagen). S01-22 (Session-Invalidierung
   beim Rollenentzug) ist unverändert offen und liegt vollständig in
   `packages/auth/**`.
3. `apps/web/src/lib/api.ts` wurde **nur** an der S01-21-Stelle geändert
   (`establishRequestScopedContext` gibt `Response | undefined` zurück,
   `withAuth` propagiert sie).

### An WP4 (Audit-Trail)

4. **S01-26:** `apps/web/src/app/api/v1/audit-log/route.ts:48-60` — die
   rekursive CTE durch `SELECT * FROM app_current_org_scope()` ersetzen, dann
   funktioniert `includeDescendants` tatsächlich. Alternativ den Parameter
   entfernen; beides ist besser als der Status quo.
5. **Die drei Log-Tabellen tragen jetzt RLS + FORCE.** Trigger und Guards hat
   WP2 nicht angefasst. Zu beachten: die `INSERT`-Policy ist bewusst permissiv
   (`WITH CHECK true`), damit org-lose Trigger- und Login-Inserts durchgehen;
   `UPDATE`/`DELETE` sind org-skaliert.
6. **`tombstone_audit_entry` trägt jetzt einen Org-Guard** (S01-13). Wird die
   Funktion im Rahmen von S03-06/S07-03 neu geschrieben, muss er erhalten
   bleiben — `tenant-isolation-systemtest.test.ts` schlägt sonst fehl.
7. **Die neuen `SECURITY DEFINER`-Funktionen von WP4** (`write_audit_entry`,
   `audit_anchor_verify`, `audit_log_chain_assign`, …) werden vom
   Event-Trigger aus `0397` automatisch gehärtet (`search_path`, `REVOKE
PUBLIC`, `GRANT grc_app`). Eine **Org-Prüfung im Rumpf** ist damit nicht
   ersetzt — sie gehört zu WP4.
8. **`audit_chain_verification`** (aus `0404`) hat `org_id`, aber keine eigene
   Policy mitgebracht; der Event-Trigger hat ihr die org-skalierte
   Standard-Policy gegeben. Falls WP4 eine engere Form will, einfach eine
   eigene Policy anlegen — der Trigger fasst Tabellen mit vorhandener Policy
   nicht an.

### An WP9/WP10 (Worker, Betrieb, CI)

9. **S01-09:** `docker-compose.production.yml` und `.github/workflows/ci.yml`
   auf `grc_worker` umstellen (`BYPASSRLS`, kein `SUPERUSER`).
   `provision-grc-app.sh` legt die Rolle bei gesetztem `GRC_WORKER_PASSWORD`
   an. Bis dahin **muss der Worker `ARCTOS_ALLOW_PRIVILEGED_DB=true` setzen**,
   sonst beendet sich der Prozess in Produktion (S01-10) — das ist der
   einzige unmittelbar deploy-relevante Punkt aus WP2.
10. **S01-11:** `docker-compose.production.yml:212` von
    `${GRC_APP_PASSWORD:-}` auf `${GRC_APP_PASSWORD:?…}` umstellen,
    konsistent zu `DB_PASSWORD`/`AUTH_SECRET`/`CRON_SECRET` derselben Datei.
11. **CI-Gate:** `node scripts/audit-rls-coverage.mjs --check` gegen die
    frisch migrierte Test-Datenbank in `ci.yml` aufnehmen, und die
    RLS-Suite (`npm run test:rls -w @grc/db`) mit gesetztem
    `APP_DATABASE_URL=postgresql://grc_app:…` — ohne diese Variable läuft sie
    als Superuser und ist wertlos. Das ist zugleich S11-11 (WP11).

### Verbleibende technische Grenzen

12. **Der Event-Trigger `arctos_rls_guard_trg` greift nur bei `CREATE`**, nicht
    bei `ALTER TABLE … DISABLE ROW LEVEL SECURITY` oder `DROP POLICY`. Eine
    Migration kann die Isolation also weiterhin bewusst abschalten — das ist
    beabsichtigt (es gibt legitime Gründe), wird aber vom Coverage-Gate und
    vom Systemtest sofort gemeldet.
13. **Fünf Tabellen sind nicht per Zeilenprobe geprüft** (Abschnitt 2, Ende).
14. **Materialized Views bleiben mandantenübergreifend materialisiert.** Der
    Zugriff ist der Runtime-Rolle entzogen; wer sie wieder öffnen will, muss
    eine org-Filterung mitliefern. Beide sind derzeit unbenutzt.
15. **Die Log-Tabellen-Policies verlassen sich auf `app_current_org_scope()`.**
    Die Funktion ist `SECURITY DEFINER` und umgeht damit bewusst die
    `organization`-RLS. Ihre Korrektheit hängt daran, dass ein Mandant
    `organization.parent_org_id` einer fremden Zeile nicht setzen kann — das
    ist durch `org_isolation_modify` gedeckt und im Systemtest geprüft, wäre
    aber bei einer künftigen Lockerung der `organization`-Policy neu zu
    bewerten.

---

## 7. Aufräumen

Die Arbeits-Datenbanken `wp2_base`, `wp2_before`, `wp2_verify` sind entfernt
(`dropdb`). `grc_platform` wurde nicht angefasst. Die Rolle `grc_app` besteht
unverändert; `grc_worker` wurde nicht angelegt (kein `GRC_WORKER_PASSWORD`
gesetzt). Der Seed des Systemtests räumt sich selbst auf — vor **und** nach
dem Lauf, damit ein abgebrochener Vorlauf den nächsten nicht an einem
UNIQUE-Index scheitern lässt.
