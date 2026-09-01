# ARCTOS — Restarbeiten und Vollverifikation

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Branch:** `audit/full-2026-08-31`
**Grundlage:** `/work/audit/REMEDIATION_PLAN.md` §3, `/work/audit/remediation/WP1.md`…`WP12.md`
**Datum der Messungen:** 2026-09-01 · **Umgebung:** 2 vCPU, 8 GB RAM, PostgreSQL 16 + TimescaleDB + pgvector
**Nicht committet** — alle Änderungen liegen als Arbeitsbaum-Diff vor (61 Dateien, +433/−150).

---

## Teil A — Behobene Restdefekte

### A.0 Vorbemerkung: die Fehlermenge war anders zusammengesetzt als übergeben

Der Auftrag beschrieb die 91 Typecheck-Fehler als „~88 × `.rows` plus 3–5 × `chainSeq`".
Gemessen (`npx tsc --noEmit -p apps/web/tsconfig.json`, Ausgangsstand):

| Gruppe                                           | Anzahl               | Erwartet laut Übergabe |
| ------------------------------------------------ | -------------------- | ---------------------- |
| `.rows` auf `RowList` (TS2339)                   | **40**               | ~88                    |
| `chainSeq` fehlt beim `audit_log`-Insert         | **8** (an 5 Stellen) | 3–5                    |
| numerische Spalten: `number` → `numeric`(string) | 22                   | —                      |
| Zeitstempelspalten: ISO-String → `Date`          | 9                    | —                      |
| pgEnum-Spalten mit `string`-Eingang              | 6                    | —                      |
| falsches Zod-Schema / falscher Spaltenname       | 5                    | —                      |
| Transaktions- vs. `db`-Typ                       | 5                    | —                      |
| Sonstige Einzelfälle                             | 4                    | —                      |
| **Summe**                                        | **91**               |                        |

Die 51 nicht angekündigten Fehler sind **keine Typkosmetik**. Fünf davon sind Routen, die
zur Laufzeit nicht funktionieren können (falsches Validierungsschema, nicht existierende
Spalten, ungültige Enum-Werte); zehn `.rows`-Stellen liefern zur Laufzeit `undefined`
statt Daten. Sie waren durch `typescript.ignoreBuildErrors: true` verdeckt, das WP12
entfernt hat. Der Schalter ist **nicht** zurückgedreht worden.

---

### A.1 `.rows` auf `RowList` — 40 Fehler, davon 10 echte Funktionsdefekte

**Wurzel.** Die Plattform nutzt den `postgres-js`-Treiber. Dessen Drizzle-Adapter gibt aus
`execute()` eine `RowList<T[]>` zurück — ein echtes Array, **ohne** `.rows`. `.rows` kennt
nur `node-postgres`. Empirisch nachgemessen:

```
$ npx tsx probe.mjs     # drizzle-orm 0.45.2 + postgres 3.4.x
isArray: true | .rows: undefined | r[0]: {"x":1} | keys: [ '0' ]
tx isArray: true | tx.rows: undefined | t[0]: {"y":2}
```

In `apps/web/src/app/api/v1/**` standen beide Annahmen nebeneinander:

| Form                                      | Vorkommen | Laufzeitwirkung                                                    |
| ----------------------------------------- | --------- | ------------------------------------------------------------------ |
| `Array.isArray(r) ? r : (r?.rows ?? [])`  | 30        | korrekt, nur Typfehler                                             |
| `return res.rows[0]`                      | 8         | **liefert `undefined`** — die POST-Route antwortet `{"data":null}` |
| `if (!candidates.rows?.length) return []` | 2         | **immer wahr** — die Sync-Route meldet konstant „0 synchronisiert" |

Betroffene Funktionsdefekte:
`ai-act/authority`, `ai-act/corrective-actions` (+`[id]`), `ai-act/gpai` (+`[id]`),
`ai-act/incidents/[id]`, `ai-act/penalties`, `ai-act/prohibited`, `ai-act/qms`,
`esg/climate-scenarios` (+`[id]`) — POST/PUT gaben `null` zurück;
`bcms/erm-sync` und `esg/erm-sync` — die ERM-Synchronisation lief nie;
`dpms/erm-sync` und `tprm/erm-sync` — verlinkten `erm_risk_id = undefined`.

**Fix (an der Wurzel, nicht 40 Einzelkorrekturen).**
Neu: `packages/db/src/sql-result.ts`, aus `@grc/db` exportiert:

```ts
export function toRows<T>(result: SqlExecuteResult<T>): T[];
export function firstRow<T>(result: SqlExecuteResult<T>): T | undefined;
export function rowCount(result: SqlExecuteResult): number;
```

Die Helfer akzeptieren beide Treiberformen, damit ein späterer Treiberwechsel die
Aufrufstellen nicht erneut bricht. Alle 40 Stellen in 16 Dateien nutzen sie jetzt.

---

