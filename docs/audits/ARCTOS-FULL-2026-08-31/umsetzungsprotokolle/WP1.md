# WP1 — Datenbank, Migrationen, Schema-Reproduzierbarkeit

**Audit:** `ARCTOS-FULL-2026-08-31` · **Branch:** `audit/full-2026-08-31`
**Umfang:** `S09-01`…`S09-19`, `S13-01`, `S13-03`, `S13-21` (22 Findings)
**Abgeschlossen:** 2026-09-01

---

## 1. Migrationsstand vorher → nachher

| Messung                                      | Vorher                           | Nachher             |
| -------------------------------------------- | -------------------------------- | ------------------- |
| `migrate-all.ts` gegen leere DB              | 311/354, Exit 1                  | **360/360, Exit 0** |
| Tabellen                                     | 533                              | **584**             |
| RLS-Policies                                 | 1.982                            | **2.552**           |
| Tabellen mit RLS                             | —                                | **508**             |
| Schema-Drift Drizzle ↔ DB (Tabellen/Spalten) | 49 Tabellen, 23+ Spalten         | **0 / 0**           |
| Doppelte `pgTable`-Definitionen              | 2                                | **0**               |
| FK ohne führenden Index                      | 443                              | **0**               |
| `org_id`-Tabellen ohne führenden Index       | 7                                | **0**               |
| Zweiter Lauf (Containerneustart)             | Fehler durch fehlende Idempotenz | **No-Op**           |

Dateizahl 354 → 360: `0085_ai_act_full_compliance.sql` wurde zu
`0085a_…` umbenannt (Nummernkollision), neu sind `0382`–`0387`.

**Reproduktion des Endstands**

```bash
export PGPASSWORD=grc_dev_password
DB=wp1_final; dropdb -h localhost -U grc --if-exists $DB; createdb -h localhost -U grc $DB
psql -q -h localhost -U grc -d $DB -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS timescaledb;'
cd /work/repo/packages/db
DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" npx tsx src/migrate-all.ts
```

```
Applying 360 migrations...
  Pass 1: 356 succeeded, 4 deferred
  Pass 2: 4 recovered, 0 still failing
✓ 584 tables created
✓ 360/360 migrations applied
All migrations applied successfully.        exit 0
```

---

## 2. Umsetzung je Finding

### S09-05 (High) — Runner zerstört die Transaktionssemantik · **behoben**

**Geändert:** `packages/db/src/migrate-all.ts` — Neufassung.
Das Stripping von `BEGIN;`/`COMMIT;`/`ROLLBACK;` (Z. 56–60) ist entfernt. Der
Runner klassifiziert jede Datei:

- _managed_ — keine eigene Transaktionssteuerung, kein Statement, das
  PostgreSQL im Transaktionsblock verbietet → eine Transaktion pro Datei
  (unverändertes Alles-oder-nichts).
- _self-managed_ — eigenes `BEGIN;`, oder `ALTER TYPE … ADD VALUE`,
  `CREATE INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`, `ALTER SYSTEM`
  → Statement-für-Statement im Autocommit, exakt wie `psql -f -v
ON_ERROR_STOP=1`; das `BEGIN;`/`COMMIT;` der Datei wird ausgeführt statt
  entfernt.

Dafür ein Statement-Splitter, der Zeilen- und (verschachtelte) Blockkommentare,
`'…'` inkl. `''` und `E'\\'`, `"…"` und `$tag$…$tag$` versteht. 58 der 360
Dateien sind self-managed.

Zusätzlich: `TimeZone=UTC` als Startup-Parameter statt `SET LOCAL` (überlebt
Reconnects, gleiche Wirkung für die Hash-Kette); die Sortierung ist reine
Byte-Reihenfolge (`migrationOrder`), identisch zum Entrypoint; der
Fehlerbericht nennt zusätzlich den **Pass-1-Fehler**, weil der zuletzt
gemeldete oft nur ein Folgefehler ist (Beispiel `0042`).

**Nachweis:** unmittelbar nach diesem Fix allein 43 → 41 Fehlschläge, und alle
`55P04`/`22P02`-Enum-Fehler verschwunden (`0290`, `0291` grün; bei `0096`,
`0316`–`0318`, `0326`, `0346` wurde der darunterliegende echte Blocker `23503`
sichtbar).
`packages/db/tests/unit/migration-hygiene.test.ts` — Splitter-Round-Trip über
alle 360 Dateien byte-identisch, Klassifikation gepinnt.

