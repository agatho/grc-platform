# S09 — Datenbank, Migrationen, Schema-Integrität, Performance

**Repo:** `/work/repo` @ `a8d1414f` (read-only) · **Datum:** 2026-09-01
**Testdatenbanken (eigens angelegt):** `s09_fresh` (migrate-all, 3 Pässe), `s09_pass` (Pro-Pass-Instrumentierung), `s09_ci` (CI-Pfad nachgestellt), `s09_psql` (Produktions-Semantik)
**Begleitende Evidenz:** `/work/audit/evidence/S09-*`

---

## Übersicht

| ID     | Severity | Titel                                                                                                                                |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S09-01 | High     | 43 Migrationen sind gegen eine leere Datenbank dauerhaft nicht anwendbar — 49 Tabellen fehlen (BASE-002 vertieft)                    |
| S09-02 | High     | Drei Umgebungen bauen das Schema auf drei verschiedenen Wegen und erhalten drei verschiedene Schemata                                |
| S09-03 | High     | `create-missing-tables.ts` erzeugt Attrappen-Tabellen ohne FK, Index, Constraint, Enum und RLS                                       |
| S09-04 | High     | `0315_rls_gap_closure_v4.sql` bricht auf der ersten von 142 Tabellen ab — 570 RLS-Policies entstehen nie                             |
| S09-05 | High     | `migrate-all.ts` zerstört die Transaktionssemantik der Migrationen und erzeugt Fehler, die es ohne den Runner nicht gäbe             |
| S09-06 | Medium   | 329 von 354 Migrationen sind Drizzle unbekannt — kein Journal, kein Hash, kein Applied-State                                         |
| S09-07 | Medium   | Migrationen hängen von Seed-Daten ab, die erst nach ihnen laufen (11 Dateien)                                                        |
| S09-08 | Medium   | Zwei `pgTable`-Definitionen pro DB-Tabelle mit disjunkten Spalten (`risk_appetite_threshold`, `import_job`)                          |
| S09-09 | Medium   | `/api/v1/health/schema-drift` vergleicht nur Tabellennamen — 23 Spalten-Drifts unsichtbar, das ADR-014-Deploy-Gate ist wirkungslos   |
| S09-10 | Medium   | `ON DELETE CASCADE` auf 38 audit- und nachweisrelevanten Beziehungen                                                                 |
| S09-11 | Medium   | N+1 im Audit-Pack-Export: eine Transaktion und 6 Queries pro Prozess, unbegrenzt                                                     |
| S09-12 | Medium   | ADR-023 ist unimplementiert: kein `ON_ERROR_STOP=1`, keine Metadaten-Header, keine Rehearsal-Pipeline, keine Compensating-Migrations |
| S09-13 | Low      | 385 Fremdschlüssel ohne führenden Index                                                                                              |
| S09-14 | Low      | 3 Tabellen mit `org_id` und aktivem RLS ohne führenden `org_id`-Index                                                                |
| S09-15 | Low      | Nummernkollisionen (`0085`, `0349`) und 31 Nummernlücken; Sortierdivergenz `sort` vs. `sort -V`                                      |
| S09-16 | Low      | Vier Migrationen legen `report_template` in vier verschiedenen Gestalten an — `CREATE TABLE IF NOT EXISTS` maskiert das              |
| S09-17 | Low      | Bug in der CI-Migrationsschleife: `0000_*.sql` wird durch leere `IDX`-Variable übersprungen                                          |
| S09-18 | Info     | TimescaleDB wird nicht genutzt: 0 Hypertables, 0 Retention-/Compression-Policies                                                     |
| S09-19 | Info     | `MIGRATIONS_KNOWN_ISSUES.md` ist inhaltlich veraltet und in mehreren Punkten sachlich falsch                                         |

---

## S09-01 (High) — 43 Migrationen dauerhaft nicht anwendbar; 49 Tabellen fehlen

**Reproduktion**

```bash
export PGPASSWORD=grc_dev_password
createdb -h localhost -U grc s09_fresh
psql -h localhost -U grc -d s09_fresh -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS timescaledb;"
cd /work/repo/packages/db && DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/s09_fresh" npx tsx src/migrate-all.ts
```

```
Applying 354 migrations...
  Pass 1: 307 succeeded, 47 deferred
  Pass 2: 4 recovered, 43 still failing
  Pass 3: 0 recovered, 43 still failing
✓ 533 tables created
✗ 43 migrations still failing
```

`diff /work/migrate.log /work/audit/evidence/S09-migrate-fresh.log` → leer. BASE-002 ist exakt reproduzierbar.

**Wirkung, maschinell bestimmt.** 49 Tabellen, die das Drizzle-Schema deklariert, existieren nach dem
Lauf nicht (`/work/audit/evidence/S09-drift-drizzle-vs-fresh.txt`). Darunter der **komplette AI-Act-
Modulbestand** (`ai_system`, `ai_gpai_model`, `ai_fria`, `ai_conformity_assessment`,
`ai_human_oversight_log`, `ai_incident`, `ai_penalty`, `ai_prohibited_screening`, `ai_provider_qms`,
`ai_transparency_entry`, `ai_authority_communication`, `ai_corrective_action`, `ai_framework_mapping`),
das **RCSA-Modul** (`rcsa_campaign`, `rcsa_assignment`, `rcsa_response`, `rcsa_result`), die
**ISMS-Nichtkonformitäten** (`isms_nonconformity`, `isms_corrective_action`), Teile des **BCMS**
(`bc_exercise_scenario`, `bc_exercise_inject_log`, `bc_exercise_lesson`, `recovery_procedure`,
`crisis_contact_tree`, `crisis_communication_log`), das **Reporting** (`report_generation_log`,
`report_schedule`) und die **Nutzungsabrechnung** (`usage_record`, `usage_meter`, `api_usage_log`).

Jeder Endpunkt, der eine dieser Tabellen anspricht, quittiert mit `relation … does not exist` → HTTP 500.

**Vollständige Einzelanalyse aller 43 Dateien** mit Fehlermeldung, SQLSTATE, Ursache, Kategorie,
Datei+Zeile, Fix-Weg und Änderungspolitik: `/work/audit/evidence/S09-migration-defects.md`.

Verteilung nach Ursache:

| Kategorie                                                        | Anzahl |
| ---------------------------------------------------------------- | ------ |
| fehlendes Vorgängerobjekt (Tabelle/Typ wird nirgends erzeugt)    | 8      |
| Reihenfolge / reines Runner-Artefakt                             | 8      |
| echter SQL-Defekt in der Datei                                   | 10     |
| Abhängigkeit von Seed-Daten außerhalb der Migrationen            | 11     |
| Enum-Wert bzw. `ALTER TYPE … ADD VALUE` in derselben Transaktion | 4      |
| Objekt existiert bereits / Namenskollision                       | 2      |

**Severity High** nach Rubrik „nicht reproduzierbares Deployment". Betrifft DR-Restore,
Neuaufsetzen jeder Umgebung und die Auditierbarkeit des Deployments.

**Wichtige methodische Korrektur:** Bei vier Dateien ist die in `/work/migrate.log` gemeldete
Fehlermeldung **nicht** die Ursache, sondern ein Pass-3-Folgefehler. Prominentestes Beispiel
`0042_sprint30_report_engine_threat_landscape.sql`: gemeldet wird
`column "module_scope" does not exist`, der Pass-1-Fehler ist jedoch
`42601 INSERT has more target columns than expressions` — ein simpler Zähl-Fehler in Zeile 216–236:

```sql
INSERT INTO module_definition (
  module_key, display_name_de, display_name_en,
  description_de, description_en,
  icon, nav_path, nav_section, nav_order,
  requires_modules, license_tier, is_active_in_platform,
  background_processes
) VALUES (
  'reporting', 'Berichtswesen', 'Report Engine',
  '…', '…', 'FileText', '/reports', 'management', 85,
  '[]'::jsonb, 'professional', '["report-scheduler"]'::jsonb
) ON CONFLICT (module_key) DO NOTHING;
```

13 Spalten, 12 Werte — der Wert für `is_active_in_platform` fehlt. Wer nur `/work/migrate.log` liest,
sucht an der falschen Stelle. Beleg: `/work/audit/evidence/S09-per-pass-errors.tsv`.

---

## S09-02 (High) — Drei Umgebungen, drei Schemabau-Wege, drei Schemata

**Belegstellen**

| Umgebung         | Mechanismus                                                                                                                                                                                   | Datei · Zeile                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Produktion       | `for f in $(ls /app/packages/db/drizzle/0*.sql \| sort -V); do psql … -v ON_ERROR_STOP=0 -f "$f"`                                                                                             | `scripts/docker-entrypoint.sh:51-57`                                         |
| CI               | `npx drizzle-kit migrate` (nur 25 Journal-Dateien) → `for f in $(ls packages/db/drizzle/0*.sql \| sort)` mit `IDX > 24` → `npx tsx src/create-missing-tables.ts` → Re-Apply von `0286`/`0288` | `.github/workflows/ci.yml:140-165`, wiederholt bei `:264-277` und `:417-433` |
| Dev / DR / Audit | `npx tsx src/migrate-all.ts`, 3 Pässe, JS-`.sort()`, jede Datei in `client.begin()`                                                                                                           | `packages/db/src/migrate-all.ts:95-125`                                      |

Drei Unterschiede wirken zusammen:

1. **Transaktionsgranularität.** Der Entrypoint und CI fahren `psql` im Autocommit: schlägt Statement
   _n_ fehl, sind die Statements _1..n-1_ bereits committet. `migrate-all.ts` klammert die ganze Datei
   → alles oder nichts. Deshalb entstehen in Produktion/CI **halbe** Tabellen dort, wo `migrate-all`
   gar nichts anlegt.
2. **Fehlerbehandlung.** `ON_ERROR_STOP=0` (Entrypoint Z. 52) bzw. `2>&1 || true` (CI Z. 152)
   ignorieren jeden Fehler; `migrate-all` bricht die Datei ab.
3. **Sortierung.** `sort -V` (Prod) vs. `sort`/`.sort()` (CI, Dev). Siehe S09-15.

**Gemessenes Ergebnis** (`/work/audit/evidence/S09-schema-drift-ci-vs-migrateall.txt`):

```
Tabellen nach CI-Pfad (s09_ci):        576
Tabellen nach migrate-all (s09_fresh): 533
Tabellen nur im CI-Pfad:                49
Spalten nur im CI-Pfad (gemeinsame Tabellen):   55
Spalten nur im migrate-all-Pfad:                10
```

Extrembeispiel `report_template` — dieselbe Tabelle, zwei disjunkte Spaltenmengen:

```
nur CI:          branding_json, is_default, module_scope, parameters_json, sections_json, updated_at
nur migrate-all: category, content_schema, framework, is_active, is_system, language,
                 output_format, placeholders, sections, version
```

Ein Report-Endpunkt, der gegen die eine Gestalt geschrieben ist, wirft gegen die andere
`column … does not exist`. Tests laufen gegen CI-Schema, Produktion gegen Entrypoint-Schema,
Entwickler gegen `migrate-all`-Schema.

**Severity High** — nicht reproduzierbares Deployment; Tests bestätigen ein Schema, das produktiv
nicht existiert. Greift S13-01 und S13-21 auf und quantifiziert sie.

---

## S09-03 (High) — `create-missing-tables.ts` erzeugt Attrappen

`packages/db/src/create-missing-tables.ts:76-95` — der gesamte DDL-Generator:

```ts
const cols = config.columns.map((c: any) => {
  let def = `"${c.name}" ${pgType(c)}`;
  if (c.primary) def += " PRIMARY KEY";
  if (c.notNull && !c.primary) def += " NOT NULL";
  if (c.hasDefault) { … }
  return def;
});
const ddl = `CREATE TABLE IF NOT EXISTS "${name}" (${cols.join(", ")})`;
```

Was dabei **nicht** erzeugt wird, obwohl es im Drizzle-Schema steht:

| Fehlt                                          | Folge                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Fremdschlüssel                                 | referenzielle Integrität nicht durchgesetzt; verwaiste Zeilen möglich                                                                       |
| Indizes (`index()`, `uniqueIndex()`)           | Seq Scans; keine Eindeutigkeit auf natürlichen Schlüsseln                                                                                   |
| `UNIQUE`-Constraints                           | `ON CONFLICT`-Upserts der Anwendung schlagen mit `42P10` fehl                                                                               |
| `CHECK`-Constraints                            | fachliche Wertebereiche nicht erzwungen                                                                                                     |
| RLS + Policies                                 | **Tabelle ohne Mandantentrennung**                                                                                                          |
| Enum-Typen                                     | `if (col.enumValues) return "VARCHAR(50)"` (Z. 41) — jeder Enum wird zu freiem Text                                                         |
| Arrays                                         | `if (ct === "PgArray") return "TEXT[]"` (Z. 39) — `uuid[]`, `integer[]` werden zu `text[]`                                                  |
| echte Defaults                                 | `INTEGER` → immer `DEFAULT 0`, `JSONB` → immer `'{}'::jsonb`, `TIMESTAMPTZ` → immer `now()` (Z. 84–89), unabhängig vom deklarierten Default |
| **fehlende Spalten in existierenden Tabellen** | `CREATE TABLE IF NOT EXISTS` no-oppt — das Skript kann eine Tabelle nur ganz oder gar nicht erzeugen                                        |