### A.2 `chainSeq` beim `audit_log`-Insert — 8 Fehler an 5 Stellen

**Wurzel.** In der Datenbank ist die Spalte
`chain_seq bigint NOT NULL DEFAULT nextval('audit_log_chain_seq_seq')` — ein BIGSERIAL —
und seit WP4/Migration `0401` weist der `BEFORE INSERT`-Trigger `audit_log_chain_assign()`
die Kettenwerte ohnehin selbst zu und **verwirft** vom Aufrufer gelieferte. Die Drizzle-
Deklaration lautete jedoch `bigint("chain_seq").notNull()` ohne Default und machte
`chainSeq` in `$inferInsert` zu einem Pflichtfeld.

**Fix.** `packages/db/src/schema/platform.ts`: `chainSeq: bigserial("chain_seq", { mode: "number" })`.
Das bildet die DB-Realität exakt ab (identischer `udt_name` `int8`, kein Schema-Drift —
`normalizeType()` in `packages/db/tests/schema-drift.ts` mappt `bigserial → int8`) und macht
die Spalte beim Insert korrekt optional.

**Warum nicht `write_audit_entry()`.** WP4.md §S03-05 listet genau diese Aufrufstellen als
„nur Kommentar/Kontext, kein Verhalten" — der Trigger skopiert seit 0401 _jeden_ Insert,
gleich über welchen Pfad. `write_audit_entry()` ist der Pfad für **manuelle** Einträge,
nicht für ORM-Inserts. Eine Umstellung wäre hier eine Verschlechterung.

Damit grün: `documents/[id]/erase`, `documents/[id]/upload` (2×),
`documents/[id]/verify-integrity`, `processes/bulk`, `lib/documents/controlled-copy`,
`lib/documents/signature-provider` (2×).

---

### A.3 Grenzwandler numeric / timestamp / integer — 31 Fehler

**Wurzel.** Drizzle bildet `numeric` bewusst auf `string` ab (keine IEEE-754-Rundung bei
Geldbeträgen); die Zod-Schemata in `@grc/shared` deklarieren dieselben Felder als
`z.number()`, weil die HTTP-API Zahlen entgegennimmt. Analog `timestamp` (Drizzle: `Date`)
gegen ISO-Strings aus dem JSON-Body. Beide Entscheidungen sind für sich richtig; es fehlte
die Umwandlung an der Grenze.

**Fix.** Neu: `packages/db/src/column-input.ts` mit `toNumericInput` / `toTimestampInput` /
`toIntegerInput`, aus `@grc/db` exportiert. `null`/`undefined` werden durchgereicht, damit
optionale PATCH-Felder ihre „nicht gesetzt"-Semantik behalten. Angewandt in 22 Routen
(u. a. `tax-cms`, `risk-quantification`, `eam`, `dora`, `organizations`, `erm/risk-events`,
`maturity`, `contracts/…/measurements`, `academy/enrollments`, `bi-reports/shares`,
`isms/nis2/reports`, `processes/[id]`, `marketplace/listings`).

---

### A.4 Fünf Routen, die zur Laufzeit nicht funktionieren konnten

Diese Gruppe ist der eigentliche Fund hinter den Typfehlern.