---

### S09-07 (Medium) — Migrationen hängen an Seed-Daten · **behoben**

**Geändert (14 Dateien):**

| Datei                                          | Art der Änderung                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `0086`, `0087`, `0088`, `0091`                 | Demo-Seed-Blöcke in `DO $seed$ … IF NOT EXISTS (SELECT 1 FROM organization WHERE id='c2446a5c-…') THEN RETURN` gekapselt → No-Op statt `23503` |
| `0096`                                         | `EXISTS`-Guard auf die Ziel-Org im `user_organization_role`-INSERT                                                                             |
| `0289`, `0294`                                 | Early-Return im `DO`-Block, wenn der CIS-Katalog (Seed `seed_catalog_cis_controls_v8.sql`) fehlt                                               |
| `0300`, `0316`, `0317`, `0318`, `0326`, `0346` | `INSERT … VALUES` → `INSERT … SELECT … FROM (VALUES …) WHERE EXISTS(user) AND EXISTS(org)` — zeilenweiser No-Op statt Abbruch                  |
| `0326`                                         | zusätzlich Demo-Risiken hinter Org-/User-Guard                                                                                                 |
| `0092`                                         | Demo-Seed-Filter (siehe S09-01)                                                                                                                |

Der DDL-Anteil jeder Datei bleibt unverändert und läuft jetzt durch. Damit
entstehen `isms_nonconformity`, `isms_corrective_action`, `risk_scenario`,
`risk_acceptance*`, `erm_sync_config` u. a. wieder.

**Nachweis:** 41 → 29 Fehlschläge nach diesem Paket.

---

### S09-01 (High) — 43 dauerhaft nicht anwendbare Migrationen · **behoben**

Neben S09-05 und S09-07 die echten Dateidefekte:

| Datei                | Defekt                                                                                                                                                                   | Fix                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0025`               | `notification_template` existiert nirgends (42P01); `work_item_type`-Spalten heißen anders (42703); `rc_*`-Indexnamen kollidieren mit `0200` (42P07)                     | Seed hinter `to_regclass`-Guard; Spaltenliste auf `type_key/display_name_de/display_name_en/element_id_prefix/primary_module/nav_order` korrigiert; Indizes → `rcsa_campaign_*`                                                                                                                                                                                                                                         |
| `0033`               | 10 × `ALTER COLUMN … TYPE jsonb USING (SELECT …)` — `0A000`, in der `USING`-Klausel ist keine Subquery erlaubt                                                           | Anweisungen entfernt. Zweiter, unabhängiger Grund: das Drizzle-Schema führt `risk.title`, `control.title`, `process.name`, … unverändert als `varchar`/`text`; die Umstellung nachzuholen hätte jede Lese-/Schreiboperation der Anwendung gebrochen. Enums, Sprachkonfiguration, `translation_status` samt RLS/Trigger und die additiven JSONB-Spalten der Katalogtabellen bleiben; Datei zusätzlich idempotent gemacht |
| `0039`               | `control.effectiveness_rating` existiert nicht; `ccs_*`-Indexnamen kollidieren mit `0166`                                                                                | Index auf die reale Modellierung `control_test(org_id, status)`; Indizes → `cculture_*`                                                                                                                                                                                                                                                                                                                                 |
| `0042`               | `42601` — 13 Spalten, 12 Werte (`is_active_in_platform` fehlt); `requires_modules`/`background_processes` sind `text[]`, nicht `jsonb`; `CREATE POLICY` nicht idempotent | Wert ergänzt, Array-Literale korrigiert, Policies in `pg_policies`-Guards                                                                                                                                                                                                                                                                                                                                               |
| `0053`               | zweite, abweichende `bc_exercise`-Definition (`scheduled_date`) no-oppt gegen `0015` (`planned_date`)                                                                    | abweichende Definition entfernt, fehlende Spalten additiv per `ADD COLUMN IF NOT EXISTS`, Index auf `planned_date`                                                                                                                                                                                                                                                                                                      |
| `0061`               | `risk.inherent_risk_level` existiert nicht                                                                                                                               | → `risk_score_inherent`                                                                                                                                                                                                                                                                                                                                                                                                 |
| `0064`               | `business_capability.name` existiert nicht                                                                                                                               | → `business_capability(org_id, element_id)`; dadurch entstehen auch `eam_keyword`, `eam_homepage_layout`                                                                                                                                                                                                                                                                                                                |
| `0085`/`0085a`       | zirkuläre Abhängigkeit zweier Dateien mit Nummer `0085`; RLS-Schleife über Tabellen, die erst `0085a` anlegt                                                             | FK `ai_incident.gpai_model_id` herausgelöst → neue `0382`; `CONTINUE WHEN to_regclass(...) IS NULL` in der Policy-Schleife; `0085_ai_act_full_compliance.sql` → `0085a_…`                                                                                                                                                                                                                                               |
| `0092`               | `organization.slug` existiert nicht                                                                                                                                      | → `o.name`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `0093`               | Zieltabelle `grc_report_template` existiert nicht; monolithischer RLS-Block                                                                                              | → `report_template`; 35 `CREATE POLICY` in pro-Tabelle-Guards (`to_regclass` + `org_id`-Spalte + `pg_policies`)                                                                                                                                                                                                                                                                                                         |
| `0099`/`0278`        | Zyklus: `0099` erzeugt Typ `simulation_status` (den `0278` braucht) und brauchte `simulation_run` (das `0278` erzeugt)                                                   | `simulation_run_result` nach `0384` verlagert                                                                                                                                                                                                                                                                                                                                                                           |
| `0102`               | `to_regclass`-Guard prüft nur die Tabelle, `EXECUTE` greift auf `source_entry_id`/`target_entry_id` zu (42703)                                                           | Guard auf Spaltenebene                                                                                                                                                                                                                                                                                                                                                                                                  |
| `0103`               | Sentinel-UUID `k1000000-…` enthält `k` (22P02)                                                                                                                           | → `c1030000-…`                                                                                                                                                                                                                                                                                                                                                                                                          |
| `0104`               | `catalog_entry` hat weder `title` noch `module_scope`/`display_order`                                                                                                    | `title`→`name`, `display_order`→`sort_order`, Modulbezug verlustfrei nach `metadata.module_scope`; zusätzlich Katalog-Existenz-Guard                                                                                                                                                                                                                                                                                    |
| `0105`               | erste fehlende Relation (`ai_gpai_model`) riss RLS + Audit-Trigger für alle 55 Tabellen mit                                                                              | `ALTER TABLE … IF EXISTS`; `EXCEPTION … OR undefined_table OR undefined_column`                                                                                                                                                                                                                                                                                                                                         |
| `0124`               | `dashboard_widget_config` existiert nirgends                                                                                                                             | `to_regclass`-Guard; siehe Restrisiko                                                                                                                                                                                                                                                                                                                                                                                   |
| `0130`               | Tabelle `bc_process` existiert nicht                                                                                                                                     | → `essential_process`                                                                                                                                                                                                                                                                                                                                                                                                   |
| `0136`/`0153`        | `TS103` bei vorhandener TimescaleDB-Extension                                                                                                                            | siehe S09-18                                                                                                                                                                                                                                                                                                                                                                                                            |
| `0166`               | Folge von `0039` (Indexnamen)                                                                                                                                            | durch `0039` gelöst                                                                                                                                                                                                                                                                                                                                                                                                     |
| `0200`/`0201`/`0202` | Folge von `0025` (Indexnamen)                                                                                                                                            | durch `0025` gelöst                                                                                                                                                                                                                                                                                                                                                                                                     |
| `0268`               | Indexname `pqr_org_idx` schemaweit von `0026` belegt (42P07)                                                                                                             | → `portal_qr_*`, `IF NOT EXISTS`                                                                                                                                                                                                                                                                                                                                                                                        |

Jede geänderte Datei trägt im Kopf den Vermerk
`[ARCTOS-FULL-2026-08-31 / WP1 · S09-…] In-place repariert … gilt nach ADR-014
als nicht ausgeliefert`.

**Nachweis:** Verlauf 43 → 41 (S09-05) → 29 (S09-07) → 11 → 5 → **0**.

---

### S09-04 (High) — `0315` verhindert 570 RLS-Policies · **behoben**

**Geändert:** `packages/db/drizzle/0315_rls_gap_closure_v4.sql`.
Der `account`-Block ist ersatzlos entfernt (Auth.js-OAuth-Tabelle ohne
`org_id`; `ALTER TABLE IF EXISTS` guardete nur die Tabellen-, nicht die
Spaltenexistenz). Alle **141** verbleibenden Tabellenblöcke bekamen einen
`to_regclass`- **und** `org_id`-Spalten-Guard; `ENABLE`/`FORCE ROW LEVEL
SECURITY` wanderten hinter diesen Guard; die `EXCEPTION`-Klausel fängt jetzt
auch `undefined_column`.

**Nachweis:** `select count(*) from pg_policies where schemaname='public'` →
**2552** (vorher 1982); 508 Tabellen mit aktivem RLS. Das statische
Prüfwerkzeug meldet `RLS_MISSING` für **1** Tabelle statt 131 (`account`).

---

### S09-02 / S09-03 / S13-01 (High) — drei Schemabau-Wege · **behoben**

- `packages/db/src/create-missing-tables.ts` **gelöscht**.
- `.github/workflows/ci.yml`: alle **drei** Blöcke (`integration-tests`,
  `e2e-smoke`, `database`) ersetzen `drizzle-kit migrate` + Shell-Schleife mit
  `|| true` + `create-missing-tables.ts` durch einen Schritt
  `npx tsx src/migrate-all.ts` — derselbe Runner wie Dev, DR und Audit, mit
  Abbruch bei Fehlschlag. `pgvector` wird jetzt in allen drei Jobs angelegt
  (0050, 0356, 0368, 0377 brauchen es; unter `create-missing-tables.ts` fiel
  das nicht auf).
- `packages/db/package.json`: Skript `db:sync` entfernt.
- `scripts/docker-entrypoint.sh` wendet dieselbe Sequenz in derselben
  Reihenfolge an.

**Nachweis:** `grep -rn create-missing-tables --include=*.yml --include=*.json
--include=*.sh --include=*.ts .` → nur noch erklärende Kommentare.
Schema-Diff Drizzle ↔ DB: 0 fehlende Tabellen, 0 Spalten-Drifts.
Verbliebene Referenz: ein **Kommentar** in `packages/db/src/index.ts:157`
(Datei gehört WP2) — Übergabe unten.

---

### S13-03 (High) / S09-12 (Medium) — Entrypoint und ADR-023 · **behoben**

**Geändert:** `scripts/docker-entrypoint.sh` — Neufassung.

| ADR-023 / S13-03                            | Umsetzung                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ON_ERROR_STOP=1`                           | gesetzt, je Datei                                                                                                                                                                                          |
| stderr erhalten                             | `ERR=$(psql … 2>&1 >/dev/null)`; jede Fehlermeldung wird gesammelt und am Ende vollständig ausgegeben                                                                                                      |
| Deploy bricht ab                            | `exit 1` vor `exec "$@"` — die App startet nicht, der alte Container läuft weiter                                                                                                                          |
| Serialisierung                              | Session-Advisory-Lock (`pg_advisory_lock`), gehalten von einem Hintergrund-`psql`; der zweite Container wartet statt parallel DDL zu fahren. Fällt der Container aus, gibt PostgreSQL den Lock selbst frei |
| Compensating-Migrations statt Rollback (§2) | `migration-policy.yml` blockt jede Änderung an einer ausgelieferten Migration                                                                                                                              |
| Rehearsal-Pipeline (§3)                     | Job `migration-rehearsal` in `migration-policy.yml`: leere DB → alle Migrationen → zweiter Lauf muss No-Op sein → Schema-Diff muss leer sein                                                               |
| Metadaten-Header (§4)                       | `migration-policy.yml` prüft `-- Migration:`, `-- Breaking:`, `-- Estimated-Duration:`, `-- Locking:`, `-- Compensating-Required:`, `-- Reviewer:` bei jeder neuen Datei; `0382`–`0387` tragen ihn         |