Der Kopfkommentar räumt das teilweise ein (Z. 8–9): _„Foreign keys and complex defaults are omitted
for simplicity — the tables will be fully functional for Drizzle ORM reads/writes."_ Für eine
GRC-Plattform mit mandantenübergreifender RLS-Pflicht ist „functional for reads/writes" nicht der
Maßstab: eine so erzeugte Tabelle hat **keine RLS**, ist also für jeden Mandanten sichtbar.

**Messung.** Im nachgestellten CI-Lauf legt das Skript nur **1** Tabelle an
(`/work/audit/evidence/S09-ci-create-missing-tables.log`), weil `ON_ERROR_STOP=0` zuvor bereits
teil-applizierte Tabellen hinterlassen hat. Genau das ist der gefährliche Fall: die Tabellen sind da,
aber unvollständig, und das Deploy-Gate meldet grün.

Und das Skript kann **Spalten** grundsätzlich nicht nachziehen — nach dem CI-Lauf fehlen
`import_job.mapping`, `import_job.source_file` und neun Spalten auf `risk_appetite_threshold`
weiterhin (`/work/audit/evidence/S09-drift-drizzle-vs-ci.txt`).

**Severity High.** Greift S13-01 auf: solange CI diesen Weg geht, kann BASE-002 dort nie sichtbar
werden, und die Testsuite validiert ein Schema, das weder Constraints noch RLS trägt.

---

## S09-04 (High) — Eine fehlende Spalte verhindert 570 RLS-Policies

`packages/db/drizzle/0315_rls_gap_closure_v4.sql` ist ein einziger Block über **142 Tabellen** mit
**570 `CREATE POLICY`-Anweisungen** (`grep -c "CREATE POLICY"` → 570). Die erste Tabelle,
alphabetisch, ist `account` (Z. 21–37):

```sql
-- ─── account ─────────────────────────────────────────────
ALTER TABLE IF EXISTS account ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS account FORCE ROW LEVEL SECURITY;
…
    CREATE POLICY account_tenant_select ON account FOR SELECT USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

`account` ist die Auth.js-OAuth-Tabelle und hat kein `org_id`:

```
$ psql -d s09_fresh -Atc "select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_name='account'"
id,user_id,type,provider,provider_account_id,refresh_token,access_token,expires_at,token_type,scope,id_token,session_state
```

Fehler: `42703 column "org_id" does not exist`, `WHERE: SQL statement "CREATE POLICY account_tenant_select …"`.
Weil der `ALTER TABLE IF EXISTS` den Guard nur auf Tabellenexistenz legt, nicht auf Spaltenexistenz,
und die gesamte Datei in einer Transaktion läuft, entstehen **null** der 570 Policies.

Dasselbe Muster in `0093_rls_gap_closure.sql:109` (`grc_report_template` existiert nicht — die Tabelle
heißt `report_template`) und `0105_phase3_rls_audit_triggers.sql:26` (`ai_gpai_model` existiert nicht).
Drei RLS-Sammelmigrationen, alle drei brechen auf ihrer jeweils ersten fehlenden Relation ab.

**Severity High** (Vorstufe zu Cross-Tenant-Zugriff; die konkrete Auswertung, welche Tabellen dadurch
in welcher Umgebung ungeschützt bleiben, gehört zu S01 — hier der Migrationsdefekt als Ursache).
CI kaschiert das teilweise durch das Re-Apply von `0286`/`0288` (`ci.yml:157-165`), nicht aber `0315`.

**Fix:** `account`-Block entfernen; alle drei Dateien in `DO $$`-Blöcke **pro Tabelle** mit
`to_regclass`- und Spalten-Guard zerlegen, damit ein Fehltreffer nicht 141 weitere Tabellen mitreißt.

---

## S09-05 (High) — Der Runner erzeugt Fehler, die es ohne ihn nicht gäbe

`packages/db/src/migrate-all.ts:56-60`:

```ts
sql = sql
  .replace(/^\s*BEGIN\s*;\s*/im, "")
  .replace(/\s*COMMIT\s*;\s*$/im, "")
  .replace(/\s*ROLLBACK\s*;\s*$/im, "");