| Route                                      | Defekt                                                                                                                                                                                                                                                         | Fix                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POST /api/v1/ai-act/framework-mappings`   | Zod liefert `controlRef`/`evidence`, die Spalten heißen `control_reference` (**NOT NULL**) / `evidence_ids`. Der Spread verlor beide → Constraint-Verletzung.                                                                                                  | explizites Feldmapping                  |
| `POST /api/v1/ai-act/frias`                | `mitigationPlan` (Zod) ≠ `mitigation_measures` (Spalte); `createdBy` existiert auf `ai_fria` nicht.                                                                                                                                                            | explizites Feldmapping                  |
| `POST /api/v1/regulatory-changes/calendar` | validierte gegen das **generische** Kalenderschema (`startAt`/`endAt`/`recurrence`); `regulatory_calendar_event` verlangt `event_date` **NOT NULL** und kennt keines dieser Felder. Das passende `createRegulatoryCalendarEventSchema` lag seit jeher daneben. | richtiges Schema importiert             |
| `POST /api/v1/marketplace/listings`        | importierte `createMarketplaceListingSchema` aus der **Extension-/Plugin-Domäne** (`pluginId`, `title`); `marketplace_listing` verlangt `publisherId`, `categoryId`, `name`, `slug`, `summary`. Korrektes Schema: `createMktplaceListingSchema`.               | richtiges Schema importiert             |
| `POST /api/v1/portals/evidence`            | schrieb in `portal_evidence_upload` (Stakeholder-Portal), validierte aber gegen das **TPRM-Lieferantenportal**-Schema. `session_id`, `mime_type`, `storage_path` (alle NOT NULL) kamen nie an.                                                                 | `stakeholderPortalEvidenceUploadSchema` |

Dazu vier ungültige Enum-Werte, die den INSERT abbrechen ließen:

| Route                                     | Wert                      | Enum                       | Korrektur                              |
| ----------------------------------------- | ------------------------- | -------------------------- | -------------------------------------- |
| `POST /api/v1/dpms/breaches`              | `status: "open"`          | `work_item_status_generic` | `"draft"` (wie alle 18 anderen Routen) |
| `POST /api/v1/dpms/tia`                   | `status: "open"`          | dito                       | `"draft"`                              |
| `POST /api/v1/rcsa/campaigns/[id]/launch` | `type: "action_required"` | `notification_type`        | `"task_assigned"`                      |
| `POST /api/v1/ics/control-library/adopt`  | `status: "draft"`         | `control_status`           | `"designed"`                           |

`dpms/breaches` ist der Art.-33-DSGVO-Meldeweg, `dpms/tia` die Transfer-Folgenabschätzung,
`rcsa/.../launch` rollte die gesamte Kampagnen-Transaktion zurück.

Weiter:

- `POST /api/v1/dpms/dsr/[id]/transition` schrieb `description`/`performedBy` in
  `dsr_activity`; die Spalten heißen `details`/`created_by`. Der Aktivitätseintrag zur
  DSGVO-Betroffenenanfrage entstand nie.
- `POST /api/v1/bcms/bia/[id]/finalize` ließ beim Insert in `essential_process` die
  **NOT-NULL**-Spalten `mtpd_hours` und `rto_hours` weg, obwohl beide Werte zwei Zeilen
  darüber schon selektiert wurden. Jedes `/finalize` mit mindestens einem neuen
  essenziellen Prozess brach ab und rollte die Statustransition mit zurück. Impacts ohne
  MTPD/RTO können keinen gültigen Datensatz ergeben; sie werden jetzt übersprungen und in
  der Antwort als `essentialProcessesSkippedMissingRecoveryTimes` ausgewiesen, statt mit
  einer erfundenen 0 gespeichert zu werden.

---

### A.5 Nicht deklarierte DB-Spalte + Lücke im Drift-Check

`control.source_library_ref` (varchar(50)) existiert in der Datenbank und wird von
`ics/control-library/adopt` geschrieben, war in `packages/db/src/schema/control.ts` aber nie
deklariert. **Der Drift-Check aus WP1/S09-09 sieht das nicht**: `ColumnDrift.kind` kennt
`missing-in-db`, `type-mismatch`, `nullability-mismatch` — aber keine Spalten, die in der DB
_zusätzlich_ stehen. Spalte deklariert; die Lücke im Drift-Check ist als offener Punkt
notiert (Teil C).

---

### A.6 Transaktions- vs. `db`-Typ (5 Fehler)

`compliance/coverage` typisierte drei Helfer als `tx: typeof db`, bekommt aus
`withReadContext` aber das Transaktionsobjekt; `processes/[id]/approval-steps` und
`processes/[id]/versions` rufen umgekehrt `findWorkingVersion(db, …)` mit dem
request-skopierten Proxy auf, während WP12 den Parameter auf `DbTransaction` verengt hatte.
Neu in `apps/web/src/lib/db-types.ts`: `export type DbReader = Pick<DbTransaction, "select" | "execute">`
— der ehrliche Vertrag für reine Lesehelfer, ohne `as unknown as`-Cast und ohne `any`.

---

### A.7 `packages/db` Typecheck: `import.meta.glob`

`tests/unit/all-schemas-smoke.test.ts` (WP11/S11-10) nutzt `import.meta.glob` — eine
Vite-Erweiterung. `packages/db/tsconfig.json` setzte `"types": ["node"]`, also fehlte die
Deklaration (TS2339 + TS18046). `"types": ["node", "vite/client"]` ergänzt. Der Test lief
unter Vitest immer korrekt; nur der Typcheck kannte die Erweiterung nicht.

---

### A.8 Zwei Modul-Mocks in `apps/web` waren unvollständig

`src/__tests__/api/bulk-operations.test.ts` und `.../academy-enrollment-flow.test.ts` zählen
die Exporte von `@grc/db` einzeln auf. Nach A.3 nutzen die Routen zusätzlich die
Grenzwandler; ohne sie warf jedes Bulk-Item („expected 207 to be 201"). Die Mocks binden die
Wandler jetzt **echt** ein (`vi.importActual("@grc/db/src/column-input")` — reine Funktionen,
keine DB-Abhängigkeit), statt sie nachzubauen: ein nachgebauter Konverter würde genau die
Umwandlung nicht prüfen, um die es geht.

---

### A.9 Ein Test hob zwei RLS-Kontrollen dauerhaft auf (S01-04 / S01-08)

**Neu gefunden, gleiche Klasse wie WP11 §2.4.**

`apps/web/src/__tests__/rls-route-chain/risks-route-rls.test.ts` führte in `beforeAll` ein
pauschales `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app`
aus — **ohne** das Gegenstück. `ON ALL TABLES` erfasst auch die Auth.js-Token-Tabellen
(`session`, `account`, `verification_token`, deny-all seit Migration 0392) und alle
Materialized Views (können keine RLS tragen, Migration 0393). Die acht RLS-Tests unter
`packages/db/tests/rls` tragen den REVOKE-Block seit WP2; hier fehlte er.

Gemessen nach einem vollständigen `npm test`:

```
 session_sel | mv_sel