Zusätzlich: `SKIP_MIGRATIONS=true` für Container, die nicht migrieren sollen;
eine „Fehler ignorieren"-Option gibt es bewusst **nicht**.

**Nachweis**

```
$ DATABASE_URL=… MIGRATION_DIR=…/drizzle sh scripts/docker-entrypoint.sh echo APP_STARTED
  Pass 1: 353 applied, 4 deferred
  Pass 2: 4 applied, 0 deferred
Migrations complete: 357 applied in this run, 0 already recorded, 357 total.
APP_STARTED                                              exit 0

$ … MIGRATION_DIR=/tmp/badmig2 sh scripts/docker-entrypoint.sh echo APP_STARTED
FATAL: 1 of 1 migrations could not be applied.
The application is NOT started; …
  - /tmp/badmig2/0999_broken.sql
psql:…:1: ERROR:  relation "does_not_exist" does not exist
exit 1        # "APP_STARTED" kommt nicht vor
```

---

### S13-21 (Medium) / S09-15 (Low) — Doppelläufe und Sortierdivergenz · **behoben**

- **Eine** Sortierung überall: reine Byte-Reihenfolge. `LC_ALL=C sort` im
  Entrypoint ist bit-identisch zu `Array.prototype.sort()` im Runner —
  `sort -V` ließe sich in JavaScript nicht exakt nachbilden, `LC_ALL=C` schon,
  und bei vierstellig nullgepolsterten Präfixen ist es numerisch korrekt.
