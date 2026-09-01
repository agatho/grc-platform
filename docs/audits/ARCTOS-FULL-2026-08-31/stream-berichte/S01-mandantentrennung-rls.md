# S01 — Mandantentrennung & Row Level Security

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S01
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`, laufende PostgreSQL 16.15 (`grc_platform`, 527 Tabellen)
**Prüfrolle:** eigens angelegte Nicht-Superuser-Rolle `s01_audit_app` (`rolsuper=f`, `rolbypassrls=f`) — funktional identisch zur Produktiv-Runtime-Rolle `grc_app`
**Test-DB:** `grc_rls_audit` (Klon von `grc_platform` via `createdb -T`), Haupt-DB blieb unverändert

---

## 1. Zusammenfassung

Die Mandantentrennung von ARCTOS ist **auf dem Papier flächendeckend, in der Umsetzung aber an fünf strukturellen Stellen durchlässig**:

| Ebene                                                              | Ist                                      |
| ------------------------------------------------------------------ | ---------------------------------------- |
| Tabellen gesamt (public)                                           | 527                                      |
| davon mit `org_id`                                                 | 455                                      |
| davon RLS aktiv                                                    | 452 von 455 (3 bewusst ausgenommen)      |
| Policies gesamt                                                    | 2.262, alle PERMISSIVE, alle `TO PUBLIC` |
| Praktischer Cross-Tenant-Test (445 Tabellen, SELECT/UPDATE/DELETE) | 443 OK, **2 LEAK**                       |

Der Kern der org_id-Policies **hält**: von 445 praktisch getesteten org-skalierten Tabellen ließ sich in 443 Fällen weder lesend noch schreibend auf Fremdmandanten zugreifen (Beleg: `evidence/S01_table_matrix.csv`). Die Lücken liegen **nicht in den Policies der Haupttabellen**, sondern in fünf systematischen blinden Flecken, die das eingebaute Prüfwerkzeug (`runRlsAudit()`, `docs/security/rls-coverage-report.md`, `tests/rls/`) **konstruktionsbedingt allesamt nicht sieht**:

1. **Kindtabellen ohne `org_id`** (18 Stück, 13 praktisch als cross-tenant les- **und löschbar** nachgewiesen) — die Coverage-Prüfung stuft jede Tabelle ohne `org_id` pauschal als „platform_ignored" ein.
2. **Views und Materialized Views** (8 Stück) laufen ohne `security_invoker` im Besitz des Superusers `grc` und umgehen die RLS ihrer Basistabellen — praktisch nachgewiesen.
3. **Die Auth-Kerntabellen** `user`, `session`, `account`, `verification_token` tragen gar keine RLS; `user` enthält `password_hash` und `ical_token`.
4. **Ein bewusst eingebauter globaler Escape-Hatch** `app.bypass_rls` in 55 Policies auf 33 Tabellen, den die unprivilegierte Runtime-Rolle selbst setzen kann.
5. **Log-Tabellen** (`audit_log`, `access_log`, `audit_anchor`) mit bewusst deaktivierter RLS — der gesamte Audit-Trail aller Mandanten ist für die Runtime-Rolle les- und (eingeschränkt) schreibbar.

**Ein Befund ist end-to-end über die HTTP-API ausnutzbar** (`S01-01`, Critical): `GET`/`PUT /api/v1/erm/bowtie/[riskId]` filtert `bowtie_path` ausschließlich über die aus dem Pfad übernommene `riskId` — die Tabelle hat weder `org_id` noch RLS. Ein authentifizierter Nutzer von Mandant A liest damit die Bowtie-Analyse eines fremden Risikos und **löscht sie mit einem PUT**.

Zusätzlich weicht `docs/security/rls-coverage-report.md` messbar von der Datenbank ab (behauptet RLS+Policy für `session`, `account`, `verification_token`, `audit_log`, `access_log` — real: keine).

---

## 2. Methodik-Protokoll — tatsächlich ausgeführte Schritte

Alle Aussagen unten sind gegen die laufende Datenbank bzw. eine Klon-DB verifiziert, nicht gegen die Dokumentation.

### 2.1 Umgebung

```
$ createdb -h localhost -U grc -T grc_platform grc_rls_audit
CLONE OK
$ psql -U grc -d grc_rls_audit -tAc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='public';"
527
```

Die Rolle `grc_app` besitzt in der Audit-DB **keinerlei Grants** (siehe `S01-12`), und ihr Passwort wurde während des Audits mehrfach von außen rotiert. Für reproduzierbare Messungen wurde deshalb eine eigene Rolle angelegt:

```sql
CREATE ROLE s01_audit_app LOGIN PASSWORD '…';
ALTER ROLE s01_audit_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO s01_audit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO s01_audit_app;
```

```
$ psql -U s01_audit_app -tAc "select current_user, rolbypassrls, rolsuper …"
s01_audit_app|f|f
```

### 2.2 Schritt 1+2 — Ist-Liste und Differenzmenge (gegen `pg_class`/`pg_policies`)

```sql
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND n.nspname='public';                      -- 527
SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND column_name='org_id';            -- 455
SELECT count(*) … AND c.relrowsecurity;                           -- 460
SELECT count(*) … AND c.relforcerowsecurity;                      -- 450
SELECT count(*) FROM pg_policies WHERE schemaname='public';       -- 2262
```

**Tabellen mit `org_id` OHNE RLS (Kandidatenklasse 1):**

```
access_log
audit_anchor
audit_log
```

→ `S01-06`

**Tabellen OHNE `org_id` und ohne RLS:** 64 (`evidence/S01_no_orgid_no_rls.txt`). Davon 18 mit Fremdschlüssel auf eine org-skalierte Elterntabelle (Kandidatenklasse 2, `evidence/S01_no_orgid_children.csv`) → `S01-03`, `S01-04`.

**RLS aktiv, aber ohne FORCE (10):**

```
audit_qa_checklist_item, audit_wp_review_note, audit_wp_review_note_reply,
notification_preference, org_entity_relationship, organization,
risk_anomaly_detection, wb_investigation_log, webhook_delivery_log,
whistleblowing_audit_log
```

→ `S01-19`, `S01-20`

**RLS aktiv, aber ZERO Policies:** `notification_preference` → `S01-19`

### 2.3 Schritt 3 — Policy-Qualität

Gruppierung aller 2.262 Policies nach Ausdruck (`evidence/S01_policies.csv`):

| n      | cmd                     | USING                                                                                |
| ------ | ----------------------- | ------------------------------------------------------------------------------------ |
| 442    | SELECT/UPDATE/DELETE je | `org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid`             |
| 179    | ALL                     | `org_id = current_setting('app.current_org_id', true)::uuid`                         |
| 151    | ALL                     | `org_id = current_setting('app.current_org_id')::uuid` _(ohne `missing_ok`)_         |
| 45     | ALL                     | `(org_id)::text = current_setting('app.current_org_id', true)`                       |
| **32** | **ALL**                 | **`current_setting('app.bypass_rls', true) = 'true' OR org_id = …`**                 |
| **22** | **SELECT**              | **`current_setting('app.bypass_rls', true) = 'true'`**                               |
| 7      | ALL                     | `(org_id IS NULL) OR (org_id = …)`                                                   |
| 1      | ALL                     | `false` (`whistleblowing_audit_log`)                                                 |
| 1      | SELECT                  | `current_setting('app.current_user_role', true) = ANY(…)` _(kein Mandantenprädikat)_ |

**Falsch-Positiv-Prüfung „USING ohne WITH CHECK":** 427 Policies haben `with_check IS NULL`. Für `FOR ALL` und `FOR UPDATE` verwendet PostgreSQL in diesem Fall den `USING`-Ausdruck **auch** als `WITH CHECK` (PostgreSQL-Doku `CREATE POLICY`). Die Prüfung ergab außerdem **0 INSERT-Policies ohne `WITH CHECK`**:

```sql
SELECT tablename FROM pg_policies WHERE cmd='INSERT' AND with_check IS NULL;  -- (0 rows)
```

→ **Kein Finding.** Die verbreitete „USING ohne WITH CHECK"-Klasse trifft hier nicht zu.

Alle Policies sind `PERMISSIVE` und `TO PUBLIC` — es gibt **keine einzige RESTRICTIVE Policy**, d.h. jede zusätzliche Policy kann nur _erweitern_, nie einschränken. Das ist der Grund, warum `wb_audit_log_no_direct_write` (`USING false`) den offenen Lese-Pfad auf `whistleblowing_audit_log` nicht neutralisiert (`S01-17`).

### 2.4 Schritt 4 — Läuft die Runtime als `grc_app`?

`packages/db/src/index.ts:161-162`:

```ts
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
```

Kein Startup-Check, keine Assertion gegen `rolsuper`/`rolbypassrls`. → `S01-10`.
`docker-compose.production.yml:212` setzt `APP_DATABASE_URL` mit `${GRC_APP_PASSWORD:-}` (Default leer, keine `:?`-Pflichtprüfung wie bei `DB_PASSWORD`/`AUTH_SECRET`) → `S01-11`.
`docker-compose.production.yml:301-311`: der Worker setzt `APP_DATABASE_URL` **bewusst nicht** → 132 Worker-Dateien laufen als Superuser ohne RLS → `S01-09`.

### 2.5 Schritt 5 — `org_id`-Setzung und Pooling

`packages/db/src/request-context.ts:174-180` setzt die GUCs mit `is_local = false` (**Session-Level**, nicht transaktionslokal) auf einer per `requestClient.reserve()` exklusiv reservierten Verbindung; `releaseRequestContext` (Z. 238-247) scrubbt sie auf `''`. Zwei getrennte Pools (`client` max 10, `requestClient` max 25, `index.ts:171-207`) verhindern, dass eine auf `''` gescrubbte Verbindung in den kontextlosen Basis-Pool zurückfällt.

**Empirische Prüfung des Fehlermodus** (`evidence/S01_failmode_probe.txt`):

```
-- frische Verbindung, GUC nie gesetzt
SELECT count(*) FROM module_config;   -->  0      (fail-closed, kein Fehler)
SELECT count(*) FROM risk;            -->  0
SET app.current_org_id = '';
SELECT count(*) FROM risk;            --> ERROR: invalid input syntax for type uuid: ""
SELECT count(*) FROM module_config;   --> ERROR: invalid input syntax for type uuid: ""
```

→ Kein Leck über Pooling; der GUC wird bei jedem `reserve()` neu gesetzt. Aber: 373 Tabellen haben Policies ohne `NULLIF`-Guard, die bei `''` **hart fehlschlagen** (159 davon zusätzlich ohne `missing_ok`). Die gesamte Zwei-Pool-Konstruktion existiert nur, um diesen Defekt zu umschiffen → `S01-18`.

**Org-Kontext-Herkunft:** `packages/auth/src/context.ts:19-41` — `getCurrentOrgId` liest das Cookie `arctos-org-id` und **validiert es gegen `session.user.roles`**. Ein manipuliertes Cookie auf eine fremde Org wird verworfen. → **Kompensierende Kontrolle greift, kein Finding**; Restrisiko nur bei stale JWT (`S01-22`).
Kein Codepfad übernimmt eine `orgId` aus Query/Header in den RLS-Kontext (geprüft: nur `auth/sso/*`-Pre-Login-Routen lesen `?orgId`, ohne den Kontext zu setzen).

### 2.6 Schritt 6 — Praktischer Cross-Tenant-Gegenbeweis (Pflichtteil)

**Seed** (`evidence/S01_seed_two_orgs.sql`): zwei Orgs `A = aaaaaaaa-…-0001`, `B = bbbbbbbb-…-0002`; anschließend generisch je eine Zeile pro Org in **jeder** Tabelle mit `org_id` (Typ-getriebene Wertegenerierung, `session_replication_role='replica'` um FKs/Trigger zu überspringen):

```
 ok | count
----+-------
 t  |   878
 f  |    30     (CHECK-Constraints / Spezialtypen, s. _s01_seed_result)
```

454 Tabellen mit `org_id` wurden angefasst; für **445** davon konnte mindestens eine Zeile je Org angelegt werden (`SELECT count(DISTINCT tbl) FROM _s01_seed_result WHERE ok` → 445). Genau diese 445 gingen in den Isolationstest.

**Test** (`evidence/S01_crosstenant_test.sql`), als Nicht-Superuser mit `app.current_org_id = A`, pro Tabelle SELECT/UPDATE/DELETE auf Zeilen mit `org_id = B`:

```
 check_kind | result | count
------------+--------+-------
 SELECT     | OK     |   443
 SELECT     | LEAK   |     2      <- access_log, audit_log
 UPDATE     | OK     |   444
 UPDATE     | LEAK   |     1      <- audit_log
 DELETE     | OK     |   445
```

Detail:

```
access_log | SELECT | foreign=1 own=1
audit_log  | SELECT | foreign=1 own=1
audit_log  | UPDATE | rows=1
```

**Zusatztests** (jeweils mit Ausgabe in `/work/audit/evidence/`):

- `S01_view_leak_probe.txt` — View/Matview-Umgehung:
  ```
  grc_budget direct          | foreign_rows 0 | total 1
  v_budget_usage VIEW        | foreign_rows 1 | total 2
  copilot_usage_stats MV     | foreign_rows 1 | total 2
  evidence_review_summary MV | foreign_rows 1 | total 2
  ```
- `S01_child_table_probe.txt` — 13 Kindtabellen ohne `org_id` zeigen im Org-A-Kontext Zeilen **beider** Orgs; `DELETE FROM approval_decision` löscht als Mandant A `DELETE 2` (beide Mandanten).
- `S01_bypass_rls_probe.txt` — `SET app.bypass_rls='true'`: `risk` 1→2 sichtbare Zeilen, `document` 1→2, `organization` 2, `user_organization_role` 2; `DELETE 1` auf eine Fremd-Org-Zeile in `risk`, `UPDATE 1` auf eine Fremd-Org-Zeile in `evidence`.
- `S01_nullorg_probe.txt` — Mandant A legt in `regulatory_source` eine Zeile mit `org_id = NULL` an; Mandant B liest, ändert (`UPDATE 1`) und löscht sie (`DELETE 1`).
- `S01_user_table_probe.txt` — `user`, `session`, `account` ohne RLS vollständig sichtbar.

### 2.7 Prüfung der eingebauten Kontrollen (Falsch-Positiv-Abgrenzung)

| Kontrolle                                                       | Datei                                                                                                                                                                                                              | Greift?                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Org-Cookie-Validierung gegen JWT-Rollen                         | `packages/auth/src/context.ts:31`                                                                                                                                                                                  | **ja** — Cookie-Manipulation wirkungslos                                                          |
| Append-only-RULES auf Log-Tabellen                              | `0000_lethal_scorpion.sql:185-188`, `audit_log_no_delete`                                                                                                                                                          | **teilweise** — verhindert DELETE, nicht SELECT                                                   |
| `audit_log_tombstone_guard` (BEFORE UPDATE)                     | DB-Trigger                                                                                                                                                                                                         | **teilweise** — erlaubte den No-op-UPDATE im Test                                                 |
| Handgeschriebene `WHERE org_id = ctx.orgId` in Audit-Log-Routen | `audit-log/route.ts:68-71`, `archive:104`, `integrity:235`, `continuity:102`, `access-log:22`, `risks/[id]/history:32`, `controls/[id]/history:32`, `dpms/audit-log-tombstone:68`, `processes/[id]/audit-trail:44` | **ja** — alle geprüften Lesepfade filtern                                                         |
| `WHERE org_id = ctx.orgId` vor View-Zugriff                     | `budget/usage/route.ts:15-18`                                                                                                                                                                                      | **ja** — Downgrade `S01-08` auf High statt Critical                                               |
| Eltern-Org-Prüfung vor Kindtabellen-Query                       | `dashboards/[id]/widgets/[widgetId]:24-34`, `admin/roles/[id]:15-19`, `onboarding/[sessionId]/steps/…:24-36`, alle `esg/materiality/*`                                                                             | **ja** — außer `erm/bowtie/[riskId]` (`S01-01`)                                                   |
| `SET app.current_user_role` (Voraussetzung für die WB-Policy)   | nirgends im TS-Code gesetzt                                                                                                                                                                                        | **ja, aktuell fail-closed** → `S01-17` bleibt latent, Medium                                      |
| Ratchet gegen kontextlose Routen                                | `scripts/check-route-rls-context.mjs` → `✓ 115 known-unwrapped, 0 new`                                                                                                                                             | **teilweise** — nur fail-closed für org_id-Tabellen                                               |
| Kann `grc_app` Objekte in `public` anlegen?                     | `nspacl = {pg_database_owner=UC/…,=U/…}` → PUBLIC hat nur `USAGE`                                                                                                                                                  | **ja** — entschärft die fehlende `search_path`-Fixierung der `SECURITY DEFINER`-Funktionen zu Low |

**Verworfene Finding-Kandidaten:**

- „`FOR ALL`-Policies ohne `WITH CHECK` erlauben ungeprüfte Schreibvorgänge" — falsch, PostgreSQL nutzt `USING` als `WITH CHECK` (verifiziert: alle 445 UPDATE/DELETE-Tests OK).
- „Session-Level-GUCs lecken über Connection-Pooling" — falsch, jeder `reserve()` setzt alle GUCs neu; Basis- und Request-Pool sind getrennt (verifiziert per Fehlermodus-Probe).
- „`org_id`-Index fehlt und macht RLS zum Seq Scan" — nur 3 von 455 Tabellen ohne führenden `org_id`-Index; gehört zu S09.
- „Cookie-Manipulation erlaubt Org-Wechsel" — durch `accessibleOrgIds`-Prüfung abgedeckt.

---

## 3. Tabellenmatrix

Vollständig als CSV: **`/work/audit/evidence/S01_table_matrix.csv`** (538 Zeilen; Spalten: `tabelle, org_id, rls, force_rls, policies, using_expr, with_check_expr, testergebnis`).
Weitere Rohdaten:

| Datei                                                                                                                                                             | Inhalt                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `S01_policies.csv`                                                                                                                                                | alle 2.262 Policies mit `cmd`, `USING`, `WITH CHECK`, Rollen         |
| `S01_orgid_no_rls.txt`                                                                                                                                            | 3 Tabellen mit `org_id` ohne RLS                                     |
| `S01_no_orgid_no_rls.txt`                                                                                                                                         | 64 Tabellen ohne `org_id` ohne RLS                                   |
| `S01_no_orgid_children.csv`                                                                                                                                       | 49 FK-Kanten dieser Tabellen, Spalte `parent_is_org_scoped`          |
| `S01_rls_no_force.txt` / `S01_rls_no_policy.txt`                                                                                                                  | FORCE- bzw. Policy-Lücken                                            |
| `S01_bypass_rls_policies.txt`                                                                                                                                     | 55 Policies mit `app.bypass_rls`                                     |
| `S01_no_with_check.txt`                                                                                                                                           | 427 Policies ohne expliziten `WITH CHECK` (Prüfergebnis: unkritisch) |
| `S01_crosstenant_test.sql`, `S01_seed_two_orgs.sql`, `S01_seed_children.sql`                                                                                      | reproduzierende Skripte                                              |
| `S01_view_leak_probe.txt`, `S01_child_table_probe.txt`, `S01_bypass_rls_probe.txt`, `S01_nullorg_probe.txt`, `S01_user_table_probe.txt`, `S01_failmode_probe.txt` | Ausgaben der Gegenbeweise                                            |

**Auszug — die relevanten Zeilen:**

| Tabelle                                                                                                                                                                                                                                                                                                      | org_id | RLS      | FORCE    | Policies | USING                             | WITH CHECK       | Testergebnis                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------- | -------- | -------- | --------------------------------- | ---------------- | ------------------------------------------------------------------- |
| `audit_log`                                                                                                                                                                                                                                                                                                  | ja     | **nein** | nein     | 0        | –                                 | –                | **SELECT=LEAK (foreign=1), UPDATE=LEAK (rows=1)**, DELETE OK (RULE) |
| `access_log`                                                                                                                                                                                                                                                                                                 | ja     | **nein** | nein     | 0        | –                                 | –                | **SELECT=LEAK (foreign=1)**, UPDATE/DELETE OK (RULE)                |
| `audit_anchor`                                                                                                                                                                                                                                                                                               | ja     | **nein** | nein     | 0        | –                                 | –                | nicht seedbar (CHECK), DB-seitig ungeschützt                        |
| `user`                                                                                                                                                                                                                                                                                                       | nein   | **nein** | nein     | 0        | –                                 | –                | **alle Nutzer aller Mandanten sichtbar**                            |
| `session` / `account` / `verification_token`                                                                                                                                                                                                                                                                 | nein   | **nein** | nein     | 0        | –                                 | –                | Session-/OAuth-Token global sichtbar                                |
| `bowtie_path`                                                                                                                                                                                                                                                                                                | nein   | **nein** | nein     | 0        | –                                 | –                | **6 Zeilen beider Orgs sichtbar**                                   |
| `approval_decision`                                                                                                                                                                                                                                                                                          | nein   | **nein** | nein     | 0        | –                                 | –                | **2 Zeilen sichtbar, `DELETE 2`**                                   |
| `attestation_response`, `review_decision`, `dd_response`, `dd_evidence`, `wb_anonymous_mailbox`, `architecture_change_vote`, `esg_materiality_topic`, `custom_dashboard_widget`, `connector_field_mapping`, `onboarding_step`, `playbook_phase`, `questionnaire_section`, `api_key_scope`, `role_permission` | nein   | **nein** | nein     | 0        | –                                 | –                | **cross-tenant sichtbar**                                           |
| `organization`                                                                                                                                                                                                                                                                                               | (id)   | ja       | **nein** | 2        | `bypass_rls OR id = current_org`  | –                | OK, aber `bypass_rls`                                               |
| `user_organization_role`                                                                                                                                                                                                                                                                                     | ja     | ja       | ja       | 6        | u.a. `bypass_rls OR org_id = …`   | NULLIF-Form      | OK, aber `bypass_rls`                                               |
| `risk`, `control`, `document`, `evidence`, `finding`, `asset`, `work_item`, `kri`, … (33)                                                                                                                                                                                                                    | ja     | ja       | ja       | je 1–2   | `bypass_rls OR org_id = …`        | = USING          | OK **ohne** bypass, **LEAK mit** bypass                             |
| `regulatory_source`, `copilot_prompt_template`, `emission_factor`, `automation_rule_template`, `eam_ai_prompt_template`, `horizon_scan_source`, `audit_analytics_template`                                                                                                                                   | ja     | ja       | ja       | 1        | `org_id IS NULL OR org_id = …`    | = USING          | **globale Zeilen mandantenübergreifend schreibbar**                 |
| `notification_preference`                                                                                                                                                                                                                                                                                    | nein   | ja       | **nein** | **0**    | –                                 | –                | deny-all (Funktionsdefekt)                                          |
| `whistleblowing_audit_log`                                                                                                                                                                                                                                                                                   | ja     | ja       | **nein** | 2        | Rollenname, **kein org-Prädikat** | `false`          | fail-closed (GUC nie gesetzt)                                       |
| `v_budget_usage` (VIEW)                                                                                                                                                                                                                                                                                      | –      | n/a      | n/a      | –        | –                                 | –                | **foreign_rows = 1**                                                |
| `copilot_usage_stats`, `evidence_review_summary` (MATVIEW)                                                                                                                                                                                                                                                   | –      | n/a      | n/a      | –        | –                                 | –                | **foreign_rows = 1**                                                |
| übrige 443 Tabellen mit `org_id`                                                                                                                                                                                                                                                                             | ja     | ja       | ja       | 1–5      | org_id-Vergleich                  | = USING / NULLIF | **SELECT/UPDATE/DELETE alle OK**                                    |

---

## 4. Findings

### S01-01 — Critical — Cross-Tenant-IDOR: `bowtie_path` ohne `org_id`, ohne RLS, ohne Org-Prüfung in der Route

**Datei:** `apps/web/src/app/api/v1/erm/bowtie/[riskId]/route.ts:30-34` (Lesen), `:61` (Löschen), `:87` (Schreiben)
**Schema:** `packages/db/src/schema/erm-advanced.ts:70-86`

```ts
// GET — Zeile 30-34
    db
      .select()
      .from(bowtiePath)
      .where(eq(bowtiePath.riskId, riskId))
      .orderBy(bowtiePath.sortOrder),
```

```ts
// PUT — Zeile 61
await tx.delete(bowtiePath).where(eq(bowtiePath.riskId, riskId));
```

```ts
// PUT — Zeile 87
await tx.insert(bowtiePath).values({ riskId, ...path });
```

Die Geschwistertabelle `bowtieElement` wird in derselben Datei korrekt mit `eq(bowtieElement.orgId, ctx.orgId)` gefiltert (Z. 26, 67) — `bowtie_path` hat aber gar keine `org_id`-Spalte:

```ts
export const bowtiePath = pgTable("bowtie_path", {
  id: uuid("id").primaryKey().defaultRandom(),
  riskId: uuid("risk_id").notNull().references(() => risk.id, …),
  sourceElementId: …, targetElementId: …, barrierIds: …, sortOrder: …
},  (table) => [index("bp_risk_idx").on(table.riskId)]);
```

**Szenario (Eingabe → Wirkung):**

1. Angreifer ist ein beliebiger authentifizierter Nutzer von Mandant A mit aktivem ERM-Modul; für den PUT zusätzlich Rolle `admin` oder `risk_manager`.
2. `GET /api/v1/erm/bowtie/<UUID eines Risikos von Mandant B>` → `elements: []` (org-gefiltert), aber `paths: [ … ]` mit den Bowtie-Pfaden von Mandant B (Ursache-Wirkungs-Ketten, Barrieren-IDs, Reihenfolge). **Cross-Tenant-Read.**
3. `PUT` auf dieselbe URL mit leerem Body-Array → Zeile 61 löscht **alle** `bowtie_path`-Zeilen des fremden Risikos. Zeile 87 fügt anschließend Pfade mit fremder `riskId` ein. **Cross-Tenant-Destruktion und -Injektion.**

**DB-Beleg** (`evidence/S01_child_table_probe.txt`, Rolle `s01_audit_app`, `app.current_org_id = Org A`):

```
 t           | count
 bowtie_path |     6      -- 3 Zeilen Org A + 3 Zeilen Org B
```

und für die gleiche Tabellenklasse:

```
BEGIN
DELETE FROM approval_decision;   --> DELETE 2   (beide Mandanten)
```

**Kompensierende Kontrolle:** keine. Weder RLS (Tabelle hat keine), noch eine Org-Prüfung auf `risk`, noch `requireModule` (prüft nur das Modul der _eigenen_ Org). Alle anderen geprüften Kindtabellen-Routen führen vorher einen org-skalierten Eltern-Lookup durch — diese nicht.

**Severity-Begründung:** Rubrik „Critical = Cross-Tenant-Datenzugriff". Es ist der einzige gefundene Pfad, der ohne DB-Zugriff, ohne SQL-Injection und ohne Superuser-Fehlkonfiguration allein über die produktive HTTP-API Fremdmandantendaten liest **und** unwiederbringlich löscht. Einzige Hürde ist die Kenntnis einer fremden Risiko-UUID — das ist keine Autorisierungskontrolle.

---

### S01-02 — High — Globaler RLS-Escape-Hatch `app.bypass_rls` in 55 Policies auf 33 Tabellen

**Datei:** `packages/db/drizzle/0000_lethal_scorpion.sql:193, 202-227`; fortgeführt in `0005_nostalgic_smiling_tiger.sql:261-273`, `0006`, `0010`, `0011_flimsy_lifeguard.sql:363-369`, `0021`
**Nutzung im Code:** `packages/db/src/seed-control.ts:16`, `packages/db/src/seed-risk.ts:277`

```sql
-- 0000_lethal_scorpion.sql:193
-- Bypass: SET LOCAL app.bypass_rls = 'true' for group admin aggregation.

-- 0000_lethal_scorpion.sql:202-206
CREATE POLICY org_isolation_select ON "organization"
  FOR SELECT USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR id = current_setting('app.current_org_id', true)::uuid
  );
```

```ts
// packages/db/src/seed-control.ts:16
await db.execute(sql`SET app.bypass_rls = 'true'`);
```

Betroffen sind die Kerntabellen des Produkts: `risk`, `control`, `control_test`, `control_test_campaign`, `control_effectiveness_score`, `document`, `document_version`, `document_entity_link`, `evidence`, `finding`, `finding_sla_config`, `asset`, `asset_cia_profile`, `work_item`, `work_item_link`, `kri`, `kri_measurement`, `risk_appetite`, `risk_asset`, `risk_control`, `risk_treatment`, `risk_framework_mapping`, `process_comment`, `process_risk`, `process_step_risk`, `process_review_schedule`, `acknowledgment`, `ai_prompt_log`, `executive_kpi_snapshot`, `regulatory_relevance_score`, `simulation_result`, `organization`, `user_organization_role` (vollständig: `evidence/S01_bypass_rls_policies.txt`).

**Szenario (Eingabe → Wirkung):** `app.bypass_rls` ist ein benutzerdefinierter GUC ohne Rechteschutz — **jede** Datenbankrolle darf ihn setzen, auch die absichtlich unprivilegierte `grc_app`. Jeder Codepfad oder jede SQL-Injection, die ein `SET`/`set_config` absetzen kann, hebt die Mandantentrennung auf 33 Kerntabellen vollständig auf. Da 26 davon `FOR ALL`-Policies sind (USING wird als WITH CHECK wiederverwendet), betrifft das Lesen **und** Schreiben.

**Nachweis** (`evidence/S01_bypass_rls_probe.txt`, Rolle ohne BYPASSRLS, `app.current_org_id = Org A`):

```
 risk  (bypass OFF) | visible 1 | foreign_rows 0
SET app.bypass_rls = 'true';
 risk  (bypass ON)  | visible 2 | foreign_rows 1
 document (bypass ON)                | visible 2 | foreign_rows 1
 organization (bypass ON)            | visible 2
 user_organization_role (bypass ON)  | visible 2
DELETE FROM risk WHERE org_id='bbbb…0002';        --> DELETE 1
UPDATE evidence SET description=… WHERE org_id='bbbb…0002';  --> UPDATE 1
```

**Kompensierende Kontrolle:** Der Kommentar in `0000` verspricht `SET LOCAL`; die beiden tatsächlichen Nutzungsstellen sind Seed-Skripte (`seed-control.ts` nutzt sogar `SET` statt `SET LOCAL`, also sitzungsweit — siehe `S01-24`), die in eigenen Prozessen mit eigenem Client laufen. **Kein Runtime-Pfad der Web-App setzt den GUC** (geprüft per Volltextsuche über `apps/**`, `packages/**`). Der Escape-Hatch ist damit heute nicht direkt erreichbar — er ist aber ein permanenter Verstärker: er verwandelt jede SQL-Injection (S04) und jeden versehentlichen `SET` von einer lokalen in eine mandantenübergreifende Kompromittierung.

**Severity-Begründung:** High statt Critical, weil derzeit kein produktiver Pfad den GUC setzt. Kein Downgrade auf Medium, weil die Kontrolle als _einziger_ Schutz von 33 Kerntabellen bewusst aushebelbar konstruiert ist und alle Policies `PERMISSIVE` sind (keine RESTRICTIVE Policy kann gegenhalten).

---

### S01-03 — High — 18 mandantenbezogene Kindtabellen ohne `org_id` und ohne RLS

**Dateien:** u. a. `packages/db/src/schema/approval-workflow.ts:76` (`approval_decision`), `:122` (`review_decision`), `:163` (`attestation_response`); `packages/db/src/schema/whistleblowing.ts:190` (`wb_anonymous_mailbox`); `packages/db/src/schema/supplier-portal.ts:205` (`dd_response`); `packages/db/src/schema/platform.ts:654` (`role_permission`); `packages/db/src/schema/erm-advanced.ts:70` (`bowtie_path`)
**Vollständige Liste:** `evidence/S01_no_orgid_children.csv` (Spalte `parent_is_org_scoped = t`)

```ts
// packages/db/src/schema/approval-workflow.ts:76
export const approvalDecision = pgTable("approval_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => approvalRequest.id, …),
  …
});   // <- keine org_id, keine RLS
```

Betroffen: `approval_decision`, `review_decision`, `attestation_response`, `dd_response`, `dd_evidence`, `wb_anonymous_mailbox`, `bowtie_path`, `architecture_change_vote`, `esg_materiality_topic` (+ transitiv `esg_materiality_vote`), `custom_dashboard_widget`, `connector_field_mapping`, `onboarding_step`, `playbook_phase` (+ `playbook_task_template`), `questionnaire_section` (+ `questionnaire_question`), `api_key_scope`, `role_permission`.

**Szenario (Eingabe → Wirkung):** Diese Tabellen halten Freigabeentscheidungen (SoD-relevant), Attestierungsantworten, Lieferanten-Due-Diligence-Antworten samt Nachweisen, den anonymen Hinweisgeber-Postkasten, die Rechtematrix eigener Rollen und API-Key-Scopes. Sie sind auf DB-Ebene für **jede** Mandanten-Session vollständig les-, änder- und löschbar. Der Schutz besteht ausschließlich darin, dass jede einzelne Route vorher die org-skalierte Elterntabelle abfragt.

**Nachweis** (`evidence/S01_child_table_probe.txt`, Kontext = Org A, je 1 Zeile pro Org geseedet):

```
 approval_decision        | 2
 architecture_change_vote | 2
 attestation_response     | 2
 bowtie_path              | 6
 connector_field_mapping  | 2
 custom_dashboard_widget  | 2
 esg_materiality_topic    | 2
 onboarding_step          | 2
 playbook_phase           | 2
 questionnaire_section    | 2
 review_decision          | 2
```

Ground truth (Superuser): `approval_decision` je 1 Zeile pro Org. Schreibseite:

```
BEGIN; DELETE FROM approval_decision;  --> DELETE 2 ; after_delete = 0 ; ROLLBACK
```

**Kompensierende Kontrolle:** Für 17 der 18 Tabellen greift ein handgeschriebener Eltern-Lookup (verifiziert an `dashboards/[id]/widgets/[widgetId]/route.ts:24-34`, `admin/roles/[id]/route.ts:15-19`, `onboarding/[sessionId]/steps/[stepNumber]/route.ts:24-36`, allen `esg/materiality/*`-Routen, `dd-sessions/[id]/results/route.ts`). Für `bowtie_path` greift sie nicht → `S01-01`. Die Portal-Routen (`portal/dd/[token]`, `portal/mailbox/[token]`) autorisieren über Token statt Org — Bewertung gehört zu S02/S06.

**Severity-Begründung:** High. Die Isolation dieser Daten hängt an 1:1-Codereview statt an einer erzwungenen DB-Kontrolle; ein einziger vergessener Eltern-Lookup ist ein Cross-Tenant-Leck — genau das ist mit `S01-01` bereits eingetreten. Kein Critical, weil die Mehrheit der Routen die Prüfung tatsächlich enthält.

---

### S01-04 — High — Auth-Kerntabellen `user`, `session`, `account`, `verification_token` ohne RLS

**Datei:** `packages/db/src/schema/platform.ts:224` (`user`), `:578` (`account`), `:601` (`session`)
**DB-Beleg:**

```
 relname            | rls | force | pols
 account            | f   | f     |    0
 session            | f   | f     |    0
 user               | f   | f     |    0
 verification_token | f   | f     |    0
```

`user` führt u. a.:

```
password_hash  character varying(255)
ical_token     character varying(128)    -- Bearer-artiges Kalender-Token, UNIQUE-Index
email, name, last_login_at, external_id, identity_provider
```

`session` führt `session_token varchar(255) UNIQUE`, `account` führt `refresh_token`, `access_token`, `id_token`.

**Szenario (Eingabe → Wirkung):** Jede beliebige Query der Runtime-Rolle auf `user`/`session`/`account`, die nicht explizit über `user_organization_role` joint, liefert das globale Nutzerverzeichnis **aller** Mandanten inklusive Passwort-Hashes und Sitzungstoken. Nachweis (`evidence/S01_user_table_probe.txt`, Kontext = Org A):

```
 tbl  | visible_rows
 user |            2      -- Nutzer beider Orgs, inkl. password_hash-Spalte
```

**Kompensierende Kontrolle:** `GET /api/v1/users` (`apps/web/src/app/api/v1/users/route.ts:40-58`) joint korrekt auf `user_organization_role` und gibt `password_hash`/`ical_token` nie zurück. `GET /api/v1/users/:id` tut das **nicht** → `S01-05`. Für `session`/`account` wurde kein produktiver Leseweg gefunden (nur Auth.js-intern).

**Severity-Begründung:** High. `docs/security/rls-coverage-report.md` behauptet für `session`/`account`/`verification_token` explizit „RLS ✅ Policy ✅" (siehe `S01-14`) — die Schutzannahme im Betrieb ist also falsch. Kein Critical, weil kein Endpunkt gefunden wurde, der Hashes oder Token ausliefert.

---

### S01-05 — High — `GET /api/v1/users/:id` ohne Mitgliedschaftsprüfung → Cross-Tenant-PII

**Datei:** `apps/web/src/app/api/v1/users/[id]/route.ts:26-37`

```ts
const [found] = await db
  .select({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    language: user.language,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  })
  .from(user)
  .where(and(eq(user.id, id), isNull(user.deletedAt)));

if (!found) return Response.json({ error: "Not found" }, { status: 404 });
```

Die Autorisierung davor (Z. 17-24) prüft nur, ob der Aufrufer **in seiner eigenen Org** Admin ist — nicht, ob der angefragte Nutzer dieser Org angehört. Die anschließende `roles`-Query (Z. 42-57) ist korrekt org-gefiltert, aber der Nutzerdatensatz selbst wurde da schon gelesen.

**Szenario (Eingabe → Wirkung):** Admin von Mandant A ruft `GET /api/v1/users/<UUID eines Nutzers von Mandant B>` auf → HTTP 200 mit `email`, `name`, `avatarUrl`, `isActive`, `lastLoginAt` des fremden Nutzers (`roles: []`). Da `user` keine RLS trägt (`S01-04`), fängt die Datenbank das nicht ab.

**Kompensierende Kontrolle:** keine. Weder RLS noch ein `user_organization_role`-Join. Einzige Hürde ist die Kenntnis der Ziel-UUID.

**Severity-Begründung:** High. Personenbezogene Daten über Mandantengrenzen (DSGVO-relevant, Art. 32). Nicht Critical, weil eine gültige fremde Nutzer-UUID nötig ist und ausschließlich Metadaten zurückkommen, keine Hashes.

---

### S01-06 — High — `audit_log`, `access_log`, `audit_anchor`: RLS bewusst deaktiviert, Cross-Tenant-Lesen praktisch nachgewiesen

**Datei:** `packages/db/drizzle/0379_logtables_rls_exception.sql:53-88`; Whitelist `packages/db/src/rls-audit.ts:82-98`

```sql
-- 0379_logtables_rls_exception.sql:57-63
  log_tables text[] := ARRAY[
    'audit_log', 'access_log', 'data_export_log', 'notification', 'audit_anchor'
  ];
-- :79
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
-- :84-85
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', tbl);
```

```ts
// packages/db/src/rls-audit.ts:82-92
export const TENANT_TABLE_RLS_EXCEPTIONS = new Set<string>([
  "access_log",
  "audit_log",
  "audit_anchor",
]);
```

**Szenario (Eingabe → Wirkung):** `audit_log` enthält je Änderung `changes` (Vorher-/Nachher-JSON des Geschäftsobjekts), `user_email`, `user_name`, `ip_address`, `metadata.reason` — für **alle** Mandanten in einer Tabelle. Jede Query der Runtime-Rolle ohne `WHERE org_id = …` liefert den vollständigen Audit-Trail aller Mandanten.

**Nachweis** (Pflichttest aus 2.6, Rolle `s01_audit_app`, Kontext = Org A):

```
access_log | SELECT | LEAK | foreign=1 own=1
audit_log  | SELECT | LEAK | foreign=1 own=1
audit_log  | UPDATE | LEAK | rows=1
```

**Kompensierende Kontrollen (geprüft, greifen):**

- Alle produktiven Lesepfade filtern: `audit-log/route.ts:68-71` (`eq/inArray(auditLog.orgId, orgIdScope)`), `audit-log/archive/route.ts:104`, `audit-log/integrity/route.ts:173-174` + `:235` (`previous_hash_scope = 'org:'||orgId`), `audit-log/integrity/continuity/route.ts:61-62` + `:102` + `:223`, `access-log/route.ts:22`, `risks/[id]/history/route.ts:32`, `controls/[id]/history/route.ts:32`, `dpms/audit-log-tombstone/route.ts:68`, `processes/[id]/audit-trail/route.ts:44`.
- Append-only-RULES verhindern DELETE (`audit_log_no_delete`) und UPDATE/DELETE auf `access_log`; der `audit_log_tombstone_guard`-Trigger begrenzt UPDATEs. Der im Test erfolgreiche `UPDATE … SET org_id = org_id` war ein No-op, den der Guard passieren ließ — die Zeile blieb inhaltlich unverändert.
- `data_export_log` und `notification` wurden durch Migration `0381` wieder unter RLS gestellt (verifiziert: beide `rls=t, force=t`).

**Severity-Begründung:** High. Die zentrale Compliance-Zusage des Produkts (unveränderlicher, mandantengetrennter Audit-Trail) ruht auf 9 handgeschriebenen `WHERE`-Klauseln statt auf einer erzwungenen DB-Kontrolle; eine davon zu vergessen bedeutet Offenlegung des Audit-Trails aller Kunden. Kein Critical, weil aktuell keine dieser Klauseln fehlt. Die zugrunde liegende Begründung (org-loses INSERT beim Login) rechtfertigt allenfalls eine permissive **INSERT**-Policy — nicht das Abschalten der Lese-Isolation; `0381` zeigt für `notification`/`data_export_log`, dass die getrennte Policy-Form („permissive INSERT + org-scoped SELECT/UPDATE/DELETE") funktioniert.

---

### S01-07 — High — 7 Policies mit `org_id IS NULL`-Klausel erlauben mandantenübergreifende „globale" Zeilen

**Dateien:** `packages/db/drizzle/0199_create_regulatory_source.sql` (`regulatory_source`), `0188_create_copilot_prompt_template.sql` (`copilot_prompt_template`), `0229_create_horizon_scan_item.sql` (`horizon_scan_source`), `0045_sprint33_…` (`audit_analytics_template`), `0040_sprint28_workflow_automation.sql` (`automation_rule_template`), `0063_sprint51_eam_ai.sql` (`eam_ai_prompt_template`), ESG-Migration (`emission_factor`)

```
regulatory_source        | regulatory_source_org_isolation | ALL |
  ((org_id IS NULL) OR (org_id = (current_setting('app.current_org_id'))::uuid))
copilot_prompt_template  | copilot_prompt_template_org_isolation | ALL | (dito)
emission_factor          | emission_factor_access | ALL | (dito)
automation_rule_template | automation_rule_template_org_isolation | ALL |
  ((org_id IS NULL) OR ((org_id)::text = current_setting('app.current_org_id', true)))
eam_ai_prompt_template, horizon_scan_source, audit_analytics_template | (dito)
```

Da bei `FOR ALL` der `USING`-Ausdruck auch als `WITH CHECK` gilt, ist `org_id = NULL` **schreibbar** — nicht nur lesbar.

**Szenario (Eingabe → Wirkung):**

1. Mandant A schreibt eine Zeile mit `org_id = NULL` (z. B. eine `regulatory_source` mit einer von ihm kontrollierten Feed-URL, oder ein `copilot_prompt_template` mit eingebetteten Instruktionen).
2. Mandant B sieht diese Zeile als „Plattform-Vorgabe" und kann sie zusätzlich **ändern und löschen**.
3. Wirkung je Tabelle: `regulatory_source` → der Regulatory-Feed-Worker holt die URL ab (Poisoning/SSRF-Kette, s. S04/S10); `copilot_prompt_template` → mandantenübergreifende Prompt-Injection (s. S05); `emission_factor` → Manipulation der ESG-Kennzahlen aller Mandanten; `automation_rule_template` → Einschleusen von Automatisierungsregeln.

**Nachweis** (`evidence/S01_nullorg_probe.txt`):

```
-- Kontext Org A
INSERT INTO regulatory_source (org_id, name, source_type, url, jurisdiction)
VALUES (NULL,'S01-GLOBAL-POISON','rss','http://evil.example/feed','EU');
 id 6ef8450d-… | org_id (leer) | S01-GLOBAL-POISON

-- Kontext Org B
SELECT … WHERE name='S01-GLOBAL-POISON';
 6ef8450d-… | | S01-GLOBAL-POISON | http://evil.example/feed
UPDATE regulatory_source SET url='http://tenantB-tampered.example' …  --> UPDATE 1
DELETE FROM regulatory_source WHERE name='S01-GLOBAL-POISON';         --> DELETE 1
```

**Kompensierende Kontrolle (teilweise):** Die geprüften Schreibrouten überschreiben `orgId` nach dem Spread und setzen es hart auf `ctx.orgId` — `copilot/templates/route.ts:25`: `.values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })`; `PATCH`/`DELETE` in `copilot/templates/[id]/route.ts:53-58, 79-84` filtern zusätzlich auf `eq(orgId, ctx.orgId)`, sodass globale Templates über die API nicht editierbar sind. Der Schreibweg ist damit heute nicht über HTTP erreichbar; die DB erlaubt ihn aber uneingeschränkt, und `copilot/templates/[id]/route.ts:23-26` (`GET`) liest ohne jede Org-Bedingung und verlässt sich allein auf diese Policy.

**Severity-Begründung:** High. Bidirektionaler Cross-Tenant-Schreibkanal auf DB-Ebene, praktisch nachgewiesen, auf Tabellen die AI-Prompts, ESG-Faktoren und Worker-abgerufene URLs speisen. Kein Critical, weil derzeit keine HTTP-Route `org_id = NULL` schreiben lässt.

---

### S01-08 — High — Views und Materialized Views umgehen die RLS ihrer Basistabellen

**Betroffen:** `v_budget_usage`, `copilot_usage_stats` (MATVIEW), `evidence_review_summary` (MATVIEW), sowie ohne Mandantenbezug `risk_catalog_v`, `control_catalog_v`, `risk_catalog_entry_v`, `control_catalog_entry_v`, `framework_mapping_full`
**DB-Beleg:**

```
 relkind |         relname         | owner | reloptions
 v       | v_budget_usage          | grc   | (leer)      <- kein security_invoker
 m       | copilot_usage_stats     | grc   | (leer)
 m       | evidence_review_summary | grc   | (leer)
```

PostgreSQL wertet eine View ohne `security_invoker = true` mit den Rechten des **Eigentümers** aus. Eigentümer ist `grc` (SUPERUSER, umgeht RLS). Materialized Views tragen ohnehin keine RLS; ihr Inhalt entsteht beim `REFRESH` unter dem Eigentümer und ist damit mandantenübergreifend materialisiert.

**Szenario (Eingabe → Wirkung):** Eine Query der Runtime-Rolle gegen `v_budget_usage` liefert die Budget-, Kosten- und Aufwandsaggregate **aller** Mandanten (Quellen: `grc_budget`, `control`, `risk_treatment`, `dpia_measure`, `continuity_strategy`), obwohl die direkte Abfrage der Basistabellen korrekt gefiltert wird.

**Nachweis** (`evidence/S01_view_leak_probe.txt`, Kontext = Org A):

```
 grc_budget direct          | foreign_rows 0 | total 1
 v_budget_usage VIEW        | foreign_rows 1 | total 2
 copilot_usage_stats MV     | foreign_rows 1 | total 2
 evidence_review_summary MV | foreign_rows 1 | total 2

 budget_id  | org_id                               | budget_name
 b8c41083-… | aaaaaaaa-0000-4000-8000-000000000001 | S01AUDIT
 b4048bdf-… | bbbbbbbb-0000-4000-8000-000000000002 | S01AUDIT
```

**Kompensierende Kontrolle:** `apps/web/src/app/api/v1/budget/usage/route.ts:15-18` filtert manuell:

```ts
sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId} AND budget_id = ${budgetId}`;
sql`SELECT * FROM v_budget_usage WHERE org_id = ${ctx.orgId}`;
```

Die beiden Materialized Views werden im Anwendungscode gar nicht referenziert (Volltextsuche über `apps/**`, `packages/**`).

**Severity-Begründung:** High. Der Isolationsmechanismus ist für diese Objekte vollständig ausgehebelt und die eingebaute Coverage-Prüfung betrachtet ausschließlich `pg_tables` (`rls-audit.ts:102-107`), sieht Views also nie. Kein Critical, weil die einzige nutzende Route korrekt filtert.

---

### S01-09 — Medium — Worker läuft bewusst als Superuser `grc`; 132 Worker-Dateien ohne RLS

**Datei:** `docker-compose.production.yml:301-311`

```yaml
# #SEC-F01b: the worker runs cross-org SYSTEM jobs … So the worker
# deliberately connects as the PRIVILEGED superuser `grc` (BYPASSRLS) …
# Because APP_DATABASE_URL is intentionally NOT set here, packages/db
# falls back to DATABASE_URL (grc) for the worker's runtime pool.
DATABASE_URL: postgresql://grc:${DB_PASSWORD:?…}@postgres:5432/grc_platform
```

Abgesichert durch `.github/workflows/ci.yml:801-807`, das einen `APP_DATABASE_URL`-Eintrag beim Worker aktiv als Fehler wertet.

**Szenario (Eingabe → Wirkung):** Für alle Cron-/Worker-Pfade existiert keine DB-seitige Mandantentrennung. Ein fehlendes oder falsches `org_id`-Prädikat in einem der 132 Worker-Dateien schreibt oder liest ohne jede Netzsicherung mandantenübergreifend. Da die Worker u. a. Retention-Löschungen, Benachrichtigungsversand und Embedding-Sync fahren, ist die Fehlerwirkung Datenverlust bzw. -offenlegung über Mandantengrenzen.

**Kompensierende Kontrolle:** Der Worker ist nicht nutzerseitig erreichbar, sofern seine Hono-Endpunkte authentifiziert sind (`CRON_SECRET` gesetzt) — Bewertung dieser Annahme gehört zu S10.

**Severity-Begründung:** Medium. Bewusste, dokumentierte Architekturentscheidung mit nachvollziehbarem Grund (org-übergreifende Systemjobs), aber ohne Kompensation: es gibt keine Alternative wie eine dedizierte Rolle mit `BYPASSRLS` **ohne** SUPERUSER, kein `SET ROLE` je Org-Iteration und keinen Test, der Worker-Queries auf `org_id`-Prädikate prüft.

---

### S01-10 — Medium — Runtime-Rolle nur per `??`-Fallback; fehlendes `APP_DATABASE_URL` deaktiviert RLS global, ohne Warnung

**Datei:** `packages/db/src/index.ts:161-162`

```ts
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
```

**Szenario (Eingabe → Wirkung):** Fehlt `APP_DATABASE_URL` in einer Umgebung (Fehlkonfiguration, neuer Deploy-Pfad, Kubernetes-Manifest statt Compose, lokales `.env` — im Repo ist die Zeile in `.env:19` und `.env.example:19` auskommentiert), verbindet die gesamte Web-App als SUPERUSER `grc`. Superuser umgehen RLS **unabhängig von FORCE**. Sämtliche 2.262 Policies sind dann wirkungslos, und jede Route, die sich auf RLS statt auf ein explizites `WHERE org_id` verlässt (z. B. `copilot/templates/[id]/route.ts:23-26`, `users/[id]/route.ts:26-37`), wird zum Cross-Tenant-IDOR. Die App startet ohne Fehlermeldung; nichts im Code prüft `SELECT rolsuper/rolbypassrls FROM pg_roles WHERE rolname = current_user`.

**Kompensierende Kontrolle:** `.github/workflows/ci.yml:788-799` prüft nur `docker-compose.production.yml` statisch. Für jede andere Deployment-Form existiert keine Kontrolle. Kein Laufzeit-Check.

**Severity-Begründung:** Medium — „Fehlende Härtung mit Angriffsvoraussetzungen" (die Voraussetzung ist eine Fehlkonfiguration). Der Fix ist trivial (Startup-Assertion) und der Schadensfall total, deshalb nicht Low.

---

### S01-11 — Medium — `GRC_APP_PASSWORD` ohne Pflichtprüfung in `docker-compose.production.yml`

**Datei:** `docker-compose.production.yml:212`

```yaml
APP_DATABASE_URL: postgresql://grc_app:${GRC_APP_PASSWORD:-}@postgres:5432/grc_platform
```

Im Gegensatz zu jedem anderen Geheimnis derselben Datei (`DB_PASSWORD:?`, `AUTH_SECRET:?`, `WB_ENCRYPTION_KEY:?`, `CRON_SECRET:?`) wird hier `:-` (leerer Default) statt `:?` (Abbruch bei fehlender Variable) verwendet.

**Szenario (Eingabe → Wirkung):** Ist `GRC_APP_PASSWORD` nicht gesetzt, startet der Stack mit `postgresql://grc_app:@postgres:5432/…`. Je nach `pg_hba.conf`: entweder scheitert jede Verbindung (Totalausfall der Web-App, in `index.ts:210-214` nur als `console.error` sichtbar) oder — bei `trust`/`POSTGRES_HOST_AUTH_METHOD=trust`, wie in Compose-Setups verbreitet — verbindet die App mit leerem Passwort. Der Kommentar direkt darüber (`:209-211`) benennt die Gefahr, erzwingt sie aber nicht.

**Severity-Begründung:** Medium. Verfügbarkeits- bzw. Härtungsdefekt auf einem sicherheitsrelevanten Pfad, inkonsistent zur eigenen Konvention in derselben Datei.

---

### S01-12 — Medium — Grants für `grc_app` und `FORCE RLS` auf `organization` leben nur im Shell-Skript, nicht in den Migrationen

**Datei:** `deploy/provision-grc-app.sh:131-152`

```bash
GRANT USAGE ON SCHEMA public TO grc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
…
-- #SEC-F09: the organization table (tenant root) was missing FORCE RLS,
DO $$ BEGIN
  IF to_regclass('public.organization') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE organization FORCE ROW LEVEL SECURITY';
  END IF;
END $$;
```

**Nachweis, dass das in einer migrationsbasiert aufgebauten Datenbank fehlt** — die vom Audit vorgefundene, vollständig migrierte `grc_platform`:

```sql
SELECT relname, relacl FROM pg_class WHERE relname IN ('risk','organization','audit_log','user');
 user         | (leer)
 organization | (leer)
 risk         | (leer)
 audit_log    | (leer)

SELECT count(DISTINCT table_name) FROM information_schema.table_privileges
 WHERE grantee='grc_app' AND privilege_type='SELECT' AND table_schema='public';   -- 0

SELECT relforcerowsecurity FROM pg_class WHERE relname='organization';           -- f
```

```
$ PGPASSWORD=grc_app_dev_password psql -U grc_app -d grc_platform -c "select count(*) from risk;"
ERROR:  permission denied for table risk
```

**Szenario (Eingabe → Wirkung):** (a) Jede Umgebung, die nur die Migrationen fährt (CI-Test-DB, DR-Restore, neue Region, lokale Entwicklung), hat entweder keine funktionsfähige `grc_app`-Rolle — dann fällt man auf `S01-10` zurück und läuft als Superuser — oder erhält Grants nur, wenn `provision-grc-app.sh` manuell und in der richtigen Reihenfolge läuft. (b) `ALTER TABLE organization FORCE ROW LEVEL SECURITY` (der Fix zu #SEC-F09) existiert in **keiner** Migration, sodass die Mandanten-Wurzeltabelle in einer rein migrierten DB weiterhin `relforcerowsecurity = false` hat. (c) `ALTER DEFAULT PRIVILEGES FOR ROLE grc` wirkt nur für Objekte, die anschließend von der Rolle `grc` erzeugt werden — Migrationen unter anderem Rollennamen erzeugen ungegrantete Tabellen.

**Kompensierende Kontrolle:** `deploy/update-all.sh:256` und `deploy/setup-hetzner.sh:92,135` rufen das Skript vor dem Containerstart auf — aber nur auf dem dokumentierten Hetzner-Pfad.

**Severity-Begründung:** Medium. Eine sicherheitsrelevante DB-Konfiguration ist nicht Teil des versionierten, reproduzierbaren Schemas (verstärkt BASE-002). Der Beweis ist die Audit-Umgebung selbst.

---

### S01-13 — Medium — `SECURITY DEFINER`-Funktionen ohne Org-Prüfung, ohne `search_path`, mit EXECUTE an PUBLIC

**DB-Beleg:**

```
 audit_trigger                | owner=grc | acl=default | proconfig=-
 tombstone_audit_entry        | owner=grc | acl=default | proconfig=-
 whistleblowing_audit_trigger | owner=grc | acl=default | proconfig=-
```

`acl=default` bedeutet `EXECUTE` an `PUBLIC`; `proconfig=-` bedeutet **kein** `SET search_path`.

```sql
CREATE OR REPLACE FUNCTION public.tombstone_audit_entry(p_audit_log_id uuid, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_existing audit_log%ROWTYPE; …
BEGIN
  SELECT * INTO v_existing FROM audit_log WHERE id = p_audit_log_id;   -- keine org-Prüfung
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit log entry % does not exist', p_audit_log_id; END IF;
  …
  UPDATE audit_log SET
    user_email = '__tombstoned__:' || v_email_hash,
    user_name  = '__tombstoned__:' || v_name_hash,
    ip_address = NULL, changes = v_new_changes,
    pii_tombstoned_at = now(), pii_tombstone_reason = p_reason
  WHERE id = p_audit_log_id;                                            -- keine org-Prüfung
END;
$function$
```

**Szenario (Eingabe → Wirkung):** `SELECT tombstone_audit_entry('<UUID eines Audit-Eintrags von Mandant B>', 'x')` — ausgeführt mit den Rechten des Superusers `grc` — redigiert unwiederbringlich E-Mail, Name, IP und PII-Felder eines fremden Audit-Eintrags. Die Funktion prüft weder `app.current_org_id` noch die `org_id` der Zeile. Ergebnis: Mandantenübergreifende, irreversible Manipulation des Audit-Trails, ohne dass die Hash-Kette es als Bruch meldet (die Funktion ist Teil des vorgesehenen Tombstone-Pfads).

**Kompensierende Kontrolle:** `apps/web/src/app/api/v1/dpms/audit-log-tombstone/route.ts:67-68` prüft vorab:

```sql
FROM audit_log
WHERE id = ${auditLogId}::uuid AND org_id = ${ctx.orgId}::uuid
```

Die fehlende `search_path`-Fixierung ist zusätzlich entschärft, weil `grc_app` in `public` nichts anlegen darf (`nspacl` gibt PUBLIC nur `USAGE`, kein `CREATE`).

**Severity-Begründung:** Medium statt High, weil die einzige aufrufende Route korrekt filtert. Die Funktion selbst ist aber eine mandantenübergreifende Manipulationsprimitive, die jeder Rolle mit SQL-Zugang offensteht.

---

### S01-14 — Medium — `docs/security/rls-coverage-report.md` widerspricht der Datenbank

**Datei:** `docs/security/rls-coverage-report.md:32-56`, Generator `scripts/audit-rls-coverage.mjs`

Der Report behauptet:

```
### AUDIT_EXEMPT (4)
| `account`            | platform.ts | ✅ | ✅ | ❌ |
| `session`            | platform.ts | ✅ | ✅ | ❌ |
| `verification_token` | platform.ts | ✅ | ✅ | ❌ |
### PLATFORM_EXEMPT (15)
| `audit_log`          | platform.ts | ✅ | ✅ | ❌ |
| `access_log`         | platform.ts | ❌ | ❌ | ❌ |
```

Tatsächlicher Zustand (`pg_class` / `pg_policies`):

```
 account            | rls=f | force=f | pols=0
 session            | rls=f | force=f | pols=0
 verification_token | rls=f | force=f | pols=0
 audit_log          | rls=f | force=f | pols=0
```

Ursache: Der Generator liest **Migrationstexte**, nicht die Datenbank —

```
$ node scripts/audit-rls-coverage.mjs
→ Scanning migrations for RLS + audit_trigger...
  RLS enabled on 564 tables, 565 policies, 560 audit triggers
→ Summary: { OK: 555, PLATFORM_EXEMPT: 15, AUDIT_EXEMPT: 4 }
```

Migration `0379` (die RLS auf fünf Tabellen wieder abschaltet) und die 43 nicht anwendbaren Migrationen (BASE-002) werden dabei nicht berücksichtigt. Der Report zählt zudem 574 Tabellen, real existieren 527.

**Szenario (Eingabe → Wirkung):** Der Report ist das Artefakt, das Kunden, Auditoren und dem eigenen Betriebsteam die Mandantentrennung zusichert. Wer ihm folgt, hält die Session- und OAuth-Token-Tabellen für RLS-geschützt und verzichtet auf Absicherung an anderer Stelle — das ist genau die falsche Schutzannahme, die `S01-04` ausnutzbar macht.

**Severity-Begründung:** Medium — „Doku-Drift mit Fehlbedienungsrisiko" (Low) verschärft, weil es sich um die Sicherheitsdokumentation eines Compliance-Produkts handelt und der Fehler die Bewertung einer Sicherheitskontrolle betrifft.

---

### S01-15 — Medium — Die eingebaute RLS-Coverage-Prüfung kann die gefundenen Lücken konstruktionsbedingt nicht sehen

**Datei:** `packages/db/src/rls-audit.ts:102-107` und `:173-186`

```ts
// 1. All user tables in public schema
const tables = await db.execute<{ table_name: string }>(sql`
    SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public' …`);
```

```ts
    if (!isTenant) {
      return { …, scope: "platform", status: "platform_ignored",
               note: "Platform-wide table, RLS not required" };
    }
```

Drei blinde Flecken:

1. **Jede Tabelle ohne `org_id` gilt pauschal als „platform_ignored"** — damit sind alle 18 Kindtabellen aus `S01-03` sowie `user`/`session`/`account` aus `S01-04` per Definition „ok".
2. **Views und Materialized Views werden nie betrachtet** (`pg_tables` liefert nur `relkind='r'`) — `S01-08` bleibt unsichtbar.
3. **Policy-Ausdrücke werden nie gelesen** — nur `pg_policies.cmd` wird ausgewertet (`:141-162`). Eine Policy `USING (true)`, `USING (org_id IS NULL OR …)` oder mit `app.bypass_rls` zählt als vollwertige Abdeckung. `S01-02` und `S01-07` bleiben unsichtbar.

**Szenario (Eingabe → Wirkung):** Das Werkzeug, das die Admin-UI und der Systemtest als Nachweis der Mandantentrennung verwenden, meldet „ok" für exakt die Objekte, an denen dieser Stream Cross-Tenant-Zugriff praktisch nachgewiesen hat.

**Severity-Begründung:** Medium — fehlende negative Kontrolle auf einem Sicherheitspfad. Besonders relevant, weil die anschließende Remediation sich auf dieses Werkzeug stützen wird.

---

### S01-16 — Medium — RLS-Testsuite prüft live nur drei Tabellen; keine Negativtests für die gefundenen Klassen

**Dateien:** `packages/db/tests/rls/rls-coverage-systemtest.test.ts:26-30`, `packages/db/vitest.rls.config.ts`, `.github/workflows/ci.yml:185-210`

```ts
 * The probe uses the three most load-bearing tenant tables (risk,
 * control, asset). Adding more doesn't improve coverage — if the
 * policy shape is wrong on one, it's wrong on hundreds.
```

Diese Annahme ist durch diesen Stream widerlegt: die Policy-Form ist auf 443 Tabellen korrekt und die Lecks liegen ausschließlich dort, wo _keine_ Policy existiert (Views, Kindtabellen, Log-Tabellen, Auth-Tabellen) oder wo die Form abweicht (`bypass_rls`, `org_id IS NULL`).

Vorhandene RLS-Tests (9 Dateien): `cross-tenant-isolation.test.ts` prüft im Wesentlichen `organization` und `user_organization_role`; `logtable-rls-exception.test.ts` zementiert `S01-06` sogar als Sollzustand. Es gibt keinen Test, der

- eine View/Matview auf Cross-Tenant-Zeilen prüft,
- eine Kindtabelle ohne `org_id` prüft,
- verifiziert, dass `SET app.bypass_rls='true'` **nicht** wirkt,
- verifiziert, dass `org_id = NULL` nicht schreibbar ist,
- verifiziert, dass die Runtime-Rolle weder `rolsuper` noch `rolbypassrls` hat.

**Severity-Begründung:** Medium — „fehlende negative Tests auf Sicherheitspfaden" laut Rubrik.

---

### S01-17 — Medium — `whistleblowing_audit_log`: Lese-Policy ohne Mandantenprädikat

**DB-Beleg:**

```
 wb_audit_log_officer_read    | SELECT | current_setting('app.current_user_role', true)
                                          = ANY (ARRAY['whistleblowing_officer','ombudsperson','admin'])
 wb_audit_log_no_direct_write | ALL    | false | with_check=false
```

Herkunft: `packages/db/drizzle/0284_audit_chain_rev2_per_tenant.sql:367`

**Szenario (Eingabe → Wirkung):** Die Lese-Policy enthält **keine** `org_id`-Bedingung. Sobald irgendein Codepfad `app.current_user_role` auf `'admin'` setzt — was `0284:465` (`NULLIF(current_setting('app.current_user_role', true), '')`) als vorgesehene Mechanik ausweist —, liest jeder Admin jedes Mandanten das Hinweisgeber-Audit-Log **aller** Mandanten. Das betrifft nach HinSchG besonders schutzbedürftige Daten (Identität hinweisgebender Personen, Untersuchungsschritte).
Die zweite Policy (`USING false`) hilft nicht: alle Policies sind PERMISSIVE und werden per OR verknüpft; sie schränkt nur den Schreibpfad ein, weil dort keine andere Policy greift.

**Kompensierende Kontrolle (greift aktuell):** Volltextsuche über `apps/**`/`packages/**` findet **keine** Stelle, die `app.current_user_role` setzt — der GUC ist immer NULL, die Policy damit immer `false`, die Tabelle für `grc_app` faktisch nicht lesbar. Die Tabelle trägt zudem kein `FORCE ROW LEVEL SECURITY`.

**Severity-Begründung:** Medium. Latenter, aber vollständiger Cross-Tenant-Lesepfad auf die sensibelsten Daten des Produkts, der allein davon abhängt, dass ein vorgesehener GUC nie gesetzt wird.

---

### S01-18 — Medium — 373 Tabellen mit `''::uuid`-anfälligen Policies; die Zwei-Pool-Konstruktion existiert nur, um das zu umgehen

**Dateien:** `packages/db/src/request-context.ts:38-47`, `:277-282`, `:340-348`; `packages/db/src/index.ts:178-201`

```
-- Tabellen mit mindestens einer Policy, die current_setting einargumentig
-- (ohne missing_ok) aufruft  → Fehler, wenn der GUC nie gesetzt wurde:
159
-- Tabellen mit mindestens einer Policy, die ohne NULLIF nach ::uuid castet
-- → Fehler, sobald der GUC auf '' gescrubbt ist:
373
-- Tabellen mit NULLIF-geschützten Policies (viele Tabellen haben beide Formen
-- nebeneinander, weil die Gap-Closure-Migrationen die alten ALL-Policies nicht
-- ersetzt, sondern ergänzt haben):
441
```

Da alle Policies PERMISSIVE sind und per OR ausgewertet werden, genügt **eine** ungeschützte Policy, damit die gesamte Abfrage fehlschlägt — im Test unten trifft es `risk`, das beide Formen trägt.

```ts
// request-context.ts:40-47
// Empirically (PostgreSQL 16): once a custom GUC has been set on a connection,
// neither `RESET app.current_org_id` nor `set_config(..., NULL, ...)` restores
// it to NULL — it becomes the empty string ''. The RLS policies cast the value
// with `::uuid`, and ''::uuid THROWS. A reserved connection returned to the
// SHARED base pool would therefore poison later context-less queries …
```

**Nachweis** (`evidence/S01_failmode_probe.txt`):

```
SET app.current_org_id = '';
SELECT count(*) FROM risk;          --> ERROR: invalid input syntax for type uuid: ""
SELECT count(*) FROM module_config; --> ERROR: invalid input syntax for type uuid: ""
```

**Szenario (Eingabe → Wirkung):** 373 Tabellen tragen mindestens eine Policy, die `current_setting('app.current_org_id'…)` ohne `NULLIF`-Guard nach `::uuid` castet; bei 159 davon fehlt zusätzlich das `missing_ok`-Argument (`unrecognized configuration parameter`, wenn der GUC nie gesetzt wurde). Landet eine solche Query auf einer Verbindung mit `''`, wirft PostgreSQL — der Request endet in einem 500 ohne Body. Um das zu vermeiden, hält die Anwendung zwei getrennte Connection-Pools und eine dokumentierte „poison connection"-Regel. Das ist eine fragile Konstruktion um einen Defekt herum, den 442 andere Policies bereits richtig lösen (`NULLIF(current_setting(…, true), '')::uuid`).

**Severity-Begründung:** Medium — Verfügbarkeits-/Wartbarkeitsrisiko auf dem Sicherheitspfad. Die Fehlrichtung ist sicher (Fehler statt Datenausgabe), aber die Uneinheitlichkeit erzeugt exakt die Komplexität, in der Isolationsfehler entstehen.

---

### S01-19 — Low — `notification_preference`: RLS aktiviert, null Policies, kein FORCE → Deny-all

**DB-Beleg:**

```
 notification_preference | rls=t | force=f | pols=0
 Spalten: id, user_id, notification_type, channel, quiet_hours_start,
          quiet_hours_end, digest_frequency        (kein org_id)
```

**Szenario (Eingabe → Wirkung):** Unter der Runtime-Rolle `grc_app` (nicht Eigentümer) greift RLS ohne Policy als vollständiges Verbot: jede Leseabfrage liefert 0 Zeilen, jeder Insert scheitert. Benachrichtigungseinstellungen sind damit im Produktivbetrieb funktionslos, während sie unter der Superuser-Konfiguration (Dev/CI) einwandfrei arbeiten — ein Defekt, der genau nur in Produktion auftritt. Fehlrichtung ist sicher (kein Datenabfluss).

**Severity-Begründung:** Low — Härtungs-/Konsistenzdefekt ohne Angriffspfad, aber mit funktionaler Wirkung nur in der abgesicherten Umgebung.

---

### S01-20 — Low — 10 Tabellen mit RLS ohne `FORCE ROW LEVEL SECURITY`

**DB-Beleg** (`evidence/S01_rls_no_force.txt`):

```
audit_qa_checklist_item | audit_wp_review_note | audit_wp_review_note_reply
notification_preference | org_entity_relationship | organization
risk_anomaly_detection  | wb_investigation_log | webhook_delivery_log
whistleblowing_audit_log
```

Eigentümer aller zehn ist `grc`.

**Szenario (Eingabe → Wirkung):** Ohne FORCE umgeht der Tabelleneigentümer die eigenen Policies. Für die heutige Konfiguration (Eigentümer `grc` ist ohnehin Superuser, Runtime ist `grc_app`) ändert das nichts. Es wird relevant, sobald der Eigentümer auf eine Nicht-Superuser-Rolle umgestellt wird (empfohlene Härtung) oder wenn — wie bei `S01-09` — eine privilegierte Komponente als `grc` arbeitet. Für `organization`, die Mandanten-Wurzeltabelle, war genau das als #SEC-F09 bereits einmal gefixt — der Fix liegt aber nur im Shell-Skript (`S01-12`) und fehlt in der migrierten DB.

**Severity-Begründung:** Low — Härtung ohne konkreten Angriffspfad in der aktuellen Konfiguration.

---

### S01-21 — Low — Kontextverlust ist still: 115 Routen ohne Request-Kontext, Reserve-Fehler werden geschluckt

**Dateien:** `apps/web/src/lib/api.ts:66-71`, `:151-160`; `scripts/route-rls-context-baseline.txt` (115 Zeilen)

```ts
 *  - reserve() fails (pool exhausted / DB blip): log and continue without a
 *    context rather than turning a transient hiccup into a 500 on every
 *    authenticated request. The handler then sees RLS-filtered (empty) reads,
 *    which is the safe direction to fail.
```

```ts
  } catch (err) {
    if (reserved) { await reserved.release().catch(() => {}); }
    console.error("[rls-context] failed to establish request-scoped context:", …);
  }
```

```
$ node scripts/check-route-rls-context.mjs
✓ route RLS-context ratchet holds — 115 known-unwrapped route(s) in baseline, 0 new.
```

**Szenario (Eingabe → Wirkung):** Bei Pool-Erschöpfung (`requestClient` max 25 gleichzeitige authentifizierte Requests pro Pod, `index.ts:202`) oder in einer der 115 nicht mit `withErrorHandler` umschlossenen Routen fällt der `db`-Proxy auf den kontextlosen Basis-Pool zurück. Für org_id-Tabellen ist das fail-closed (leere Antwort). Für die in diesem Stream identifizierten ungeschützten Objekte (`audit_log`, `access_log`, `user`, `session`, alle Kindtabellen, alle Views) ist es **nicht** fail-closed — dort entscheidet dann allein der handgeschriebene Filter. Gegenprüfung der Baseline gegen diese Objekte ergab vier Treffer (`access-log`, `audit-log/anchor`, `audit-log/archive`, `eam/ai/generate-suggestions`); alle vier filtern nachweislich selbst auf `ctx.orgId`.

**Severity-Begründung:** Low — heute ohne konkreten Angriffspfad, aber die „fail-closed"-Zusage des Ratchet-Skripts gilt nur für die Tabellenklasse mit Policies und sollte entsprechend eingeschränkt dokumentiert werden.

---

### S01-22 — Low — Org-Zugehörigkeit wird nur gegen das JWT geprüft; Entzug wirkt verzögert

**Datei:** `packages/auth/src/context.ts:19-41`

```ts
const accessibleOrgIds = new Set(
  session?.user?.roles?.map((r) => r.orgId) ?? [],
);
const jar = await cookies();
const fromCookie = jar.get(ORG_COOKIE)?.value;
if (fromCookie && accessibleOrgIds.has(fromCookie)) return fromCookie;
```

**Szenario (Eingabe → Wirkung):** Wird ein Nutzer aus Mandant B entfernt (`user_organization_role` gelöscht), behält sein JWT die Rolle bis zum nächsten Session-Refresh. Bis dahin liefert `getCurrentOrgId` weiterhin `orgB`, die Request-Kontext-GUC wird auf `orgB` gesetzt und **RLS lässt den Zugriff korrekt passieren** — die Datenbank kennt nur den GUC, nicht die Mitgliedschaft. Der Nutzer arbeitet also nach Entzug weiter im fremden Mandanten.

**Kompensierende Kontrolle:** Der `session`-Callback lädt die Rollen bei jedem `/api/auth/session`-Aufruf frisch nach (`packages/db/src/request-context.ts:251-283`, `withUserReadContext`), was das Fenster verkleinert. Eine serverseitige Session-Invalidierung beim Rollenentzug wurde nicht gefunden.

**Severity-Begründung:** Low. Fensterbegrenzt, kein Zugriff auf nie zugewiesene Mandanten. Detailbewertung der Session-Lebensdauer gehört zu S02.

---

### S01-23 — Low — Seeds setzen `app.bypass_rls` sitzungsweit statt transaktionslokal

**Datei:** `packages/db/src/seed-control.ts:16` (vgl. korrekt: `packages/db/src/seed-risk.ts:277`)

```ts
// Bypass RLS for seeding
await db.execute(sql`SET app.bypass_rls = 'true'`);
```

gegenüber

```ts
await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`); // seed-risk.ts:277
```

**Szenario (Eingabe → Wirkung):** `SET` ohne `LOCAL` gilt für die gesamte Sitzung. `seed-control.ts` legt zwar einen eigenen `postgres()`-Client an (Z. 9), sodass der Web-App-Pool heute nicht betroffen ist. Würde das Seed jedoch je über den geteilten `db`-Proxy im Web-Prozess laufen (`RUN_SEEDS=true` im Container-Entrypoint), bliebe `app.bypass_rls='true'` auf einer Pool-Verbindung stehen und jeder spätere Request auf dieser Verbindung liefe mandantenübergreifend — die praktische Wirkung ist in `S01-02` belegt.

**Severity-Begründung:** Low. Heute keine Wirkung, aber die falsche Variante desselben Musters unmittelbar neben der richtigen.

---

### S01-24 — Low — `scripts/audit-rls-coverage.mjs` hat keinen `--check`-Modus und schreibt bei jedem Lauf in `docs/`

**Datei:** `scripts/audit-rls-coverage.mjs`

```
$ node scripts/audit-rls-coverage.mjs
→ Wrote docs/security/rls-coverage-report.{md,csv}
$ git status --porcelain
 M docs/security/rls-coverage-report.md
```

**Szenario (Eingabe → Wirkung):** Das Skript lässt sich nicht als Gate betreiben („weicht der Report vom Ist ab?"), sondern überschreibt den Report stets mit dem, was gerade aus den Migrationen gelesen wird. Eine Regression (z. B. eine neue Migration, die RLS abschaltet) erzeugt dadurch keinen Fehler, sondern nur einen geänderten Report — was in Kombination mit `S01-14` bedeutet, dass Drift zwischen Report und Datenbank nie auffällt. (Die während des Audits entstandene Änderung wurde per `git checkout` zurückgenommen; Arbeitsbaum wieder sauber.)

**Severity-Begründung:** Low — Wartbarkeit/Prozess, kein Angriffspfad.

---

### S01-25 — Low — 45+ Policies vergleichen `(org_id)::text` statt einer UUID

**DB-Beleg:**

```
45 | ALL | ((org_id)::text = current_setting('app.current_org_id'::text, true))
```

Betroffen u. a. `abac_access_log`, `abac_policy`, `api_key`, `agent_*`, `application_*`, `architecture_*`.

**Szenario (Eingabe → Wirkung):** Der Vergleich ist rein textuell. `uuid::text` liefert immer die kanonische Kleinschreibung mit Bindestrichen; enthielte der GUC je eine abweichende Schreibweise (Großbuchstaben, geklammerte Form `{…}`, führende Leerzeichen), wäre das Ergebnis stumm `false` → 0 Zeilen. Die Fehlrichtung ist sicher, aber die Uneinheitlichkeit zu den 442 UUID-typisierten Policies erschwert jede automatisierte Prüfung der Policy-Form.

**Severity-Begründung:** Low — inkonsistente Konvention ohne Angriffspfad.

---

### S01-26 — Info — `includeDescendants` im Audit-Log ist unter RLS faktisch wirkungslos

**Datei:** `apps/web/src/app/api/v1/audit-log/route.ts:48-60`

```ts
const descendants = await db.execute<{ id: string }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM organization WHERE id = ${ctx.orgId}
        UNION
        SELECT o.id FROM organization o JOIN descendants d ON o.parent_org_id = d.id
      ) SELECT id FROM descendants`);
```

**Beobachtung:** Die rekursive CTE liest `organization`, deren Policy `org_isolation_select` unter `grc_app` nur die eigene Org sichtbar macht. `orgIdScope` enthält daher immer genau eine ID; die dokumentierte Konzernhierarchie-Sicht (ADR-011 rev.2) liefert im abgesicherten Betrieb dasselbe wie ohne Parameter. Die Rollenprüfung davor (`admin`/`auditor`, Z. 37-46) suggeriert eine Funktion, die es nicht gibt. Dass das Feature genau der Grund ist, aus dem `audit_log` in der RLS-Ausnahmeliste steht (`rls-audit.ts:88-90`), macht die Begründung von `S01-06` hinfällig.

**Severity-Begründung:** Info — Beobachtung ohne Handlungsdruck, aber tragender Kontext für `S01-06`: die Ausnahme schützt eine Funktion, die unter RLS ohnehin nicht funktioniert.

---

## 5. Aufräumen

- Test-DB `grc_rls_audit` und Rolle `s01_audit_app` bleiben für die Verifikationsphase bestehen (Entfernung: `dropdb grc_rls_audit; DROP ROLE s01_audit_app;`).
- `grc_platform` wurde ausschließlich lesend abgefragt.
- Der Arbeitsbaum `/work/repo` ist unverändert (`git status --porcelain` → leer); die durch `scripts/audit-rls-coverage.mjs` erzeugte Änderung an `docs/security/rls-coverage-report.md` wurde zurückgesetzt.