-------------+--------
 t           | t          ← beide Kontrollen offen
```

und danach:

```
$ npx vitest run --config vitest.rls.config.ts tests/rls/tenant-isolation-systemtest.test.ts
AssertionError: RLS gaps:
missing_policies auth account: RLS enabled but no policy at all (S01-19)
missing_policies auth session: …
missing_policies auth verification_token: …
matview_readable matview copilot_usage_stats: … (S01-08)
matview_readable matview evidence_review_summary: …
   Tests  3 failed | 19 passed (22)
```

Der Systemtest bestand im Gesamtlauf **nur, weil er vor diesem Test lief**. Der REVOKE-Block
ist ergänzt; nach dem Fix:

```
 session_sel | mv_sel        $ vitest … tenant-isolation-systemtest.test.ts
-------------+--------        Tests  22 passed (22)
 f           | f
```

---

## Teil B — Aufgabe 2: die drei bekannten Testfehler

### B.1 `whistleblowing_audit_log.case_id NOT NULL` vs. `wb_report`-Trigger — **nicht reproduzierbar**

WP11 §2.2 meldet 2 Fehlschläge + 5 mitgerissene mit
`null value in column "case_id" … violates not-null constraint`.
**Auf einer von Null migrierten Datenbank tritt der Fehler nicht auf.**

Ausgeführt und protokolliert:

```
$ psql -d $DB
BEGIN;
INSERT INTO organization (id, name) VALUES ('1111…','T');
INSERT INTO wb_report (org_id, report_token, token_expires_at, category, description)
VALUES ('1111…','tok123', now()+interval '30 days','other','desc');
 ?column?
-----------
 INSERT OK          -- ebenso UPDATE und DELETE auf wb_report
```

```
$ npx vitest run --config vitest.integration.config.ts tests/integration/gdpr-privacy.test.ts
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

**Grund.** `0426_wb_confidentiality_isolation.sql` enthält **zwei** Rückfallebenen, die WP11
offenbar nicht vorlagen:

1. In `wb_case_scope_of()` für `wb_report`: `IF v_case IS NULL THEN v_case := (p_row->>'id')::uuid;` (Report-Skopus, Zeile 131–134).
2. Im Trigger selbst, für **alle** dreizehn wb-Tabellen: `v_case_id := COALESCE(v_case_id, v_entity_id);` (Zeile 225).

Rückfallebene 2 schließt die Klasse — auch für `wb_case_evidence.case_id` und
`wb_ombudsperson_activity.case_id`, die beide nullable sind und sonst dieselbe Verletzung
erzeugt hätten. Gegengeprüft mit einem report-skopierten Beweismittel-Insert **vor**
Fallanlage: `EVIDENCE INSERT OK`.

Die Datei ist seit Commit `08607f36` (WP6–WP9) unverändert. Ich habe **keine** Migration
geschrieben: es gibt keinen Defekt zu beheben, und eine Migration „zur Sicherheit" wäre
genau der Placebo-Fix, den §1.2 des Plans ausschließt. Wahrscheinlichste Erklärung für WP11s
Beobachtung ist eine nicht von Null aufgebaute Messdatenbank — die im Container laufende
`grc_platform` trägt 528 Tabellen und auf `wb_report` noch den **alten** generischen
`audit_trigger`, ist also nicht auf dem Stand des Branches.

### B.2 `eam_ai_prompt_template`: schreibbare `org_id IS NULL`-Policy — **nicht reproduzierbar**

```
$ psql -d $DB -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid='eam_ai_prompt_template'::regclass"
 eam_ai_prompt_template_tenant_select        | r
 eam_ai_prompt_template_tenant_insert        | a
 eam_ai_prompt_template_tenant_update        | w
 eam_ai_prompt_template_tenant_delete        | d
 eam_ai_prompt_template_global_or_org_select | r    ← die IS-NULL-Öffnung, NUR auf SELECT
 eam_ai_prompt_template_org_insert           | a
 eam_ai_prompt_template_org_update           | w
 eam_ai_prompt_template_org_delete           | d
```

Die von WP11 zitierte FOR-ALL-Policy `eapt_org_isolation` existiert nicht. Migration `0394`
(WP2) ersetzt sie beim Lauf durch vier kommandospezifische Policies; `0063`, das sie anlegt,
läuft in einem Von-Null-Lauf davor. Auch ein idempotenter Zweitlauf von `migrate-all.ts`
stellt sie nicht wieder her (nachgemessen). `runRlsAudit` meldet 0 Lücken.