```

und Z. 68 ff.:

```ts
await client.begin(async (tx) => {
  await tx.unsafe("SET LOCAL TIME ZONE 'UTC'");
  await tx.unsafe(sql);
});
```

`0318_user_role_enum_backfill_and_rbac_retry.sql:28-32` ist ausdrücklich für die Gegen-Semantik
geschrieben:

> „Two-phase: the ALTER TYPE values must be visible to a NEW transaction before they can be
> referenced. PG forbids reading a value in the same transaction that adds it. So the ALTER block
> runs in autocommit (no BEGIN/COMMIT wrap), then the INSERT block has its own BEGIN/COMMIT."

Der Runner entfernt genau dieses `BEGIN;`/`COMMIT;` und zwingt die Datei danach in **eine**
Transaktion — das Gegenteil der Absicht. Ergebnis: `55P04 unsafe use of new value "esg_manager" of
enum type user_role`, `HINT: New enum values must be committed before they can be used.`

**Beweis durch Gegenprobe.** Dieselben 43 Dateien über `psql -f` (Produktions-Semantik) gegen einen
Klon des End-Zustands:

```bash
createdb -h localhost -U grc s09_psql -T s09_fresh
while read f; do psql -h localhost -U grc -d s09_psql -v ON_ERROR_STOP=1 -f "$f"; done < S09-failing-list.txt
```

**8 der 43 laufen dort durch** (`/work/audit/evidence/S09-psql-autocommit-retry.txt`):
`0085_ai_act_full_compliance`, `0090`, `0105`, `0278`, `0290`, `0291`, `0303`, `0344`.
Bei `0096`, `0318`, `0326`, `0346` verschwindet der Enum-Fehler und der darunterliegende echte
Blocker (fehlende Seed-Organisation, `23503`) wird sichtbar.

Zwei Konsequenzen:

1. Der dokumentierte Entwickler- und DR-Pfad (`migrate-all.ts`) ist **strenger** als Produktion. Die
   Zahl „43" überzeichnet die Zahl echter Dateidefekte um 8.
2. Umgekehrt ist Produktion **nicht** besser dran: dort werden dieselben Dateien halb appliziert und
   der Fehler durch `ON_ERROR_STOP=0` verschluckt.

**Fix:** Stripping entfernen; Dateien mit `ALTER TYPE … ADD VALUE` außerhalb von `client.begin()`
ausführen; Sortierung numerisch stabil und identisch zum Entrypoint machen.

---

## S09-06 (Medium) — 329 von 354 Migrationen sind Drizzle unbekannt

```bash
$ python3 -c "import json; print(len(json.load(open('packages/db/drizzle/meta/_journal.json'))['entries']))"
25
$ ls packages/db/drizzle/*.sql | wc -l
354
```

Der letzte Journal-Eintrag ist `0024_sprint13a_branding`; die Dateien `0025`–`0381` wurden von Hand
in `drizzle/` abgelegt, ohne `drizzle-kit generate`. Folgen:

- `npx drizzle-kit migrate` (CI, `ci.yml:141`) wendet **nur 25 Dateien** an — der Rest kommt über eine
  Shell-Schleife nach, ohne Applied-State.
- `__drizzle_migrations` enthält keine Prüfsummen für 93 % der Migrationen. Editieren einer Altdatei
  wird nirgends bemerkt.
- Weder `migrate-all.ts` noch `docker-entrypoint.sh` führen überhaupt Buch. Jeder Containerstart
  spielt **alle 354 Dateien erneut** ein (`docker-entrypoint.sh:51-57`) — das ist der Sachverhalt
  hinter S13-21. Idempotenz ist damit keine Empfehlung, sondern Voraussetzung; sie ist aber nicht
  durchgängig gegeben (`0268:25` `CREATE INDEX` ohne `IF NOT EXISTS`, `0102` schreibt in Temp-Tabellen).

Das widerspricht ADR-014 direkt: _„Ab sofort liegen alle Schema-Änderungen ausschließlich in
`packages/db/drizzle/` und werden via `drizzle-kit generate` erzeugt."_ Der Ablageort stimmt, das
Erzeugungsverfahren nicht.

**Nebenbefund zur Governance:** `.github/workflows/migration-policy.yml:38-41` prüft ausschließlich
neu hinzugefügte Dateien unter `packages/db/src/migrations/*.sql` — ein Verzeichnis, das im Repo
**nicht mehr existiert** (`ls packages/db/src/migrations` → `No such file or directory`). Das Gate ist
seit der Konsolidierung wirkungslos; neue handgeschriebene SQL-Dateien in `drizzle/` passieren es
ungeprüft.

---

## S09-07 (Medium) — Migrationen hängen von Seed-Daten ab, die erst danach laufen

Nach dem vollständigen Lauf:

```
$ psql -d s09_fresh -Atc "select count(*) from organization"   → 0
$ psql -d s09_fresh -Atc 'select count(*) from "user"'          → 0
```

Elf Migrationen `INSERT`en trotzdem mit hart kodierten Fremdschlüsseln:

| UUID                                          | Herkunft                                                                                    | Migrationen                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `c2446a5c-64f1-40a7-862a-8ab084f66f41`        | **nirgends** — `grep -l c2446a5c drizzle/*.sql` liefert nur die scheiternden Dateien selbst | `0086`, `0087`, `0088`, `0091`, `0096` |
| `ccc4cc1c-4b09-499c-8420-ebd8da655cd7`        | `packages/db/src/seed-all.ts:79` (`const OLD_ORG_ID = …`)                                   | `0300`, `0316`, `0317`, `0318`, `0346` |
| `7cf7aa82-af08-48f5-80d0-eb46b6e37319`        | nirgends in den Migrationen                                                                 | `0326`                                 |
| `c0000000-0000-0000-0000-c150c74201a8`        | `packages/db/sql/seed_catalog_cis_controls_v8.sql`                                          | `0289`, `0294`                         |
| `d4e5f6a7-b8c9-0123-def0-456789abcdef` (User) | nirgends                                                                                    | `0300`                                 |

Der Entrypoint führt Seeds **nach** den Migrationen aus und nur bei `RUN_SEEDS=true`
(`scripts/docker-entrypoint.sh:62-72`, Demo-Daten zusätzlich hinter `SEED_DEMO_DATA=true`, Z. 76–86).
Die Reihenfolge ist also strukturell unauflösbar: eine Migration kann nie auf Seed-Daten warten.

Beispiel `0086_isms_corrective_actions.sql:80`:

```sql
INSERT INTO isms_nonconformity (id, org_id, nc_code, …) VALUES
('b0000000-0000-0000-0000-000000000001', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', …)
```

→ `23503 … violates foreign key constraint "isms_nonconformity_org_id_fkey"`,
`DETAIL: Key (org_id)=(c2446a5c-…) is not present in table "organization".`

**Wirkung über die Migration hinaus:** Weil die ganze Datei zurückgerollt wird, fehlen auch die
DDL-Anteile — `isms_nonconformity` und `isms_corrective_action` existieren im `migrate-all`-Schema
gar nicht.

**Fix:** Seed-Blöcke aus den Migrationen entfernen (Ziel `packages/db/sql/seed_demo_*.sql`) oder
minimalinvasiv als `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM organization WHERE id = …)`
schreiben, sodass eine fehlende Org zum No-Op statt zum Abbruch führt.

---

## S09-08 (Medium) — Zwei `pgTable`-Definitionen pro DB-Tabelle

```
$ grep -rn '"risk_appetite_threshold"' packages/db/src/schema/
board-kpi.ts:25:  "risk_appetite_threshold",
risk-quantification.ts:140:  "risk_appetite_threshold",

$ grep -rn '"import_job"' packages/db/src/schema/
import-export.ts:21:  "import_job",
onboarding.ts:151:  "import_job",
```

Beide Paare sind über `packages/db/src/index.ts` (Z. 396/400/436/459) gleichzeitig exportiert und
haben **disjunkte** Spaltenmengen. `board-kpi.ts:24` deklariert
`risk_category, max_residual_score, max_residual_ale, escalation_role, …`;
`risk-quantification.ts:139` deklariert
`name, category, appetite_amount, tolerance_amount, current_exposure, status, last_updated_at, alert_enabled, trend_data`.

Die Datenbank trägt die `board-kpi`-Gestalt:

```
$ psql -d s09_ci -c "select id, org_id, name, category, appetite_amount, status from risk_appetite_threshold limit 1"
ERROR:  column "name" does not exist
```

Zusätzlich kollidieren die Indexnamen der beiden Definitionen (`rat_org_cat_idx`/`brat_org_idx` vs.
`rat_org_idx`/`rat_status_idx`).

**Aktuelle Ausnutzbarkeit begrenzt:** `rqRiskAppetiteThreshold` und `onboardingImportJob` werden
derzeit nur von `apps/worker/tests/helpers/db-exports.ts` referenziert, nicht von Produktionsrouten
(`grep -rln`). Deshalb Medium statt High. Latent bleibt: (a) `create-missing-tables.ts` iteriert
`Object.values(schema)` und würde die zuerst gefundene Gestalt anlegen; (b) der Schema-Drift-Endpunkt
zählt beide als „vorhanden"; (c) der erste Entwickler, der den falschen Export importiert, baut eine
500er-Route.

---

## S09-09 (Medium) — Das ADR-014-Deploy-Gate misst das Falsche

`apps/web/src/app/api/v1/health/schema-drift/route.ts:41-49`:

```ts
const missingInDb: string[] = [];
for (const t of expected) {
  if (!dbTables.has(t)) missingInDb.push(t);
}
```

Verglichen werden ausschließlich **Tabellennamen**. Spalten, Typen, Constraints, Indizes und RLS
bleiben außen vor. ADR-014 („Monitoring") empfiehlt genau diesen Wert als Deploy-Gate:

```bash
curl -sf … /api/v1/health/schema-drift | jq '.data | {healthy, missingInDb: .missingInDb | length}'
```

Damit meldet das Gate in CI und Produktion `healthy: true`, obwohl dort
**23 bzw. 11 im Code deklarierte Spalten in der DB fehlen** und 177 Spalten in der DB im Code nicht
vorkommen (`/work/audit/evidence/S09-drift-drizzle-vs-ci.txt`). Der Nachweis in S09-08 —
`column "name" does not exist` — ist genau die Fehlerklasse, die der Endpunkt laut eigenem
Kopfkommentar (Z. 8–14) verhindern soll.

Verschärfend: Der Wert wird erst grün, **weil** `create-missing-tables.ts` leere Hüllen anlegt
(S09-03). Das Gate belohnt also die Umgehung.

Auch `.github/workflows/schema-drift.yml` misst nicht die DB, sondern nur statisch (Z. 5–8:
_„Does NOT hit any live DB — purely static"_) und friert die RLS-Lücke per Baseline ein
(Z. 44–52: `BASELINE=131`).

---

## S09-10 (Medium) — `ON DELETE CASCADE` auf audit- und nachweisrelevanten Beziehungen

38 Fremdschlüssel mit `ON DELETE CASCADE` auf Tabellen mit Audit-, Nachweis- oder
Freigabecharakter (`/work/audit/evidence/S09-cascade-audit-tables.txt`). Die kritischsten:

```
audit_sign_off       | FOREIGN KEY (audit_id) REFERENCES audit(id) ON DELETE CASCADE
audit_working_paper  | FOREIGN KEY (audit_id) REFERENCES audit(id) ON DELETE CASCADE
audit_wp_review_note | FOREIGN KEY (working_paper_id) REFERENCES audit_working_paper(id) ON DELETE CASCADE
audit_activity       | FOREIGN KEY (audit_id) REFERENCES audit(id) ON DELETE CASCADE
audit_checklist      | FOREIGN KEY (audit_id) REFERENCES audit(id) ON DELETE CASCADE
process_sign_off     | FOREIGN KEY (process_id) REFERENCES process(id) ON DELETE CASCADE
vendor_sign_off      | FOREIGN KEY (vendor_id) REFERENCES vendor(id) ON DELETE CASCADE
policy_acknowledgment| FOREIGN KEY (distribution_id) REFERENCES policy_distribution(id) ON DELETE CASCADE
wb_case_evidence     | FOREIGN KEY (case_id) REFERENCES wb_case(id) ON DELETE CASCADE
risk_evaluation_log  | FOREIGN KEY (risk_id) REFERENCES risk(id) ON DELETE CASCADE
```

Szenario: Ein Nutzer mit Löschrecht auf `audit` entfernt eine Prüfung. Damit verschwinden ohne
weitere Prüfung sämtliche Arbeitspapiere, Review-Notizen, Checklisten und **Sign-offs** dieser
Prüfung. Für eine ISO-19011-/17021-konforme Nachweisführung ist das ein Integritätsrisiko —
`process_sign_off` trägt ausweislich `apps/web/src/app/api/v1/processes/audit-pack/route.ts:121`
eine `chain_hash`-Spalte, also eine Hash-Kette, die durch einen Cascade-Delete lückenlos
verschwindet statt zu brechen.

Positiv abgegrenzt: `audit_log` selbst hat **keine** Cascade-FKs
(`audit_log_org_id_organization_id_fk` und `audit_log_user_id_user_id_fk` ohne `ON DELETE`) — der
zentrale Audit-Trail ist nicht betroffen. Deshalb Medium statt High.

**Empfehlung:** Auf Nachweistabellen `ON DELETE RESTRICT` und stattdessen Soft-Delete
(`deleted_at`) verwenden — das Muster ist in der Codebasis ohnehin dominant.

---

## S09-11 (Medium) — N+1 im Audit-Pack-Export

`apps/web/src/app/api/v1/processes/audit-pack/route.ts:106-140`:

```ts
for (const p of processes) {
  …
  const meta = await withReadContext(ctx, async (tx) => {
    const [meta]   = await tx.execute(sql`SELECT p.id, … FROM process p WHERE p.id = ${p.id}`);
    const signOffs = await tx.execute(sql`SELECT … FROM process_sign_off        WHERE process_id = ${p.id} …`);
    const mappings = await tx.execute(sql`SELECT … FROM process_framework_mapping WHERE process_id = ${p.id}`);
    const racmRows = await tx.execute(sql`SELECT ps.bpmn_element_id, …`);
```

`processes` ist unbegrenzt: der Default-Zweig (Z. 72–86) selektiert **alle** veröffentlichten
Prozesse der Organisation ohne `LIMIT`. Pro Schleifendurchlauf wird eine **eigene Transaktion**
geöffnet (`withReadContext`, `apps/web/src/lib/api.ts:324`) und darin werden 4–6 Queries abgesetzt,
zwei davon mit korrelierten Subqueries pro Prozessschritt.

Bei 500 veröffentlichten Prozessen: 500 Transaktionen und ≳ 2500 Roundtrips in **einer** HTTP-Anfrage,
synchron, mit gleichzeitigem ZIP-Aufbau im Speicher. Das ist ein Performance-Defekt mit
Ausfallpotenzial (Verbindungspool-Erschöpfung, Request-Timeout).

**Maschinelle Gesamtschau:** `/work/audit/evidence/S09-n1-candidates.txt` listet **207**
Kandidatenstellen (Drizzle-/SQL-Aufruf innerhalb einer `for`/`forEach`-Schleife, Fenster 60 Zeilen).
Die Heuristik produziert Falsch-Positive (z. B. `apps/web/src/app/api/v1/ai/suggest-controls/route.ts:81`
liegt in einer reinen Mengen-Schleife `overlapScore`, nicht in einer Datensatzschleife), taugt aber
als Priorisierungsliste. Der überwiegende Rest sind `tx.insert(...)` in Schleifen — dort ist der Fix
mechanisch: Drizzle akzeptiert `values([...])` als Batch. Beispiele mit unbegrenzter Kardinalität:
`api/v1/isms/soa/populate/route.ts:72`, `api/v1/playbooks/route.ts:166`,
`api/v1/processes/[id]/versions/route.ts:190`, `api/v1/findings/route.ts:214`.

Positiv abgegrenzt: `api/v1/policies/distributions/[id]/activate/route.ts:108` chunkt bereits korrekt
(`notifValues.slice(i, i + 100)`).

---

## S09-12 (Medium) — ADR-023 ist unimplementiert

`docs/ADR-023-migration-rollback.md` steht auf **Status: Proposed**. Keiner der fünf Beschlüsse ist
umgesetzt:

| ADR-023 fordert                                                                | Ist-Zustand                              | Beleg                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| §1 `ON_ERROR_STOP=1` im Entrypoint                                             | `-v ON_ERROR_STOP=0`                     | `scripts/docker-entrypoint.sh:52`                                                                                             |
| §1 Deploy bricht ab, alter Code läuft weiter                                   | Zählt Fehler und startet trotzdem        | `docker-entrypoint.sh:59` — `echo "Applied $MIGRATED_COUNT migration files ($MIGRATED_FAILED failed; …)"`, danach kein `exit` |
| §2 Compensating-Migrations statt Rollback                                      | Keine einzige vorhanden                  | `find . -iname "*down*.sql" -o -iname "*rollback*"` → nur die ADR selbst                                                      |
| §3 `migration-rehearsal.yml`                                                   | Existiert nicht                          | `ls .github/workflows/`                                                                                                       |
| §4 Metadaten-Header (`-- Breaking:`, `-- Compensating-Required:` …) + CI-Check | Keine Migration trägt ihn, kein CI-Check | `grep -rl "^-- Breaking:" packages/db/drizzle` → leer                                                                         |

Der Kommentar im Entrypoint (Z. 43–47) macht die bewusste Entscheidung explizit:

> „stderr is redirected to /dev/null because ~37 files fail with schema-drift errors that are
> documented in packages/db/MIGRATIONS_KNOWN_ISSUES.md — the app tolerates those tables being
> missing for now."

Damit ist ein fehlgeschlagener Schema-Deploy in Produktion **unbeobachtbar**: keine Ausgabe, kein
Exit-Code, kein Alarm. Deckt sich mit S13-03.

---

## S09-13 (Low) — 385 Fremdschlüssel ohne führenden Index

```bash
psql -d s09_fresh -Atc "
SELECT count(*) FROM pg_constraint c
JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
WHERE c.contype='f'
AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indkey[0]=c.conkey[1])"
→ 385
```

Vollständige Liste: `/work/audit/evidence/S09-fk-without-index.txt`. Ganz überwiegend
`created_by`/`updated_by`/`*_by` → `user`. Zwei Wirkungen: (a) jedes `DELETE` auf `user` oder
`organization` löst pro Kindtabelle einen Seq Scan zur FK-Prüfung aus — bei 385 Beziehungen ist ein
Nutzer-Löschvorgang eine Volltabellen-Kaskade; (b) Joins auf `created_by` (Aktivitätsansichten)
laufen ohne Index.

Low, weil die Spalten selten filternd verwendet werden und keine Hot-Path-Query bekannt ist. Für
Löschvorgänge und DSGVO-Löschanfragen aber relevant.

---

## S09-14 (Low) — 3 Tabellen mit `org_id` und RLS ohne führenden `org_id`-Index

Gegen die Erwartung ist die Abdeckung gut: von **455** Tabellen mit `org_id` fehlt nur bei **drei**
ein Index, der `org_id` führend enthält — die Batch-Migrationen `0348_perf_indexes_batch_1.sql` und
`0362_priority_indexes.sql` haben ihre Arbeit getan. Betroffen (alle mit `relrowsecurity = true`):

```
simulation_activity_param
bpm_simulation_result
document_file
```

Derselbe Befund in `grc_platform` (3 von 3).

**Nachweis der Wirkung** an `document_file` (200 000 Zeilen, 50 Organisationen synthetisch eingespielt):

```
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id FROM document_file WHERE org_id = (SELECT id FROM organization ORDER BY name LIMIT 1) AND deleted_at IS NULL;

 Seq Scan on document_file (actual time=4.997..4.999 rows=0 loops=1)
   Filter: ((deleted_at IS NULL) AND (org_id = $0))
   Buffers: shared hit=2858
 Execution Time: 5.019 ms

-- nach CREATE INDEX s09_tmp_df_org_idx ON document_file(org_id);
 Index Scan using s09_tmp_df_org_idx on document_file (actual time=0.042..0.043 rows=0 loops=1)
   Index Cond: (org_id = $0)
   Buffers: shared hit=6
 Execution Time: 0.062 ms
```

**476-fach weniger Buffer, 81-fach schneller** — und das bei nur 200 000 Zeilen. Weil auf
`document_file` RLS aktiv ist (S01), greift der `org_id`-Prädikat bei _jeder_ Query der Anwendung.

**Empfehlung:** `CREATE INDEX CONCURRENTLY` auf `document_file(org_id)`,
`bpm_simulation_result(org_id)`, `simulation_activity_param(org_id)` in einer neuen Migration.

**Wichtige Einschränkung:** Diese Messung gilt für das `migrate-all`-Schema. Im CI-Schema fehlen die
Indizes der 49 per `create-missing-tables.ts` erzeugten Tabellen **vollständig** (S09-03), dort ist
die Lage deutlich schlechter.

---

## S09-15 (Low) — Nummernkollisionen, Lücken, Sortierdivergenz

```bash
$ ls packages/db/drizzle/*.sql | sed -E 's/.*\/([0-9]{4}).*/\1/' | sort | uniq -d
0085
0349
```

**Kollision 0085** — `0085_ai_act_complete.sql` und `0085_ai_act_full_compliance.sql` sind wechselseitig
voneinander abhängig (Defekt #5 in der Defektliste): die eine erzeugt `ai_system` und referenziert in
Z. 174 `ai_gpai_model`, die andere erzeugt `ai_gpai_model` und referenziert in Z. 56 `ai_system`. Unter
Transaktionsklammer ist das unauflösbar; unter Autocommit entscheidet die Sortierung, welche Tabelle
halbfertig entsteht.

**Kollision 0349** — `0349_rls_catalog_entry_reference.sql`, `0349a_process_approval_step.sql`,
`0349b_process_version_type.sql`. Die Sortierverfahren ordnen sie **unterschiedlich**:

```
sort   (CI, JS .sort()):   … 0348, 0349_rls…, 0349a_…, 0349b_…, 0350 …
sort -V (Produktion):      … 0348, 0349a_…, 0349b_…, 0349_rls…, 0350 …
```

Sachlich sind die drei Dateien hier unabhängig, der Schaden ist heute null. Der **Mechanismus** ist
aber real: zwei Umgebungen wenden dieselben Dateien in unterschiedlicher Reihenfolge an, und bei
Migrationen entscheidet die Reihenfolge über das Ergebnis (S09-02).

**Lücken.** Nummernbereich `0000`–`0381`, aber nur **351** eindeutige Nummern. Fehlend:
`0147, 0181–0185, 0208–0210, 0217–0222, 0250, 0272–0277, 0280, 0358, 0359, 0364–0366, 0370–0372`
(31 Stück). Lücken sind für sich harmlos, verhindern aber jede Aussage der Form „alle Migrationen bis
N sind eingespielt" und machen ein einfaches Sequenz-Gate unmöglich.

---

## S09-16 (Low) — `CREATE TABLE IF NOT EXISTS` maskiert widersprüchliche Definitionen

```bash
$ grep -l 'CREATE TABLE IF NOT EXISTS report_template (' packages/db/drizzle/*.sql
0042_sprint30_report_engine_threat_landscape.sql
0081_round4_data_reporting.sql
0099_phase2_missing_tables.sql
0100_phase2_report_tables_retry.sql
```

Vier Dateien definieren dieselbe Tabelle unterschiedlich; `0101_phase2_drop_orphan_report_types.sql`
ist ein fünfter Reparaturversuch, dessen Kopfkommentar (Z. 4–8) den vorherigen Fehlschlag beschreibt.
Weil `IF NOT EXISTS` nur die Existenz prüft, gewinnt die zufällig erste erfolgreiche Datei — hier
`0081`, weil `0042` an einem unabhängigen Defekt stirbt (S09-01). Die vier nachfolgenden Migrationen
scheitern dann an `column "module_scope" does not exist`, was wie ein Reihenfolgeproblem aussieht,
aber ein Definitionskonflikt ist.

Dasselbe Muster bei `bc_exercise` (`0015` legt `planned_date` an, `0053:114` deklariert
`scheduled_date`, `0053:127` indiziert darauf → Fehler).

**Empfehlung:** Für jede Tabelle genau **eine** `CREATE TABLE`-Migration; Erweiterungen ausschließlich
per `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.

---

## S09-17 (Low) — CI überspringt `0000_*.sql` wegen leerer Variable

`.github/workflows/ci.yml:148-154`:

```bash
for f in $(ls packages/db/drizzle/0*.sql | sort); do
  IDX=$(basename "$f" .sql | grep -oP '^\d+' | sed 's/^0*//')
  if [ "$IDX" -gt 24 ]; then