- **Kein Doppellauf mehr:** Ledger `_arctos_migrations` (Dateiname, SHA-256,
  Zeitstempel, Quelle, Status), gemeinsam von Runner und Entrypoint benutzt.
  Ein Containerneustart wendet **nichts** mehr an.
- **Nummernkollisionen** `0085` und `0349` aufgelöst bzw. geprüft:
  `0085_ai_act_full_compliance.sql` → `0085a_…`; `0349`/`0349a`/`0349b` sind
  eindeutige Nummern im Sinne des Gates. `migration-policy.yml` und ein
  Unit-Test verhindern neue Kollisionen. Die 31 Nummernlücken bleiben
  (dokumentiert) — das Ledger ersetzt die Aussage „alles bis N ist drin".

**Nachweis:** zweiter Lauf `0 applied, 357 already recorded`, Exit 0.
`packages/db/tests/unit/migration-hygiene.test.ts` prüft Sortierung und
Nummerneindeutigkeit.

**Offen bei WP10:** `deploy/update-all.sh:132` fährt weiterhin `sort` und
`|| true` und startet danach Container, deren Entrypoint erneut migriert. Der
Ledger macht das folgenlos, das Skript selbst gehört WP10.

---

### S09-06 (Medium) — 329 Migrationen sind Drizzle unbekannt · **behoben**

Kein fabriziertes Journal: `drizzle-kit migrate` ist aus **allen** Schemabau-
Pfaden entfernt (CI, Entrypoint, Runner), damit ist das Journal kein
Applied-State mehr, sondern nur noch Generator-Historie. Der fehlende
Applied-State wird durch `_arctos_migrations` mit SHA-256 je Datei ersetzt —
für **alle** 360 Dateien, nicht nur 25. Wird eine bereits verbuchte Datei
verändert, meldet der Runner das (`applied earlier with a different
checksum`) und wendet sie nicht erneut an.

`.github/workflows/migration-policy.yml` prüfte bis dahin ausschließlich
`packages/db/src/migrations/*.sql` — ein Verzeichnis, das es nicht mehr gibt.
Es prüft jetzt: kein neues Legacy-Verzeichnis, ADR-023-Header, keine Änderung
an ausgelieferten Migrationen, eindeutige Nummern, eindeutige Indexnamen,
Rehearsal + Idempotenz + Schema-Diff.

---

### S09-08 (Medium) — zwei `pgTable` pro DB-Tabelle · **behoben**

**Geändert:** `packages/db/src/schema/risk-quantification.ts` (Export
`rqRiskAppetiteThreshold` entfernt), `packages/db/src/schema/onboarding.ts`
(Export `onboardingImportJob` entfernt), je mit erklärendem Kommentar. Die
Datenbank trägt die `board-kpi`- bzw. `import-export`-Gestalt; die entfernten
Definitionen hatten disjunkte Spaltenmengen und kollidierende Indexnamen.
`apps/worker/tests/helpers/db-exports.ts` (auto-generierte Exportliste) um die
beiden Namen gekürzt.

**Nachweis:** `duplicate defs: 0` im Drift-Report;
`tests/unit/schema-drift.test.ts` prüft es dauerhaft und zeigt am
konstruierten Gegenbeispiel, dass die Erkennung greift.

---

### S09-09 (Medium) — Deploy-Gate misst das Falsche · **behoben**

**Neu:** `packages/db/tests/schema-drift.ts` — ein Vergleicher, der Tabellen,
**Spalten, Typen, Nullability**, RLS-Aktivierung, Policy-Existenz und doppelte
`pgTable`-Definitionen prüft. Genutzt von drei Stellen:

- `apps/web/src/app/api/v1/health/schema-drift/route.ts` (Laufzeit-Endpunkt,
  ADR-014-Deploy-Gate) — vorher verglich er ausschließlich Tabellennamen und
  meldete `healthy: true` bei 23 fehlenden Spalten;