**Bekannte Fragilität, kein aktueller Defekt:** `0394` ist ein einmaliger Scan über
`pg_policies`. Eine _spätere_ Migration, die erneut eine FOR-ALL-Policy mit `org_id IS NULL`
anlegt, brächte S01-07 lautlos zurück. Alle Migrationen > 0394 wurden geprüft (`0396`,
`0403`, `0426`, `0429`, `0430`, `0433`, `0434`): jede `org_id IS NULL`-Öffnung dort ist auf
`FOR SELECT` beschränkt. Der Dauerschutz ist der RLS-Systemtest, nicht die Migration.

### B.3 Der dritte Fehlschlag: Rollenzuordnung im Worker-Test

`apps/worker/tests/lib/job-runtime.db.test.ts` scheitert mit
`new row violates row-level security policy for table "organization"`, wenn
`APP_DATABASE_URL` auf `grc_app` zeigt und `WORKER_DATABASE_URL` fehlt. Das ist **kein
Codedefekt**, sondern die von WP11 selbst dokumentierte Drei-Rollen-Anforderung
(`apps/worker/tests/require-db.mjs`, `ci.yml:317-331`). Mit korrekt gesetzter Umgebung grün.

---

## Teil C — Abnahme nach REMEDIATION_PLAN §3

Alle Läufe gegen eine **frisch erzeugte** Datenbank `verify_1788283456`.

### C.1 Migrationen von Null — **grün**

```
$ DB=verify_$(date +%s); PGPASSWORD=… createdb -h localhost -U grc $DB
$ psql -q -d $DB -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; … vector; … timescaledb;'
$ cd packages/db && DATABASE_URL="…/$DB" npx tsx src/migrate-all.ts

Applying 402 migrations...
  Pass 1: 398 succeeded, 4 deferred
      deferred: 0068_catalog_target_modules.sql — relation "catalog" does not exist
      deferred: 0069_consolidate_catalog_tables.sql — relation "catalog_entry" does not exist
      deferred: 0071_predictive_risk_tables.sql — column "model_type" does not exist
      deferred: 0106_framework_mapping_bridge.sql — relation "framework_mapping" does not exist
  Pass 2: 4 recovered, 0 still failing
✓ 603 tables created
✓ 402/402 migrations applied
MIGRATE_EXIT=0
```

**Tabellenzahl:** 402 Migrationen, 603 vom Runner gemeldete `CREATE TABLE`-Ziele,
**595 tatsächliche Basistabellen** in `information_schema` (der Runner zählt auch
`CREATE TABLE IF NOT EXISTS` mehrfach genannte). Exit 0. Zweitlauf idempotent
(`402 already recorded as applied`, 0 Fehler).

### C.2 Schema-Drift — **grün**

```
$ DATABASE_URL="…/$DB" npx tsx packages/db/tests/schema-drift-report.ts
Drizzle tables: 581   DB tables: 595
missing in DB : 0
extra in DB   : 14 (informational)
column drift  : 0
RLS drift     : 0
duplicate defs: 0
EXIT=0
```

Diff Drizzle → DB leer. Die 14 „extra in DB" sind vom Werkzeug als informativ klassifiziert
(Migrationsjournal, Timescale-Hilfstabellen); Spaltenabweichungen: 0.

### C.3 Typecheck — **grün, alle 12 Projekte**

```
$ for d in apps/web apps/worker packages/*; do npx tsc --noEmit -p $d/tsconfig.json; done
apps/web                 0        packages/email           0
apps/worker              0        packages/events          0
packages/ai              0        packages/graph           0
packages/auth            0        packages/reporting       0
packages/automation      0        packages/shared          0
packages/db              0        packages/ui              0
```

Ausgang: 91 Fehler in `apps/web`, 2 in `packages/db`. Jetzt 0.
`typescript.ignoreBuildErrors` bleibt entfernt.

> Hinweis: ein laufender `next dev` erzeugt `apps/web/.next/dev/types/validator.ts`, das die
> `include`-Liste der tsconfig mitzieht und dort 5 generierte TS1499/TS2339 produziert. Kein
> Quellcode; nach `rm -rf apps/web/.next/dev` sind es 0. Der Pfad gehört nicht in `include` —
> siehe offener Punkt O-6.

### C.4 Lint — **gemischt: beide CI-Tore grün, „0 Fehler überall" nicht erreicht**