```

Für `0000_lethal_scorpion.sql` liefert `sed 's/^0*//'` auf `"0000"` den **leeren String**; `[ "" -gt 24 ]`
bricht mit `integer expression expected` ab. Beim Nachstellen des CI-Laufs reproduziert:

```
/bin/bash: line 1: [: : integer expression expected
```

Praktisch folgenlos, weil `0000` ohnehin über `drizzle-kit migrate` läuft und die Schleife nur
`IDX > 24` einspielen soll — aber der Fehler steht im CI-Log und maskiert echte Fehler derselben Form.
Fix: `sed 's/^0*//; s/^$/0/'` oder `IDX=$((10#$(…)))`.

---

## S09-18 (Info) — TimescaleDB wird nicht genutzt

```
$ psql -d s09_fresh -Atc "select hypertable_name from timescaledb_information.hypertables"
(leer)
$ psql -d grc_platform -Atc "select hypertable_name from timescaledb_information.hypertables"
(leer)
$ psql -d s09_fresh -Atc "select job_id, proc_name, hypertable_name from timescaledb_information.jobs"
3|policy_job_stat_history_retention|
1|policy_telemetry|
```

Null Hypertables, null anwendungsbezogene Retention- oder Compression-Policies (die beiden Jobs sind
TimescaleDB-Interna). Die einzigen zwei Migrationen, die Hypertables anlegen wollen, scheitern
(`0136_create_api_usage_log.sql:36`, `0153_create_usage_meter.sql:58`) an
`TS103 cannot create a unique index without the column "created_at" (used in partitioning)` — beide
Tabellen haben `id UUID PRIMARY KEY` ohne `created_at`.

Umgebungsabhängig und darum tückisch: Der Guard prüft `pg_extension WHERE extname='timescaledb'`.
In CI wird die Extension nicht angelegt (`ci.yml:134-139`: nur `pgcrypto`, `uuid-ossp`) und in
`deploy/init-extensions.sql` ist sie auskommentiert:

```sql
-- TimescaleDB is included in the timescale/timescaledb image
-- CREATE EXTENSION IF NOT EXISTS timescaledb;
```

Das Produktions-Image ist aber `timescale/timescaledb:2.26.3-pg16`
(`docker-compose.production.yml:23`). Sobald jemand die Extension aktiviert — der naheliegende erste
Schritt, um Zeitreihen zu nutzen — schlagen `0136` und `0153` fehl und `api_usage_log`, `usage_record`
sowie `usage_meter` verschwinden aus dem Schema.

**Bewertung:** Es wird ein TimescaleDB-Image betrieben und über zwei Migrationen adressiert, ohne
dass eine einzige Zeitreihe partitioniert wäre. Entweder die PKs auf `(id, created_at)` umstellen und
Retention-Policies definieren, oder Timescale ausbauen und ein schlankes Postgres-Image fahren.

---

## S09-19 (Info) — `MIGRATIONS_KNOWN_ISSUES.md` ist veraltet und teils falsch

`packages/db/MIGRATIONS_KNOWN_ISSUES.md` (Stand 2026-04-20) nennt „von ursprünglich 79 → 37 → jetzt
**≈30** noch fehlschlagende Migrationen" und „483 Tabellen". Gemessen: **43** fehlschlagend, **533**
Tabellen. Der Entrypoint verweist auf dieses Dokument als Rechtfertigung
(`docker-entrypoint.sh:45-47`), es beschreibt aber einen anderen Zustand.

Inhaltlich falsche Einzelaussagen:

| Aussage im Dokument                                                                     | Befund                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „D (Enum, 2) — **Both fixed**; 0096 nutzt bereits `IF NOT EXISTS`"                      | `IF NOT EXISTS` löst das Problem nicht. Der Fehler ist `55P04 unsafe use of new value`, ausgelöst durch die Nutzung in Zeile 146 derselben Transaktion. `0096` scheitert weiterhin. |
| „F (TimescaleDB, 2) — **Both fixed**; `create_hypertable()` in `DO $$`-Block gewickelt" | Der `DO`-Block verhindert nur den Fehler bei _fehlender_ Extension. Ist die Extension da, schlagen beide fehl (S09-18).                                                             |
| „B — Rest: Ziel-Tabellen existieren via `create-missing-tables.ts`"                     | Die so erzeugten Tabellen haben keine FKs, Indizes, Constraints oder RLS (S09-03). „Existiert" ist nicht dasselbe wie „korrekt".                                                    |
| „`0053` … Vermutlich `exercise_date` in `bc_exercise`"                                  | Die reale Spalte heißt `planned_date`.                                                                                                                                              |
| „`0092` … Vermutlich `o.code`"                                                          | Die reale Spalte heißt `org_code`; `organization` hat kein `code`.                                                                                                                  |
| „`0061` … `risk_level` oder `inherent_score`"                                           | Die realen Spalten sind `inherent_likelihood`, `inherent_impact`, `risk_score_inherent`.                                                                                            |
| „`0064` … Auf einer Tabelle die kein `name`-Feld hat"                                   | Konkret: `business_capability`, Zeile 99.                                                                                                                                           |

Die Kategorien-Vermutungen des Dokuments sind mit dieser Analyse durchgehend durch belegte Werte
ersetzt (`/work/audit/evidence/S09-migration-defects.md`).

---

## Falsch-Positiv-Prüfungen (dokumentiert, verworfen oder herabgestuft)

| Vermutung                                                                          | Prüfung                                                           | Ergebnis                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Fehlende `org_id`-Indizes wirken sich auf praktisch jede Query aus" (S01-Hinweis) | Alle 455 Tabellen mit `org_id` gegen `pg_index.indkey[0]` geprüft | **Herabgestuft auf Low.** Nur 3 Tabellen betroffen; `0348`/`0362` haben die Abdeckung hergestellt. Wirkung an einer davon per `EXPLAIN ANALYZE` belegt (S09-14).          |
| „43 Migrationen sind 43 Dateidefekte"                                              | Alle 43 zusätzlich über `psql -f` (Prod-Semantik) ausgeführt      | **Korrigiert.** 8 laufen dort durch — sie sind Runner-Artefakte, keine Dateidefekte (S09-05).                                                                             |
| „`0042` scheitert an `module_scope`"                                               | Pro-Pass-Instrumentierung                                         | **Korrigiert.** Pass-1-Fehler ist `42601`; `module_scope` ist Folgefehler (S09-01).                                                                                       |
| „Doppelte `pgTable`-Definitionen brechen Produktionsrouten"                        | `grep -rln` über `apps/` und `packages/`                          | **Herabgestuft auf Medium.** Die Schatten-Definitionen werden nur von Testhelfern importiert (S09-08).                                                                    |
| „`ON DELETE CASCADE` gefährdet den Audit-Trail"                                    | `pg_constraint` auf `audit_log` geprüft                           | **Herabgestuft auf Medium.** `audit_log` selbst hat keine Cascade-FKs; betroffen sind Arbeitspapiere und Sign-offs (S09-10).                                              |
| „207 N+1-Fundstellen"                                                              | Stichprobe manuell nachgelesen                                    | **Als Kandidatenliste gekennzeichnet.** Die Heuristik trifft auch reine Mengen-Schleifen (Beispiel `suggest-controls/route.ts:81`). Ein Fall detailliert belegt (S09-11). |

---

## Aufwandsschätzung Reparatur der 43 Migrationen

Detaillierte Aufschlüsselung in zwölf Arbeitspaketen: `/work/audit/evidence/S09-migration-defects.md`,
Abschnitt „Gruppierte Fixes".

|                                                              |                                        |
| ------------------------------------------------------------ | -------------------------------------- |
| Reine Reparatur (F1–F11)                                     | **≈ 11,5 PT**                          |
| Verifikation, CI-Umstellung, Drift-Diff = 0 (F12)            | **2 PT**                               |
| **Summe ohne Regressionstests**                              | **≈ 13,5 PT**                          |
| Realistisch inkl. Test und Review der betroffenen Fachmodule | **18–22 PT** (4–5 Wochen, eine Person) |

Die Reihenfolge ist nicht beliebig: **F1 (Runner-Fix) zuerst** — er beseitigt 8 Fehlschläge ohne
jede Migrationsänderung und deckt die darunterliegenden echten Defekte erst auf. Ohne diesen Schritt
repariert man Symptome.