- `packages/db/tests/schema-drift-report.ts` (CLI, `--fail-on-drift`);
- `.github/workflows/schema-drift.yml`, Job `live-schema-drift` — der Workflow
  hielt vorher ausdrücklich fest, er treffe „purely static" keine Datenbank.
  Er baut jetzt das Schema aus den Migrationen auf und vergleicht wirklich.

Die eingefrorene `BASELINE=131` im RLS-Gate ist auf **1** gesenkt (der reale
Wert nach dem `0315`-Fix); der Kommentar hält fest, dass sie nur sinken darf.

**Neu:** `packages/db/drizzle/0385_schema_drift_closure.sql` schließt die 37
danach noch gemessenen Abweichungen: 25 `SET NOT NULL` (nur wenn keine Zeile
das verletzt, sonst `RAISE WARNING` statt Deploy-Abbruch) und sechs
Typangleichungen (`ai_fria` ×4, `isms_*.tags` ×2, `organization.country_code`).

**Nachweis:** `column drift: 0`, `missing in DB: 0`, `duplicate defs: 0`.

---

### S09-10 (Medium) — `ON DELETE CASCADE` auf Nachweisbeziehungen · **behoben**

**Neu:** `packages/db/drizzle/0386_evidence_fk_restrict.sql` stellt 31
Fremdschlüssel auf `ON DELETE RESTRICT` um (Sign-offs, Arbeitspapiere,
Review-Notizen, Checklisten, Freigabeschritte, Hinweisgeberakten,
Evidenz-Artefakte, Attestierungen, Krisenprotokolle). Bewusst bei `CASCADE`
belassen: rein operative Protokolle und Ableitungen ohne Nachweischarakter
(`connector_sync_log`, `webhook_delivery_log`, `agent_execution_log`,
`catalog_entry`, `*_catalog_entry`, `technology_application_link`,
`audit_plan_item`, `audit_resource_allocation`) — dort ist das Mitlöschen die
gewollte Semantik. Die Umstellung liest die reale Constraint-Definition aus
`pg_constraint` und erhält `ON UPDATE`.

**Nachweis:** `select count(*) … confdeltype='r'` → **32**; keiner der
benannten Sign-off-/Evidenz-FKs steht noch auf `c`.

---

### S09-11 (Medium) — N+1 im Audit-Pack-Export · **behoben**

**Geändert:** `apps/web/src/app/api/v1/processes/audit-pack/route.ts`.
Statt einer Transaktion **pro Prozess** mit 5 Abfragen darin laufen die fünf
Abfragen jetzt **einmal mengenbasiert** für den ganzen Stapel in **einer**
Lesetransaktion; die Zuordnung passiert im Speicher (`groupBy`). Die
Roundtrips sind damit konstant (6) statt linear. Zusätzlich eine harte Grenze
`AUDIT_PACK_MAX_PROCESSES = 250` mit HTTP 413 und Hinweis auf `frameworkCode`
/ `processIds` — der Default-Zweig selektierte vorher **alle** veröffentlichten
Prozesse ohne `LIMIT`.

**Nachweis:** `npx tsc --noEmit -p apps/web/tsconfig.json` fehlerfrei (bis auf
den vorbestehenden, unabhängigen Fehler `TS2688 react-grid-layout`).

---

### S09-13 (Low) / S09-14 (Low) — fehlende Indizes · **behoben**

**Neu:** `packages/db/drizzle/0387_fk_and_org_id_indexes.sql`, generisch aus
dem Katalog abgeleitet und damit idempotent:
443 Fremdschlüssel ohne führenden Index → **0**;
7 `org_id`-Tabellen ohne führenden `org_id`-Index → **0**
(gemessen waren im Audit 3; nach der Reparatur existieren mehr Tabellen).
Der Kopfkommentar hält die Abwägung fest (ein zusätzlicher Indexeintrag pro
Schreibvorgang gegen eine Volltabellen-Kaskade beim Löschen) und den
Locking-Hinweis für befüllte Datenbanken.

---

### S09-16 (Low) — vier Gestalten von `report_template` · **behoben**

**Neu:** `packages/db/drizzle/0383_report_template_canonical.sql`. Kanonisch
ist `src/schema/reporting.ts`. Die Migration ergänzt die kanonischen Spalten
additiv, entfernt `rt_category_idx` und die Legacy-Spalten der `0081`-Gestalt
und verschärft `org_id` auf `NOT NULL`, wenn keine Zeile das verletzt.
`0042` legt zusätzlich die Übergangsspalte `category` an — begründet im
Kommentar: `0081_round4_data_reporting.sql` ist erfolgreich ausgeliefert, darf
nach ADR-014 nicht geändert werden und indiziert diese Spalte; `0383` entfernt
sie am Ende der Sequenz wieder.