Das Kriterium des Plans („ESLint in allen Workspaces, 0 Fehler") deckt sich **nicht** mit dem,
was das Repository implementiert. `ci.yml:42-76` fährt zwei Tore:

```
$ cd apps/web && npx eslint . --no-error-on-unmatched-pattern
WEB_ESLINT_EXIT=0                                                    ← grün

$ node scripts/lint-ratchet.mjs
Lint-Ratsche über apps/worker, packages, scripts: 406 Befunde (Baseline 406), 1007 Dateien.
    251  @typescript-eslint/no-unused-vars  (Baseline 251)
    121  no-console                          (Baseline 121)
     26  @typescript-eslint/no-explicit-any  (Baseline 26)
      3  no-control-regex (3)   2  no-empty (2)   1  no-require-imports (1)
      1  no-useless-escape (1)  1  (fatal-or-directive) (1)
✓ Keine Lint-Regression.
RATCHET_EXIT=0                                                       ← grün
```

`npm run lint` (turbo) ist dagegen rot: 246 Fehler in 9 Workspaces. **Das ist der von
WP10/S13-17 bewusst eingefrorene Altbestand**, nicht neu. Gegenprobe mit weggestashten
Änderungen:

```
$ git stash push -u -- apps packages && npx turbo run lint --continue --force
@grc/db 42 errors · @grc/shared 33 · @grc/worker 144 · @grc/reporting 11 · @grc/email 7
@grc/auth 5 · @grc/graph 2 · @grc/automation 2 · @grc/ai (fatal)
Tasks: 2 successful, 11 total
```

Byte-identisch zum Lauf mit meinen Änderungen. **Meine Änderungen fügen null Lint-Fehler
hinzu.** Der Altbestand bleibt als offener Punkt O-1.

### C.5 Unit / Integration — **grün, 5 771 Tests, keine unbegründeten Skips**

```
$ DATABASE_URL=…grc@…/$DB  APP_DATABASE_URL=…grc_app@…/$DB \
  WORKER_DATABASE_URL=…grc_worker@…/$DB  ARCTOS_ALLOW_PRIVILEGED_DB=true \
  CRON_SECRET=… AUTH_SECRET=… npm test
```

| Workspace                                          |                 Tests | Ergebnis                |
| -------------------------------------------------- | --------------------: | ----------------------- |
| `@grc/shared`                                      |                 1 950 | passed                  |
| `@grc/web` (unit)                                  |                 2 410 | passed                  |
| `@grc/web` (rls-route-chain)                       |                     3 | passed                  |
| `@grc/worker`                                      | 367 + 1 expected fail | passed                  |
| `@grc/db` unit                                     |                   105 | passed                  |
| `@grc/db` integration (Audit-Kette, Tamper, DSGVO) |                   101 | passed                  |
| `@grc/db` rls (Mandantentrennung)                  |                    79 | passed                  |
| `@grc/auth`                                        |                   196 | passed                  |
| `@grc/email`                                       |                   174 | passed                  |
| `@grc/ai`                                          |                   154 | passed                  |
| `@grc/graph`                                       |                    47 | passed                  |
| `@grc/reporting`                                   |                    43 | passed                  |
| `@grc/ui`                                          |                    39 | passed                  |
| `@grc/automation`                                  |                    82 | passed                  |
| `@grc/events`                                      |                    20 | passed                  |
| **Summe**                                          |             **5 771** | **0 failed, 0 skipped** |

```
 Tasks:    12 successful, 12 total
EXIT=0
```

Der eine `expected fail` im Worker ist ein bewusstes `it.fails`. Ein einziger Skip im Log
(`[schema-drift] round-trip skipped due to trigger FK: work_item_type_key…`) ist begründet
und benannt — siehe offener Punkt O-2.

### C.6 RLS — Cross-Tenant-Systemtest **grün**

```
$ npx vitest run --config vitest.rls.config.ts tests/rls/tenant-isolation-systemtest.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

und die vollständige RLS-Suite:

```
$ npx vitest run --config vitest.rls.config.ts
 Test Files  10 passed (10)
      Tests  79 passed (79)
```

Isoliert **und** nach einem vollständigen `npm test` grün — vor dem Fix aus A.9 nur in
einer Reihenfolge.

### C.7 Audit-Integrität — Tamper-Tests **grün**

```
$ npx vitest run --config vitest.integration.config.ts \
    tests/integration/audit-tamper-evidence.test.ts \
    tests/integration/audit-chain-per-tenant.test.ts \
    tests/integration/audit-integrity-live.test.ts
 Test Files  3 passed (3)
      Tests  38 passed (38)
```

### C.8 Security-Gate — **grün**

```
$ node scripts/audit-gate.mjs
audit-gate: OK (keine neuen high/critical-Advisories in Produktions-Dependencies)
GATE_EXIT=0
```

### C.9 Abhängigkeiten — **grün**

```
$ npm audit --audit-level=high
found 0 vulnerabilities
AUDIT_EXIT=0

$ npm audit --json | .metadata.vulnerabilities
{'info': 0, 'low': 0, 'moderate': 0, 'high': 0, 'critical': 0, 'total': 0}
```

### C.10 Playwright-E2E — **teilweise gelaufen, kein grüner Gesamtlauf**

Vorgehen: `next dev` (nicht der Produktionsbuild, siehe C.11) gegen die frische, mit
`seed.ts` + `seed-all.ts` befüllte Verifikationsdatenbank; `must_change_password` für den
E2E-Admin zurückgesetzt (sonst endet der Login auf der Passwortänderung statt auf
`/dashboard`).

**Setup-Spec — grün:**

```
$ npx playwright test --project=setup
  ✓  1 [setup] › apps/web/e2e/auth.setup.ts:23:6 › authenticate as admin (37.7s)
  1 passed (39.3s)
```

**Regressionsprojekt — 31 von 47 Tests gelaufen, dann Abbruch wegen Ressourcen:**

|                                                         | Anzahl |
| ------------------------------------------------------- | -----: |
| bestanden                                               |     13 |
| fehlgeschlagen                                          |     11 |
| übersprungen (`test.skip`, fehlende Vorbedingungsdaten) |      7 |
| **nicht mehr erreicht**                                 | **16** |

Fehlgeschlagen: `f-02-org-create`, `f-15-checklist-catalog`, `i-01-isms-setup-wizard`,
`i-03-soa-diff-export` (Teil 1), `i-04-management-review`, `i-05-nc-lifecycle`,
`i-07-threat-heatmap`, `n-01-risk-form-validation`, `n-02-control-form-validation`,
`n-02-nis2-readiness` (Teil 2), `n-03-finding-form-validation`.

Ein zweiter Anlauf über die volle Suite brach ab: `next dev` belegte allein 4,8 GB RSS, die
Lastanzeige stand bei 12,8 auf 2 vCPU, `GET /login` lief in 60 s Timeout. Die Ergebnisse ab
diesem Punkt sind Umgebungsrauschen und werden **nicht** gezählt.

**Es hat kein grüner E2E-Lauf stattgefunden.** Was gemessen wurde, steht oben; die 11
Fehlschläge sind in Teil D als offene Punkte aufgeführt. Da WP11 die Suite nie fahren konnte,
existiert **keine Vergleichsbasis** — ob diese 11 vor der Remediation ebenfalls rot waren,
ist mit den vorliegenden Daten nicht entscheidbar. Drei davon wurden im Server-Log
zurückverfolgt und sind nachweislich **nicht** von den Änderungen dieser Sitzung verursacht
(O-3, O-4, O-5).

### C.11 Produktionsbuild (S12-16) — **bleibt offen, aber diagnostiziert**

WP12 hat in fünf Läufen belegt, dass `next build` mit Turbopack **verklemmt**.
Next 16 kennt `--webpack`. Zwei Läufe mit diesem Schalter:

```
$ NODE_OPTIONS='--max-old-space-size=5120' npx next build --webpack
▲ Next.js 16.2.11 (webpack)
  Creating an optimized production build ...
<--- Last few GCs --->
[12100] 333005 ms: Mark-Compact 4419.9 (5160.0) -> 4411.1 (5153.8) MB … allocation failure
FATAL ERROR: Ineffective mark-compacts near heap limit
             Allocation failed - JavaScript heap out of memory
Aborted                                             (nach 5 min 36 s)

$ NODE_OPTIONS='--max-old-space-size=6656' npx next build --webpack
  Creating an optimized production build ...
Killed                                              (OS-OOM-Killer, nach ~14 min)
```

**Erkenntnisgewinn gegenüber WP12:** der Build hängt nicht grundsätzlich — mit webpack
**terminiert** er, mit einer eindeutigen Diagnose. Er ist speichergebunden, nicht verklemmt;
die Turbopack-Blockade ist die Rust-seitige Ausprägung derselben Ressourcengrenze. Auf
dieser Maschine (8 GB gesamt, davon ~6,9 GB frei) ist der Build nicht herstellbar. Das ist
kein Codedefekt, den ich hier schließen kann — er braucht einen größeren Builder oder eine
Zerlegung der Route-Graphen. Bleibt offen als O-7.

---

## Teil D — Offene Punkte

| Nr.      | Punkt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Schwere  | Beleg                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| **O-1**  | **Lint-Altbestand**: 406 Befunde (251 ungenutzte Bindungen, 121 `no-console`, 26 `any`) in `apps/worker`, `packages/*`, `scripts`. Von WP10 bewusst in `.eslint-ratchet.json` eingefroren, nicht behoben. Das Plankriterium „0 Fehler in allen Workspaces" ist damit **nicht erfüllt**; das CI-Tor ist grün, weil es die Ratsche prüft.                                                                                                                                                                                                                                                                                                                                               | mittel   | C.4                         |
| **O-2**  | **`POST /api/v1/organizations` schlägt unter `grc_app` fehl (SQLSTATE 42501)**. `organization` trägt nur `org_isolation_modify` (FOR ALL, `USING id = current_org`, kein `WITH CHECK`) — PostgreSQL verwendet USING auch als WITH CHECK, eine **neue** Org kann also nie eingefügt werden. Da S01-10 `APP_DATABASE_URL` produktiv verpflichtend macht, ist das Anlegen eines Mandanten über die API in Produktion unmöglich. Nicht selbst behoben: der Fix ist eine INSERT-Policy auf der Mandanten-Wurzeltabelle, und wer Mandanten anlegen darf, ist eine Entscheidung des Plattform-Admin-Konzepts aus WP3/S02-03 — keine, die ich im Alleingang als RLS-Öffnung schreiben sollte. | **hoch** | C.10, `f-02-org-create`     |
| **O-3**  | **`GET /api/v1/isms/threats/heatmap` → 500**, `column v.asset_id does not exist` (SQLSTATE 42703). Rohes SQL gegen eine View, deren Spalte es nicht gibt. Nicht von dieser Sitzung berührt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | hoch     | Dev-Log, `i-07`             |
| **O-4**  | **`POST /api/v1/findings` → 500** beim Insert in `work_item` (FK `work_item_type_key_work_item_type_type_key_fk`). Dieselbe fehlende `work_item_type`-Registrierung, die auch den einen begründeten Skip im Drift-Test auslöst. Nicht von dieser Sitzung berührt.                                                                                                                                                                                                                                                                                                                                                                                                                     | hoch     | Dev-Log, `n-03`             |
| **O-5**  | **Neun weitere E2E-Regressionsfehler** (`f-15`, `i-01`, `i-03`, `i-04`, `i-05`, `n-01`, `n-02-control`, `n-02-nis2-readiness`, plus die 16 nie erreichten Specs). Ursachen nicht einzeln zurückverfolgt. Ohne Baseline nicht als Regression oder Altbestand klassifizierbar.                                                                                                                                                                                                                                                                                                                                                                                                          | offen    | C.10                        |
| **O-6**  | **Drift-Check meldet keine Spalten, die nur in der DB stehen.** `ColumnDrift.kind` kennt `missing-in-db`, aber kein `extra-in-db`. `control.source_library_ref` (A.5) war deshalb jahrelang unsichtbar. Solange die Richtung fehlt, ist „Drift leer" nur eine halbe Aussage.                                                                                                                                                                                                                                                                                                                                                                                                          | mittel   | A.5, C.2                    |
| **O-7**  | **Produktionsbuild nicht herstellbar** (S12-16). Turbopack verklemmt, webpack läuft in JS-Heap-OOM bei 5 GB bzw. OS-OOM-Kill bei 6,5 GB. Speichergebunden, nicht verklemmt. Braucht einen Builder mit mehr RAM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | hoch     | C.11                        |
| **O-8**  | **`packages/db` / `packages/shared` / `packages/auth` typecheckt nur mit abgeschalteten `noUncheckedIndexedAccess` und `noUnusedLocals`** (WP12 hat die Zahlen in `packages/db/tsconfig.json` dokumentiert: 641 / 502 / 321 Befunde). Der Typcheck **läuft** — die Ratsche für diese beiden Flags steht noch aus.                                                                                                                                                                                                                                                                                                                                                                     | mittel   | `packages/db/tsconfig.json` |
| **O-9**  | **`0394` ist ein Einmal-Scan.** Eine spätere Migration mit FOR-ALL + `org_id IS NULL` brächte S01-07 lautlos zurück. Heute keine solche Migration vorhanden (alle > 0394 geprüft). Dauerschutz ist allein der RLS-Systemtest.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | niedrig  | B.2                         |
| **O-10** | **`grc_platform` im Container ist nicht auf Branch-Stand** (528 Tabellen, alter `audit_trigger` auf `wb_report`, kein `export_approval`). Wer dagegen testet, misst einen anderen Codestand — das erklärt vermutlich B.1 und B.2. Vor jeder weiteren Messung neu aufbauen.                                                                                                                                                                                                                                                                                                                                                                                                            | mittel   | B.1                         |

---

## Anhang — Reproduktion

```bash
DB=verify_$(date +%s)
PGPASSWORD=grc_dev_password createdb -h localhost -U grc $DB
PGPASSWORD=grc_dev_password psql -q -h localhost -U grc -d $DB \
  -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS timescaledb;'
cd packages/db && DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" \
  npx tsx src/migrate-all.ts
cd ../.. && DIRECT_PSQL=1 GRC_APP_PASSWORD=grc_app_dev_password \
  GRC_WORKER_PASSWORD=grc_worker_dev_password bash deploy/provision-grc-app.sh $DB

DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" \
APP_DATABASE_URL="postgresql://grc_app:grc_app_dev_password@localhost:5432/$DB" \
WORKER_DATABASE_URL="postgresql://grc_worker:grc_worker_dev_password@localhost:5432/$DB" \
ARCTOS_ALLOW_PRIVILEGED_DB=true CRON_SECRET=… AUTH_SECRET=… npm test

PGPASSWORD=grc_dev_password dropdb -h localhost -U grc $DB
```

Die drei Datenbank-URLs sind **nicht** austauschbar (`apps/worker/tests/require-db.mjs`):
`grc` für Migrationen und Fixtures, `grc_app` für alles, was RLS beweisen soll,
`grc_worker` (BYPASSRLS) für die Worker-Laufzeit.