---

### S09-17 (Low) — CI-Schleifenfehler bei `0000_*.sql` · **behoben**

Die fehlerhafte Schleife (`sed 's/^0*//'` liefert für `"0000"` den leeren
String, `[ "" -gt 24 ]` bricht mit `integer expression expected` ab) existiert
nicht mehr: alle drei CI-Blöcke rufen `migrate-all.ts` auf.

---

### S09-18 (Info) — TimescaleDB ungenutzt · **behoben (Abhängigkeit entfernt)**

**Geändert:** `0136_create_api_usage_log.sql`, `0153_create_usage_meter.sql` —
`create_hypertable()` entfernt. Begründung im Dateikopf: Es existiert in keiner
Umgebung eine Hypertable oder eine anwendungsbezogene Retention-Policy; der
Aufruf schlug mit `TS103` fehl, sobald die Extension vorhanden war (beide
Tabellen haben `id UUID PRIMARY KEY` ohne `created_at`). Der Alternativweg —
PK auf `(id, created_at)` — hätte der `pgTable`-Definition widersprochen und
genau den Schema-Drift erzeugt, den ADR-014 verhindern soll. Die Doku
(`MIGRATIONS_KNOWN_ISSUES.md`) hält den Ist-Zustand jetzt fest. Ob das
Produktions-Image `timescale/timescaledb` bleibt, ist eine
Betriebsentscheidung von WP10.

---

### S09-19 (Info) — `MIGRATIONS_KNOWN_ISSUES.md` sachlich falsch · **behoben**

Vollständig neu geschrieben: gemessener Ist-Stand mit reproduzierbarem Befehl,
Vorher/Nachher-Tabelle, Beschreibung des Applied-State, acht benannte offene
Grenzen und ein Abschnitt, der die sieben falschen Einzelaussagen der alten
Fassung ausdrücklich richtigstellt.

---

## 3. Neue Migrationen (Nummernkreis 0382–0389)

| Datei                                | Zweck                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `0382_ai_act_fk_closure.sql`         | FK `ai_incident.gpai_model_id` nach Auflösung des `0085`-Zirkels                                                   |
| `0383_report_template_canonical.sql` | eine kanonische Gestalt für `report_template`                                                                      |
| `0384_simulation_run_result.sql`     | `simulation_run_result` nach Auflösung des `0099`↔`0278`-Zyklus, Spaltenbild exakt nach `src/schema/simulation.ts` |
| `0385_schema_drift_closure.sql`      | 25 `SET NOT NULL` + 6 Typangleichungen                                                                             |
| `0386_evidence_fk_restrict.sql`      | 31 Nachweis-FKs `CASCADE` → `RESTRICT`                                                                             |
| `0387_fk_and_org_id_indexes.sql`     | 443 FK-Indizes + 7 `org_id`-Indizes                                                                                |

Alle tragen den ADR-023-Metadaten-Header. `0388`/`0389` sind frei.

## 4. Tests

- `packages/db/tests/unit/migration-hygiene.test.ts` — Splitter-Round-Trip über
  alle 360 Dateien, Transaktionsklassifikation, Sortierung, Nummern-
  eindeutigkeit, schemaweit eindeutige Indexnamen, ADR-023-Header,
  Phantom-Tabellen nur hinter Guards.
- `packages/db/tests/unit/schema-drift.test.ts` — Typnormalisierung, Erkennung
  fehlender Spalten / Typabweichung / gebrochener `NOT NULL`-Zusage,
  RLS-Lücken, doppelte `pgTable`-Definitionen.
- `packages/db/tests/check-migration-index-names.mjs` — CI-Gate gegen die
  42P07-Klasse; meldet zusätzlich 21 stille Namensdopplungen als Warnung.

```
$ cd packages/db && npx vitest run
 Test Files  8 passed (8)
      Tests  430 passed (430)
```

Jeder dieser Tests schlägt auf dem Stand vor der Remediation fehl.

## 5. Typecheck

`packages/db` besitzt **keine** `tsconfig.json` — das ist Finding S14-25 und
gehört WP12; `npx tsc --noEmit` gibt dort mangels Projekt nur die Hilfe aus.
Ersatzweise explizit geprüft, fehlerfrei:

```
$ cd packages/db && npx tsc --noEmit --skipLibCheck --strict --target es2022 \
    --module esnext --moduleResolution bundler --esModuleInterop --types node \
    src/index.ts src/migrate-all.ts tests/schema-drift.ts tests/schema-drift-report.ts
$ echo $?
0
$ cd apps/web && npx tsc --noEmit -p tsconfig.json
error TS2688: Cannot find type definition file for 'react-grid-layout'.   # vorbestehend, unabhängig
```

## 6. Verworfene Annahmen

Keines der 22 Findings wurde als Falsch-Positiv verworfen. Zwei
Präzisierungen gegenüber der Befundlage:

- **S09-14** nannte 3 Tabellen ohne führenden `org_id`-Index. Gemessen waren es
  nach der Reparatur **7** — die zusätzlichen vier (`rcsa_*`,
  `process_simulation_result`) existierten vorher gar nicht, weil ihre
  Migrationen scheiterten. Alle 7 sind versorgt.
- **S09-13** nannte 385 FKs ohne Index. Gemessen: **443**, aus demselben Grund.

## 7. Restrisiko und Übergaben an die folgenden Wellen

1. **WP2 (RLS):** `0315` erzeugt jetzt 570 zusätzliche Policies mit
   `FORCE ROW LEVEL SECURITY` auf 141 Tabellen. Die RLS-Lage ist damit eine
   **andere** als zum Auditzeitpunkt — WP2 muss **neu messen** und nicht gegen
   `rls-coverage-report.md` aus dem Audit arbeiten. Offen bleiben genau drei
   Tabellen: `access_log`, `audit_anchor`, `audit_log` (S01-06). Der
   Drift-Report meldet sie; `tests/schema-drift-report.ts --fail-on-rls`
   schaltet das Gate scharf, sobald WP2 gelandet ist. Ebenfalls offen: die
   `account`-Policy (über `user_id` mandantengebunden, braucht eine andere
   Policy-Form) und ein veralteter Kommentar in `packages/db/src/index.ts:157`,
   der `create-missing-tables.ts` noch als Teil des Ablaufs nennt.
2. **WP10 (Betrieb):** `deploy/update-all.sh` fährt weiterhin `sort` und
   `|| true` und ruft `db-backup.sh` nicht auf; `docs/ADR-023` steht noch auf
   _Proposed_, obwohl §1/§3/§4 jetzt implementiert sind; `docs/runbook.md`
   (§5, Compensating-Migration-Flow) fehlt. `0383`, `0385` und `0386` sind als
   `Breaking` markiert und brauchen vor einem Produktionsrollout ein
   Pre-Deploy-Backup. `0387` legt 450 Indizes an — auf einer befüllten
   Datenbank ein Wartungsfenster.
3. **Bestehende Produktionsdatenbank:** Der Entrypoint adoptiert sie beim
   ersten Start (Fehler „already exists" → `status='adopted'`, alles andere
   fatal). Das ist der einzige Lauf, in dem eine Fehlermeldung nicht zum
   Abbruch führt; er ist im Log deutlich markiert. Ob die 49 zuvor fehlenden
   Tabellen dort danach vollständig sind, muss nach dem ersten Deploy über
   `/api/v1/health/schema-drift` geprüft werden — der Endpunkt sieht das jetzt
   auch auf Spalten- und RLS-Ebene.
4. **Vier Migrationen brauchen weiterhin einen zweiten Pass** (`0068`, `0069`,
   `0071`, `0106`). Runner und Entrypoint konvergieren darüber und brechen
   danach hart ab; eine topologische Sortierung hätte Änderungen an
   ausgelieferten Migrationen erfordert.
5. **Zwei fachlich offene Punkte ohne technischen Defekt:**
   `dashboard_widget_config` (13 System-Dashboards, kein passendes Zielmodell —
   alle realen Dashboard-Tabellen sind org-gebunden) und
   `notification_template` (3 RCSA-E-Mail-Vorlagen, kein Code liest die
   Tabelle). Beide Seeds sind geguarded und damit No-Ops.
6. **Fünf Spalten, in denen die Datenbank strenger ist als der Code**
   (`*_sign_off.ip_address` als `inet`, `catalog_entry_mapping.*` als Enum).
   Sie stehen begründet in `ACCEPTED_TYPE_DRIFT`; angeglichen gehört die
   Code-Seite, die bei WP7 bzw. dem Katalogmodul liegt.
