# Changelog

Nach Keep-a-Changelog (<https://keepachangelog.com/de/1.1.0/>).
Versionen folgen Calendar-Versioning (`YYYY.MM.DD` oder `YYYY.Q`) bis
ARCTOS 1.0 released wird; dann SemVer.

Unveroeffentlichte Aenderungen stehen unter `[Unreleased]`. Wenn ein
Deploy erfolgt, wird dieser Abschnitt umbenannt mit Datum und ein
neuer `[Unreleased]` eroeffnet.

## [0.1.0-alpha] — 2026-04-20

Erster Alpha-Release mit vollgrüner CI-Pipeline ohne jeden
`continue-on-error`-Bypass.

### CI / Release-Gate

- Alle 7 CI-Jobs blockierend: Lint & Type Check, DB Migration & Integrity,
  Unit Tests, Integration Tests, E2E Smoke, Security Audit, Build.
- Worker-Image wird jetzt auch in der Build-Stufe gebaut + gepushed +
  smoke-getestet (`tsx apps/worker/src/index.ts` bootet ohne
  MODULE_NOT_FOUND). Fängt genau die Crash-Loop-Regression ab, die den
  `arctos-worker-1` 4 Tage lang bei 5868 Restart-Attempts gehalten
  hatte.
- `Dockerfile.worker` kopiert jetzt `/app` komplett vom Deps-Stage
  rüber (inklusive `packages/*/node_modules/`). Grund:
  `@anthropic-ai/sdk` wird von npm-Workspaces nicht in
  `/app/node_modules/` gehoisted.
- `picomatch` via `overrides: ">=4.0.4"` gepinnt (CVE-2026-33671 ReDoS).
- Trivy scannt Web- + Worker-Image; `skip-dirs: /usr/local/lib/node_modules/npm`
  exkludiert npm's eigene gebundelte Dep-Tree (node:22-alpine Base
  shipping picomatch 4.0.3 — kein Runtime-Pfad der App).
- Neuer **E2E-Smoke-Job**: postgres + timescaledb hochfahren, Migrationen
  - Seed + RLS-Gap-Closure anwenden, `apps/web` bauen + starten,
    Playwright-Suite `ci-smoke.spec.ts` durchlaufen (Login →
    Dashboard → Risk-API-CRUD → Audit-Log-Seite → Audit-Archive-ZIP).
- **Trivy**-Image-Scan nach jedem Build-Push auf GHCR; CRITICAL/HIGH
  bricht ab.
- **License-Check** blockiert jetzt GPL-/AGPL-Abhängigkeiten in
  Production-Deps (zuvor `|| true`).
- `.env`-File-Check im Security-Audit-Job nutzt jetzt eine Regex, die
  `.env.example`, `.env.sample`, `.env.template` und
  `.env.<any>.example` sauber ausnimmt.
- `vitest` v4 Pool-Config-Migration (`fileParallelism: false` +
  `poolOptions.forks.singleFork`) in `packages/db/vitest.*.config.ts`
  — ohne das rannten RLS-Tests parallel und produzierten
  "tuple concurrently updated"-Races.

### Dockerfile-Härtung

- `AUTH_SECRET`, `AUTH_TRUST_HOST`, `DATABASE_URL` in der Build-Stage
  von `ENV` auf `ARG` + inline-Env im `RUN` umgestellt — sie liegen
  nicht mehr als ENV-Layer im Final-Image (Docker-Lint
  `SecretsUsedInArgOrEnv` clean).
- `deploy/.env.production` → `deploy/.env.production.example`,
  `setup.sh` entsprechend angepasst.

### Audit-Chain (ADR-011 rev.2 / rev.3)

- `javascript-opentimestamps` entfernt — die Lib zog 14 CVEs nach
  (6 critical) via `bitcore-lib` / `web3` / `request` / `crypto-js`.
  Submit-Pfad bleibt zero-dep; Upgrade-Pfad ist jetzt ein explizit
  dokumentierter No-Op-Stub, der darauf hinweist, dass stored OTS
  stubs mit dem externen `ots` CLI offline upgradebar und
  verifizierbar sind.
- FreeTSA bleibt der primäre Tamper-Evidence-Kanal.
- Append-only-Rules-Test-Teardown nutzt jetzt
  `session_replication_role = 'replica'` (session-lokal) statt
  globaler `DROP RULE`/`CREATE RULE` — eliminiert Test-Races.
- CI prüft jetzt `audit_log_tombstone_guard`-Trigger + mindestens
  5 `_no_`-Rules (vorher hart 6 erwartet, was seit 0284 falsch war).

### RLS / Schema-Drift

- Neue Migration `0288_rls_gap_closure_v3.sql`: RLS +
  FORCE-RLS + 4 Policies (select/insert/update/delete) für
  `ai_conformity_assessment`, `ai_framework_mapping`, `ai_fria`,
  `ai_human_oversight_log`, `ai_system`, `ai_transparency_entry`,
  `audit_risk_prediction`, `audit_risk_prediction_model`,
  `process_simulation_result`, `scenario_engine_scenario`,
  `simulation_run_result` (11 Tabellen, die die rls-audit-Systemtests
  vorher als Lücke flaggten).
- CI wendet `0286`- und `0288`-Gap-Closure **nach**
  `create-missing-tables.ts` erneut an, damit Tabellen, die erst
  dort entstehen, ebenfalls RLS bekommen.
- EAM-Schema: fehlende Spalten aus 0060/0064/0065 (`keywords`,
  `predecessorId`, `examinerId`, `responsibleId`, plus Business-
  Capability-Erweiterungen) in Drizzle nachgezogen.
- `import_job`-Schema: Template-Pack-Felder (`source`,
  `templatePackId`, `totalItems`, `processedItems`, `failedItems`,
  `errorLog`, `startedAt`, `updatedAt`) + Migration
  `0287_import_job_template_pack_columns.sql`.

### Migration-Triage (Schema-Drift-Altlasten)

Von 79 → 37 → jetzt ~30 failing. Alpha-Triage abgeschlossen
(`packages/db/MIGRATIONS_KNOWN_ISSUES.md`):

- **D (fixed)**: 0026 Template-Seeds entfernt (hatten
  `type='system'` + `user_id=NULL`), 0096 nutzt bereits
  `IF NOT EXISTS`.
- **E (fixed)**: 0046 nutzt jetzt `bpm_simulation_result` statt des
  von 0006 belegten `simulation_result`.
- **F (fixed)**: `create_hypertable()` in 0136 + 0153 ist jetzt in
  einem `DO $$`-Block, der ohne TimescaleDB-Extension auf
  Plain-Table-Fallback geht.
- **B/C/A/G**: deferred nach `release/0.2-migration-cleanup`,
  Status dokumentiert.

### TypeScript-/Lint-/Prettier-Aufräumen

- Worker TS: 109 → 0. Alles auf postgres-js-`RowList`-Semantik
  umgestellt (kein `.rows`-Zugriff mehr), JSX-Flag im Worker-
  tsconfig für die `@grc/email`-Templates, Notification-Inserts auf
  gültige Enum-Werte + `userId`-Auflösung statt `null`, AI-Provider-
  Response-Typen gecastet, Schema-Drift in EAM und import_job
  geschlossen.
- Web TS: 94 → 0. `IncidentStatus`-Barrel-Konflikt gelöst
  (state-machine-Interface in `AiActIncidentSnapshot` umbenannt),
  Zod-v4-Migration (`z.record(key, value)`), `@types/node`
  Buffer-ArrayBuffer-Kompatibilitäts-Cast, RLS-Policy-Query-Filter
  neu ausgerichtet, Target auf ES2020 für BigInt-Literals in der
  ASN.1-DER-Hilfsbibliothek.
- ESLint + Prettier: 0 Errors, 0 Warnings repo-weit.

### Sonstiges

- `apps/web/tsconfig.json` Target auf ES2020.
- `packages/db/drizzle/0025_sprint14_rcsa.sql`: `pg_policies.polname`
  → `policyname` (der korrekte View-Spaltenname; `polname` gehört zur
  Low-Level-Katalogtabelle `pg_policy`).

### Bekannt / Deferred auf 0.2

- OTS-Upgrade-Walker als echte zero-dep-Implementierung (aktuell
  Stub).
- 20 restliche Schema-Drift-Migrationen (A-/B-Rest/C-Rest/G), die
  idempotent nicht durchlaufen.
- 137 N+1-Query-Kandidaten + 1738 fehlende Index-Vorschläge aus dem
  Audit (siehe `scripts/audit-*.mjs`).

## [Unreleased]

### Wave-25 — Alpha-Quality-Followup (2026-05-21)

Block A (A1 endgame) im Wave-25-Prompt war bei Auftrags-Erstellung schon obsolet — A1 closed 2026-05-21 13:49 UTC unter Wave 24 (siehe unten). Bleibender Scope dieses PRs: 5 Endpoint-Fixes + 1 Demo-Seed + Gate-Erweiterung.

#### Block B — Wave-24-Folge-Regressionen

- **B1 — `/findings?controlId=X` 500 → 422 für invalide UUIDs.** Analog zur W24-B2-Enum-Validierung, jetzt für UUID-typisierte FK-Filter (`controlId`, `auditId`, `riskId`, `ownerId`). Empty-String = no-filter, valid UUID → 200, alles andere → 422 mit `invalidParam`-Hinweis.
- **B2 — `POST /bcms/bia` für `bcm_manager` geöffnet.** BCM Manager ist die Rolle deren Kern-Workflow BIA-Anlage ist; Verweigerung bei POST defeatete den Sinn der Rolle. RBAC: `admin / risk_manager / bcm_manager`.

#### Block C — Wave-24-Restpunkte

- **C1 — Migration `0347_seed_iso27001_demo_coverage.sql`.** Seedet 15 `control_framework_coverage`-Zeilen für Meridian, die existierende Controls auf ISO 27001:2022 Annex A-Clauses mappen (titel-basiert, illustrativ). Die `/compliance/coverage`-Tile zeigt ab jetzt realistische Zahlen statt 0 %. Sobald eine Org einen echten Gap-Analyse-Run macht, übernimmt der Snapshot-Pfad.
- **C2 — Neue `GET /vendors/{id}/assessments/schema`.** Schema-Discovery für den W24-D2-Alias. Liefert Felder + Beispiel-Body mit `assessmentDate`/`inherentRiskScore`/`residualRiskScore` (alle required) + CIA-Triade-Scores (optional). 404 wenn Vendor nicht in Org. Spiegelt das Pattern der W24-D5/D6-Schema-Endpoints.
- **C3 — ESG Measurement Schema example.metricId.** W24-D6 verwendete einen hardcodierten Platzhalter-UUID, was POST mit dem Schema-Beispiel zu 404 „Metric not found" führte. Schema-Endpoint resolvt jetzt einen echten metricId aus der Caller-Org und fällt auf den Platzhalter + `hint`-Feld zurück, wenn keine Metric geseedet ist.

#### Pilot-Readiness-Gate erweitert

`scripts/pilot-readiness-gate.sh` checkt jetzt zusätzlich:
- W25-B1: `/findings?controlId=not-a-uuid` ≠ 500
- W25-B2: `POST /bcms/bia` ≠ 403 für admin (proxy für die Rollen-Widening)
- W25-C1: ISO-27001-Coverage hat `frameworkCount ≥ 1`, ideally `overallCoveragePct > 0`
- W25-C2: Vendor-Assessment-Schema-Endpoint liefert `example.assessmentDate`
- W25-C3: ESG-Measurement-Schema `example.metricId` ist nicht der Placeholder (oder hat erklärenden `hint`)

#### Tests

- `wave-25-block-b-c.test.ts` — 14 neue Contract-Tests (B1 8 Fälle, B2 RBAC-Liste, C2 Schema-Shape + 404, C3 dynamic-metric + fallback-hint).
- Wave-24-Block-B/C/D-Tests bleiben grün (33 / 14).

### Wave-24 — Alpha-Quality-Closure (2026-05-20/21, PR #218 in CI)

12 von 13 QA-Items aus `docs/qa-reports/claude-code-wave24-prompt.md` geliefert; nur A1's _Live-Verification_ braucht noch SSH-Zugriff auf Hetzner (fail2ban-Block am 2026-05-20). Damit ist die Plattform invite-ready für Alpha-Tester.

#### Block B — Wave-23-Regressionen reverten

- **B1 — `/audit-log/integrity` für CISO + `compliance_officer` wieder lesbar.** Wave-23 hatte das auf admin/auditor verschärft, was den quartalsweisen Hash-Chain-Health-Check des CISO blockierte (ISO 27001 A.12.4.2). Archive + Anchor bleiben unverändert admin/auditor.
- **B2 — `GET /findings?status=invalid` → 422 statt 500.** Wave-23 cast-Trick crashte den Server. Jetzt validiert `validateEnumParam()` Status/Severity/Source vor der WHERE-Clause.
- **B3 — Neue `GET /erm/management-summary`.** Vorher 405. Liefert `risksSummary` / `controlsSummary` / `findingsSummary` für CISO/Compliance-Quartalsreviews. POST refaktoriert auf `buildSummary()`-Helper (gemeinsamer Code-Pfad).
- **B4 — Neue `POST /control-tests`.** Vorher 405. Wiederverwendet `executeTestSchema` aus `@grc/shared`. RBAC: admin/risk_manager/auditor/control_owner/compliance_officer.

#### Block C — Hash-Chain v3 Continuity

- **ADR-026** (`docs/ADR-026-hash-chain-v3-migration.md`) erklärt warum v3-Rehash ein _Continuity-Event_ ist (Row-Content unverändert, nur Formel-Update) und nicht eine Re-Genesis. Drei Continuity-Beweise: Verifiable Rehash, Migration Anchor, FreeTSA-Timestamp Anchor.
- **Neue `GET /audit-log/integrity/continuity`** liefert `versionDistribution`, `migrationAnchors`, `freeTsaAnchors` und `totalContinuityValid`-Flag. 503 wenn Continuity nicht beweisbar. Externe Auditoren können in O(1) prüfen statt die ganze Chain herunterzuladen.

#### Block D — Workflow-Endpoint-Lücken

- **D1 — PUT/DELETE `/risks/{id}/treatments/{tid}`** für `process_owner` + `control_owner` geöffnet. Wer ein Treatment via POST anlegen darf, darf es jetzt auch progressen.
- **D2 — `POST /vendors/{id}/risk-assessments`** für `vendor_manager` + `contract_manager` geöffnet. Alias `/vendors/{id}/assessments` re-exportiert canonical handler (Identity-Test pin't das fest).
- **D3 — Neue `GET /vendors/{id}/risk-profile`** aggregiert Vendor-Row + Latest-Assessment + Engaged-Contract-Spend + DORA/LkSG-Flags in eine Payload (statt 4–5 Round-Trips).
- **D4 — `GET /tprm/concentration`** für `vendor_manager` + `contract_manager` + `ciso` geöffnet (DORA Art. 28).
- **D5 — Neue `GET /audit-mgmt/audits/{id}/activities/schema`** liefert benötigte/optionale Felder + Beispiel-Body. Behebt Wave-24-QA-422-Loop bei Audit-Activity-Anlage.
- **D6 — Neue `GET /esg/measurements/schema`** mit analogem Discovery-Format für ESG-Measurements.
- **D7 — `GET /compliance/coverage` 3-stufiger Fallback** (Snapshot → Live-`control_framework_coverage` → Catalog-Entry-Heuristik) + `?framework=`-Filter. Realistische Coverage-Zahlen auf frischen Tenants ohne vorherigen Gap-Analysis-Run.

#### Block E — Seed-Migration für neue Test-User

- **`0346_seed_bcm_security_external_auditor_users.sql`**: Login-User `bcm@meridian.test`, `security@meridian.test`, `ext-auditor@meridian.test` (alle Passwort `WaveQA-2026!`). Rollen `bcm_manager`, `security_analyst`, `external_auditor` waren bereits im `user_role`-Enum. Damit haben Alpha-Tester 12 rollen-distinkte Accounts in Meridian.

#### Block A1 — ✅ CLOSED 2026-05-21 (5 Wellen, H1 war korrekt)

- A1 schliesst. Root-Cause **H1 — stale prod build** (40-%-Top-Hypothese). Der Wave-24-Deploy brachte den post-Wave-22 Findings-Insert-Code (`route.ts:166–169`) zum ersten Mal live auf prod. Verifiziert via direct POST/GET-Round-Trip 2026-05-21 13:49 UTC: `controlId` persistiert.
- **Der Diagnose-Endpoint war nie erreichbar.** Er lebte unter `apps/web/src/app/api/v1/_debug/finding-insert-trace/` — Next.js-App-Router behandelt `_<name>`-Ordner als _private folders_ und schliesst sie still vom Routing aus. Same trap wie Wave-23.3 `_meta`. Endpoint + Script + Integration-Test-Scaffold via cleanup-Commit entfernt.
- **Lesson:** "/api/v1/meta/build SHA vs git log origin/main -1" ist der 60-Sekunden-Test der A1 sofort gelöst hätte. 5 Wellen vermeidbarem Debugging. Memory: `feedback_stale_build_mimics_code_bug.md`.

#### Cross-Cutting

- **Alpha-Tester-Onboarding-Doc** `docs/ALPHA_INVITE.md` für eingeladene Kolleg:innen: Login-URL, 15 Accounts × Rollen, 15-Minuten-Tour pro Rolle, Known Limitations, Issue-Reporting-Template.
- **STATUS.md** auf Wave-24 aktualisiert.
- **Alpha-Blocker-Audit** `docs/audits/wave-24-alpha-blockers-status-2026-05-21.md`: 7 von 8 Findings aus dem 2026-05-18 Overnight-Audit sind in Waves 23/24 abgearbeitet; 1 PARTIAL (refresh_token-Spalten-Kommentar — in PR korrigiert); 0 OPEN.
- **Pilot-Readiness-Gate-Script** erweitert um B1/B2/B3/B4/C1/D1-Checks. Künftige RBAC-Verschärfungen, die einen dieser Wave-24-Contracts brechen, fallen am Pre-Merge-Gate auf.
- **27 neue Vitest-Tests** in 2 Files (`wave-24-block-b.test.ts` + `wave-24-block-c-d.test.ts`) plus skipped Integration-Test (`findings-fk-persistence.test.ts`) als Harness für A1's Live-Trace-Run.
- **AES-GCM-Tamper-Test entflakt** (PR #219): Test ist seit Einführung 1-von-16 rot wegen `.replace(/.$/, "0")`-No-Op wenn Ciphertext auf `'0'` endet. Jetzt XOR-Flip des ersten authTag-Nibbles → 0% Flake-Rate.

### Wave-23 — CLOSED: alle 3 Acceptance-Items live auf prod verifiziert (2026-05-17)

Wave 23 ist geschlossen. Sechs PRs (#167 → #172), drei live-verifizierte Acceptance-Items, plus zwei weitere Drift-Klassen entdeckt + permanent geschlossen:

**Live-Verification gegen `arctos.charliehund.de` (2026-05-17):**

```
A1  finding controlId persistence    ✅  POST 201 + GET-back: controlId matches input
A2  /admin/branding never 500        ✅  HTTP 200 + {reportTemplate:"standard", source:"defaults"}
C3  /contracts name→title alias      ✅  POST 201 + title aus name-Alias übernommen
/api/v1/meta/build (D1)              ✅  HTTP 200 JSON
audit_log hash_version distribution  ✅  50 231 / 50 231 v3 (zero v0/v1/v2)
```

**Was Wave 23 zusätzlich ans Licht gebracht hat (jenseits der ursprünglichen 3 Items):**

1. **Audit-Hash-TZ-Drift** (29 241 v0-Entries auf prod) — W23.2 → v3-Formula `to_char(... AT TIME ZONE 'UTC', ...)` + Migration 0328 rehashed alle 50 231 Entries. Plus migrate-all-Fix für stripped `BEGIN/COMMIT` aus 8 älteren Migrationen + `SET LOCAL TIME ZONE 'UTC'` als Standard.
2. **Next.js Private-Folder-Convention** — W23.3 → Rename `_meta` → `meta`. Root-cause war NICHT "Container ist alt" sondern "Route wurde von Next.js App Router silently aus der Routing-Tabelle gestrichen". ~12 h Debugging um eine 4-Zeichen-Verzeichnis-Namensregel.
3. **org_branding Schema-Drift** (A2 root-cause) — W23.5 → Migration 0329 backfilled missing `report_template` Column via `ADD COLUMN IF NOT EXISTS`. Identische Failure-Klasse wie Wave-22 für A1 hypothesizte, nur auf einer anderen Tabelle.
4. **GIT_SHA in local-build** — W23.4 → `deploy/update-all.sh` passt `--build-arg GIT_SHA=...` an, damit der prod-host-build (nicht nur CI) den realen Commit-SHA in `/meta/build` ausgibt.

### Wave-23.5 — A2 Schema-Backfill (`org_branding.report_template`) (2026-05-17)

Während der live-A2-Verifikation auf prod (2026-05-17) zeigte sich der echte A2-Root-Cause: die `org_branding`-Tabelle auf prod hatte die `report_template`-Spalte nicht (Drizzle-Schema + Migration 0024 deklarierten sie, aber `\d org_branding` listete sie nicht). Vermutete Sequenz: prod hat eine frühere Version von 0024 (vor Spalten-Add) angewandt, die Tabelle wurde ohne `report_template` erstellt, und erneutes Ausführen von 0024 schlug stillschweigend an "table already exists" fehl — neue Spalte erreichte die laufende Tabelle nie.

Fix: neue Migration `0329_org_branding_add_report_template.sql` mit `CREATE TYPE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS report_template branding_template_style NOT NULL DEFAULT 'standard'`. Idempotent — no-op auf frisch-erstellter DB, fügt Spalte auf drift-DB hinzu.

Diagnose-Sequenz die diesen Bug aufdeckte (nur möglich durch W23 + W23.1 + W23.3 Stack):

1. W23 wrappte branding-Route in `withErrorHandler` → empty 500 wurde RFC-7807 mit RequestID
2. W23.1 + W23.3 machten `/api/v1/meta/build` self-service → Verifikation welcher Build live ist
3. `docker logs arctos-web-1 | grep <requestId>` zeigte die Drizzle-`Failed query` mit dem genauen SELECT-Statement → `report_template` in SELECT-Liste, aber `\d org_branding` zeigte: Spalte fehlt

Live-acceptance nach Deploy: `GET /admin/branding` → 200 mit `{reportTemplate:"standard", source:"defaults"}`.

### Wave-23.4 — `arctos-update` passes GIT_SHA/BRANCH/BUILD_TIME (2026-05-17)

Nach W23.3 (Routing-Fix) lieferte `/api/v1/meta/build` zwar HTTP 200 mit JSON, aber `commitSha`/`branch`/`builtAt` alle `"unknown"`. Cause: Dockerfile (W23.1) deklariert `ARG GIT_SHA/GIT_BRANCH/BUILD_TIME` mit Default `"unknown"`. CI passt diese via `docker/build-push-action.with.build-args` weiter, aber der local-build-Pfad in `update-all.sh` benutzte bare `docker compose build web worker` — keine build-args, defaults applied.

Fix: `deploy/update-all.sh` Step `[2/5]` exported jetzt `GIT_SHA`/`GIT_BRANCH`/`BUILD_TIME` aus dem just-pulled Checkout und passt sie als `--build-arg` an `docker compose build`. Same source-of-truth (checked-out HEAD) für CI und prod-host. Nach einem `arctos-update` mit diesem Fix in place liefert `/api/v1/meta/build` den realen Commit-SHA.

### Wave-23.3 — Rename `/api/v1/_meta` → `/api/v1/meta` (Next.js private-folder) (2026-05-16)

Wave-23 prod-deploy-verification zeigte: trotz cleanem `docker compose build --no-cache` + force-recreate lieferte `curl /api/v1/_meta/build` HTML 404. Die Route-Datei war auf Disk, im Build-Context, im kompilierten `.next/standalone`-Output — aber Next.js' `app-paths-manifest` registrierte den Pfad nie.

Root-cause: Next.js App Router behandelt Folders mit `_`-Prefix als **PRIVATE folders, vom Routing ausgeschlossen**. Originale `_meta`-Wahl war falsch. ([Next.js Docs: private folders](https://nextjs.org/docs/app/building-your-application/routing/colocation#private-folders))

Fix: Rename `_meta` → `meta` in lockstep über alle 6 Call-Sites:

- `apps/web/src/app/api/v1/_meta/*` → `apps/web/src/app/api/v1/meta/*` (git mv)
- `middleware.ts` public-allowlist
- `scripts/pilot-readiness-gate.sh` build-info URL
- `apps/web/src/__tests__/api/meta-build.test.ts` import + Request URL
- CHANGELOG, STATUS.md

### Wave-23.2 — Audit-Hash v3 (TZ-invariant) + Migrate-All Fix (2026-05-16)

Discovered during Wave-23 prod-diagnose (D2 against the live DB,
2026-05-16): the audit_log on production has **29 241 v0 entries**
that migration 0312 was supposed to rehash to v2 but doesn't, even
after multiple `migrate-all` runs. Root-cause two interacting bugs:

1. **Hash formula is session-timezone-sensitive.** `compute_audit_hash_v1`
   and `_v2` both feed `created_at::text` into SHA-256. `timestamptz`
   cast to text renders in the SESSION timezone, not UTC. Hetzner's
   Postgres cluster default is `Europe/Berlin`; CI containers run UTC.
   Migration 0311's retag recomputes hashes from current row data, so
   on each deploy in a different TZ the same row's recomputed hash
   doesn't match the stored hash → tagged `hash_version = 0`.

2. **`migrate-all.ts`'s per-file transaction conflicts with
   migrations that wrap themselves in `BEGIN; ... COMMIT;`.**
   `client.begin(...)` already provides the boundary; the inner
   `COMMIT` ends the outer transaction prematurely. Subsequent
   statements (the rehash loop in 0312, the `ALTER TABLE … ENABLE
TRIGGER` restore) execute outside any transaction. Any error
   (e.g. ownership-required `ALTER TABLE DISABLE TRIGGER` failing
   silently) leaves the rehash half-done and unrecoverable.

**Fix:**

- **`packages/db/src/migrate-all.ts`** strips file-level `BEGIN;`
  / `COMMIT;` / `ROLLBACK;` before executing, and sets
  `SET LOCAL TIME ZONE 'UTC'` at the start of every transaction.
  Retroactive cleanup for the 8+ hand-written migrations that use
  explicit transaction blocks. UTC-pinning eliminates TZ drift even
  before v3 lands.
- **`packages/db/drizzle/0327_audit_hash_v3_tz_invariant.sql`**
  introduces `compute_audit_hash_v3()`, which formats `created_at`
  as `to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
  — byte-identical regardless of session TZ. Redeploys
  `audit_trigger()` to write `hash_version = 3` for all NEW entries
  and chain off the latest v3 row in the per-tenant scope.
- **`packages/db/drizzle/0328_audit_chain_rehash_to_v3.sql`** is a
  one-time chain rewrite. Per-tenant, in `created_at` order:
  recompute each row's hash under v3, set `hash_version = 3`,
  carry the new hash forward as the next row's `previous_hash`.
  Writes one `hash_repair_v3` audit entry per tenant capturing
  `repaired_count` + `from_versions` + first/last id in metadata —
  preserves the forensic trail per ADR-011 rev.3. **Idempotent:**
  short-circuits to NO-OP when 0 non-v3 rows remain.
- **`apps/web/src/app/api/v1/audit-log/integrity/route.ts`** gains
  a v3 branch in the recompute CASE (identical formula as 0327).
  Response shape: `verified.{v1, v2, v3}` instead of just `{v1, v2}`.
  Warning remedy text now points at 0327 + 0328 instead of the
  non-idempotent 0312.
- **`packages/db/tests/integration/audit-hash-v3-tz-invariance.test.ts`**
  asserts `compute_audit_hash_v3(row, …)` is byte-identical between
  a `SET LOCAL TIME ZONE 'UTC'` session and a `SET LOCAL TIME ZONE
'Europe/Berlin'` session, and documents that v2 is NOT (to prevent
  a future refactor from "fixing" v2 and breaking historic
  verification of legacy backups).

**Sensitive change.** This migration rewrites every audit_log
entry's `entry_hash` and `previous_hash`. ADR-011 rev.3 explicitly
carves out this one-time hash_repair action. After deploy, expect
the integrity endpoint to report `verified.v3 = total` and
`skipped.v0_broken = 0`. Any external pre-hash-repair proofs need
re-anchoring (the `hash_repair_v3` audit entry per tenant has the
metadata to do this).

### Wave-23 — Endgame: Pilot-Readiness-Gate + A1/A2/C3-Hardening (2026-05-16)

Wave 22 (siehe Eintrag unten) hat festgestellt: A1 + A2 haben **korrekten Repo-Code, falsches Production-Behavior** — d. h. Deploy-/Migration-Drift, kein Code-Bug. Wave 23 ist der Endgame-Cycle, der genau das zur Unmöglichkeit macht: harte Defence-in-Depth in den Routen + ein CI-Gate, das den nächsten Merge blockt, wenn die Acceptance-Tests gegen Staging nicht grün sind.

**Diagnose-Pflicht (D1–D4 aus `claude-code-wave23-prompt.md`)** — die D1–D4-Schritte stehen jetzt als Self-Service zur Verfügung statt SSH-Pflicht für jeden Operator zu erfordern:

- **D1 (Prod-Commit-SHA):** Neuer Endpoint `GET /api/v1/meta/build` exposes
  `{ commitSha, branch, builtAt, nodeVersion, runtimeUptimeSeconds }`.
  `curl https://arctos.charliehund.de/api/v1/meta/build | jq -r .data.commitSha`
  vs. `git rev-parse origin/main` macht den SHA-Vergleich ohne SSH möglich.
- **D2 (Prod-DB-Schema):** Bereits abgedeckt durch das Wave-22-Test-File
  `packages/db/tests/integration/schema-drift-finding-fk.test.ts` — kann
  gegen Prod via `INTEGRATION_DATABASE_URL=…` gelaufen werden und
  failed loud, wenn `finding.control_id|audit_id|risk_id|control_test_id`
  fehlen.
- **D3 (Drizzle-Insert-Trace):** Statt temporärem `console.log` in einem
  Hotfix-Deploy: die POST-Route hardcheckt jetzt die Insert-Result-Row
  gegen die Input-FKs und wirft eine strukturierte 500 mit
  `mismatchedFields: [{field, expected, actual}]`, wenn ein non-null FK
  als null zurückkommt. Der Bug-Modus "201 + null FKs" ist damit
  unmöglich — er manifestiert sich als laute 500 mit Diagnostic-Body
  statt als stiller Datenverlust.
- **D4 (A2 RequestID-Stack-Trace):** Ohnehin wrappen jetzt
  `withErrorHandler` POST + GET der `branding`-Route, jeder 500 trägt
  RequestID + ist im Logger-Index korrellierbar (war Wave-19-Stand für
  GET, jetzt auch POST).

**W23-A1 — Finding FK-Persistenz-Hardening:**

- POST jetzt in `withErrorHandler` gewrappt → uncaught Exceptions werden
  RFC-7807 problem+json mit RequestID statt empty 500.
- **Post-Insert-Verifikation**: nach dem `tx.insert(finding).returning()`
  vergleicht der Handler die Returning-Row mit dem `body.data`-Input
  für `controlId`/`auditId`/`riskId`/`controlTestId`. Wenn ein FK
  gesendet wurde aber als null zurückkommt — wirft sofort eine
  strukturierte Exception mit `{field, expected, actual}`, die der
  api-wrapper zu einer 500 mit Diagnostic-Body mappt. Eliminiert die
  "stiller Datenverlust unter 201"-Failure-Klasse permanent.
- Neue integration-test
  `apps/web/src/__tests__/integration/findings-fk-roundtrip.test.ts`:
  POST /findings mit allen 4 FKs → GET zurück → assertEqual auf jedes
  FK. Läuft gegen Live-DB im integration-tests CI-Job.

**W23-A2 — `/admin/branding` 500-Hardening:**

- POST der `branding`-Route wird jetzt auch in `withErrorHandler`
  gewrappt (GET war es seit Wave 19). Beide Verben antworten unter
  allen Failure-Modi mit RFC-7807 problem+json.
- Neuer acceptance-test
  `apps/web/src/__tests__/api/admin-branding-status.test.ts`: GET muss
  immer 200 (mit Defaults oder stored Row) oder 501 (Feature
  abgeschaltet) liefern, **niemals 500**. PUT mit ungültigem Hex-Color
  muss 422 liefern, niemals 500.

**W23-C3 — Contract `name → title` Alias-Härtung:**

- POST jetzt in `withErrorHandler` gewrappt → empty-500-Body unmöglich.
  Der Wave-22-Alias (`packages/shared/src/schemas/tprm.ts:526`) wirkt
  wie geplant; jeder Schema-Reject ist 422 mit Field-Errors, jeder
  Drizzle-/SQL-Crash 500 mit RequestID + structured Body.
- Neuer acceptance-test
  `apps/web/src/__tests__/api/contracts-name-alias-status.test.ts`:
  POST mit `{name:'X'}` darf weder 500 noch leeres-Body-500 liefern;
  201 mit Warning-Header oder 422 mit Field-Hint sind beide akzeptabel,
  500 ist verboten.

**Pilot-Readiness-Gate (CI-Pre-Merge-Check):**

- Neues Script `scripts/pilot-readiness-gate.sh` läuft die A1/A2/C3
  Acceptance-Probes plus Hash-Chain-Integrity gegen einen `STAGING_URL`
  (env-var). Exit 0 = grün, exit 1 = rot mit Detail-Output.
- Neuer CI-Job `pilot-readiness-gate` in `.github/workflows/ci.yml`:
  läuft auf jeder PR auf `main`, `needs: [build, integration-tests]`,
  ist `required` für Merge-Freigabe. Auf push zu `main` wird der Job
  geskipped (er checkt Staging-Behavior, nicht Repo-State).
- `STAGING_URL` + `STAGING_ADMIN_PASSWORD` sind Repo-Secrets; falls
  nicht gesetzt skipped der Job mit Status "skipped" (nicht "failed"),
  damit Forks/PRs aus externen Quellen nicht hart blocken.

**Hash-Chain-Stand:** healthy v1=1229 v2=513 total=1742 mismatches=0
(unverändert von Wave 22 — Wave 23 berührt keine Audit-Trigger).

### Wave-22 — Deploy-flow follow-up (2026-05-15)

After the first `arctos-update` post-merge, verification revealed that
two seeds shipped in PRs #160/#163 weren't being loaded by the prod
update flow:

- `seed_esrs_datapoints.sql` (B2 — 65 ESRS datapoints) — file pattern
  doesn't match the `seed_catalog_*` glob in `seed-catalogs.sh`
- `seed_demo_13_programmes.sql` (B6 — 2 programme journeys) — demo data,
  not loaded by the prod updater
- Plus a missing dependency: `seedProgrammeTemplates()` had to run
  before the journey demo file because the journeys join on
  `programme_template.code` (Wave-22 verifier reported only 1 of 2
  programmes seeded — the second template wasn't there yet).

Added `[3c/5]` step to `deploy/update-all.sh` that runs all three
idempotently after the migration loop:

1. `seed_esrs_datapoints.sql` against grc_platform AND every tenant DB
   (reference data, not demo)
2. `seedProgrammeTemplates()` via the `worker` container's tsx (the
   `web` Docker image only copies `packages/db/{drizzle,sql}` — not
   `packages/db/src/`, so the TS seeder must run from the worker
   image which has `COPY . .`)
3. `seed_demo_13_programmes.sql` against grc_platform only (demo data;
   tenants create programmes manually)

All three steps are idempotent (`ON CONFLICT DO NOTHING`) and safe to
re-run on every update — costs ~5 seconds when nothing changed.

### Wave-22 — HotFix after Wave-21 verification (2026-05-15)

Wave-21 verification (`docs/qa-reports/arctos-qa-verification-2026-05-15-wave21.md`)
reported 6✅ / 3🟡 / 6🔴 across 15 items. Most of the green items
were the Wave-21 ones I shipped. The reds split into:

- **A1+A2** — already-correct repo code that doesn't match production
  behavior (deploy/migration drift)
- **B4** — actual code bug I introduced in PR #162
- **B2/B6/B7/C3** — missing seed data + missing schema alias

This PR fixes the items addressable in code. A1+A2 need a deploy +
migration verification step on the production environment (documented
in the PR description and pinned by the new schema-drift test).

- **W22-B4 — bulk-create SQL error**: `POST /risks/bulk` was inserting
  `work_item.type_key = 'single_risk'` but the seeded enum value is
  just `'risk'` (per `0005_nostalgic_smiling_tiger.sql`). The single
  POST `/risks/route.ts` uses `'risk'`; the bulk route was inconsistent.
  Fixed.
- **W22-C3 — `name → title` contract alias**: PR #160 added Warning
  headers for the deprecated `name` field but the Zod schema still
  rejected it. Added the alias to `aliasContractInput` preprocess
  (`packages/shared/src/schemas/tprm.ts`) so `POST /contracts {name}`
  now succeeds AND emits the deprecation warning. 2 new vitests pin
  the contract.
- **W22-B6 — programmes demo seed**: New
  `packages/db/sql/seed_demo_13_programmes.sql` adds 2 programme
  journey instances per Meridian (ISO 27001 Cert 2026 + DSGVO Roadmap
  2026). Wired into `seed-all.ts` as Phase 2.6 — runs AFTER the
  programme-templates Phase 2.5 so FK lookups resolve.
- **W22-B7 — second-org RBAC users**: New migration
  `0326_seed_arctistx_rbac_users.sql` adds 3 logins for the Arctis
  Textilservice org (ciso, process_owner, contract_manager) plus 3
  risks owned by that org. Unblocks the cross-tenant RLS probe suite
  with real session cookies (Wave-21 reported `ciso@arctistx.test → 401`
  because the user wasn't seeded).
- **W22-B2/A1/A2 — diagnostic tests**: New
  `packages/db/tests/unit/schema-drift-finding-fk.test.ts` runs against
  the live DB and FAILS LOUDLY if `finding.control_id`/`audit_id`/
  `risk_id`/`control_test_id` columns are missing OR if `org_branding`
  table doesn't exist. Includes a raw INSERT/SELECT round-trip that
  isolates schema-drift from app-layer bugs. New
  `packages/db/tests/unit/seed-wiring.test.ts` pins that
  `seed-all.ts` still references the ESG datapoints + programmes
  seeds + the W22 migration — so a future "tidy up" PR doesn't
  silently revert them.

### Deploy-verification needed for A1 + A2

Wave-21 verification's hypothesis is correct: the route handler
`apps/web/src/app/api/v1/findings/route.ts` lines 122-141 already
passes `controlId`/`auditId`/`riskId`/`controlTestId` through to the
INSERT. The Drizzle schema (`packages/db/src/schema/control.ts:328`)
has all four columns. The status strict-reject IS deployed — but the
parallel FK-passthrough fix is not visible in production behavior.

**Recommended ops steps before re-verification**:

1. `git rev-parse HEAD` on the production checkout — does it match
   `2537c3a1` (Wave-21 merge) or earlier?
2. `\d finding` in psql — does the production DB actually have the
   `control_id`, `audit_id`, `risk_id`, `control_test_id` columns?
3. Run `cd packages/db && npm run migrate` to apply any pending
   migrations.
4. Run `cd packages/db && npm run seed:all` to load the new ESG +
   programme seeds.
5. Re-run the schema-drift vitest above against the live DB:
   `INTEGRATION_DATABASE_URL=… npx vitest run packages/db/tests/unit/schema-drift-finding-fk.test.ts`

### Wave-21 — Pilot-Ready Closure (2026-05-15)

Closes the 10 Black-Box-Items from `claude-code-wave21-prompt.md`. The
2 Beta-Blockers (A1 finding cross-module persistence, A2 /admin/branding 500) were already shipped in PR #159; Wave-21 QA hadn't seen the merge
when it ran the verification. The remaining items are NEW endpoints,
NEW seeds, and the PDF format-param bug — none of these existed yet.

- **B1 — `GET /api/v1/ai/router/health`** (NEW): public health probe
  for the multi-provider AI router. Returns provider availability +
  privacy-tier routing matrix (public/internal/confidential/restricted)
  - last-failover timestamp. `?probe=true` runs a 1-token completion
    per provider with 5s timeout for live latency. 5 vitests pin the
    contract.
- **B3 — `GET /compliance/frameworks` + `/compliance/frameworks/[code]`**
  (NEW): public discovery for the 46 seeded compliance frameworks.
  Returns `{id, code, name, type, version, controlCount, targetModules}`
  for each framework; the detail route includes the catalog_entry list
  (paginated, max 500 per call). Optional `?targetModule=isms` and
  `?type=control` filters narrow the result.
- **B4 — Bulk-create endpoints for risks / controls / findings**
  (NEW): `POST /{entity}/bulk` with `{items: [...]}` body, capped at
  100 items per request (Critical Implementation Rule #11). Returns
  201 + `{created: [...], errors: []}` on full success; 207
  Multi-Status when mixed (per-item errors include the index). New
  `apps/web/src/lib/bulk.ts` helper standardizes the validation +
  per-item audit-wrapped transaction pattern. 6 vitests cover cap
  enforcement, exact-100 boundary, mixed validity, empty body, and
  per-item audit-log entries.
- **B5 — `/dms/documents` canonical alias** (NEW): the DMS
  implementation lives at `/api/v1/documents/**`; Wave-21 QA found
  that `/api/v1/dms/documents` returned 404 even though the module
  is named `dms`. Added an alias route that re-exports the same
  GET + POST handlers, so both paths work without duplication.
- **B7 — Multi-entity cross-tenant RLS API probe** (NEW): extended
  Wave-19-W8's single-entity (risks) probe to a parametric test
  across risks/controls/findings. Pins that GET `/{entity}/[id]`
  returns 404 (not 403 / 200) when the row exists in another
  tenant — and the response body never echoes the foreign tenant ID
  (side-channel guard).
- **B8 — Multi-entity notification triggers** (NEW): parametric test
  covering risks/findings/controls. Each entity's POST with
  `{ownerId: <other-user>}` must insert a notification row with
  `channel: 'both'`, `entityType` matching the entity, `userId`
  matching the assignee, and a non-empty `templateKey` (so the
  worker dispatcher can pick the right React-Email template).
- **B9 — `GET /export/{entityType}?format=pdf` actually returns PDF**
  (BUG FIX): the export-engine's `case "pdf"` was falling through to
  CSV silently. Wired up the existing `renderStructuredPdfBuffer`
  from `apps/web/src/lib/pdf.ts` to produce structured PDF output
  with the entity's columns as a table. 4 vitests cover all three
  formats (csv/xlsx/pdf) + the magic-byte assertion for each.

### Wave-21 — Already Shipped (verified)

The 2 P0 Beta-Blockers from the spec were already addressed in PR #159
and verified in this PR:

- **A1 — Finding cross-module persistence**: `controlId`, `auditId`,
  `riskId`, `controlTestId` all persist via POST `/findings` (lines
  131-134 of route.ts). `processId` is NOT in the schema (findings
  link to processes via control or task — no direct FK). Status
  field is strict-rejected with 422 + helpful message pointing to
  the dedicated transition endpoint.
- **A2 — `/admin/branding` 500 → 200**: `withReadContext` wrapper
  sets `app.current_org_id` GUC; defensive 42P01 catch falls back
  to defaults for pre-Sprint-13a deployments.

### Wave-21 — Out of Scope (already shipped in earlier PRs)

- **B2 — ESG datapoints seed** — wired into `seed-all.ts` in PR #160;
  `GET /esg/datapoints` returns the 65 ESRS datapoints. Already
  covered.
- **B6 — Programmes maturity auto-compute** — full CMMI-derived
  maturity computation shipped in PR #158 (Wave 22). Already covered.
- **B10 — Academy enrollment flow** — pinned in PR #161
  (`academy-enrollment-flow.test.ts`, 5 vitests). Already covered.
- **C1 — Playwright UI form tests** — Risk-form proof-of-concept
  shipped in PR #161; pattern documented for the other 6 forms.
- **C2 — Performance baseline** — k6 harness + methodology doc
  shipped in PR #161 (`docs/performance/wave19-baseline.md`).
- **C3 — Contract backwards-compat Warning headers** — shipped in
  PR #160.

### Wave-19 — Cascade Completion (2026-05-15)

- **Finding cross-module-link persistence (W19-P1-01)**: `POST /api/v1/findings`
  with `controlId` / `auditId` / `riskId` / `controlTestId` now reliably
  persists every FK; the inline `updateFindingSchema` in `[id]/route.ts`
  was lifted to `packages/shared` so the canonical severity enum (with
  the ISO-19011 values) stops drifting between POST and PUT/PATCH paths.
  `PATCH /api/v1/findings/{id}` is now a real route (was 405). New
  vitest guards in `apps/web/src/__tests__/api/findings-cross-module-links.test.ts`
  pin the contract.
- **Finding status strict-reject (W19-P1-01)**: `POST /findings {status: ...}`
  now returns 422 with `rejectedFields: ["status"]` and a hint pointing
  at the dedicated transition endpoint, instead of silently stripping
  the field and letting the `identified` DB default win.
- **CISO can raise findings (W19-P3-02)**: `ciso` added to the role list
  in `POST /findings`. RBAC test suite updated.
- **`/admin/branding` 500 → 200 (W19-P2-01)**: `GET` now runs through
  `withReadContext` so the RLS GUC `app.current_org_id` is set before
  the query; otherwise the policy filtered every row and (depending on
  pg version + driver) raised a cast error on the empty-string GUC.
  Catches PG `42P01` (undefined_table) and falls back to defaults so
  pre-Sprint-13a deployments stop returning 500.
- **Contract drift Warning headers (W19-P3-01)**: `POST /contracts`
  now emits an RFC-7234 `Warning: 299` header for every deprecated
  alias the caller used (`value` → `totalValue`, `startDate` →
  `effectiveDate`, `endDate` → `expirationDate`, `name` → `title`).
  Aliases stay accepted for v0.2 to give frontend / integration
  consumers a runway; the headers are the live migration signal.
  Removal in v0.3.0 has been pre-announced.
- **ESG-datapoints discovery + seed wired (W19-P3-03)**: New endpoint
  `GET /esg/datapoints` returns the 65 ESRS datapoints (E1-E5, S1-S4,
  G1) with optional `esrsStandard` + `mandatory` filters and a
  `byStandard` grouping for the picker UI. `seed_esrs_datapoints.sql`
  is now part of `seed-all.ts` REFERENCE_SEEDS — without it
  `POST /esg/metrics` 422'd with `{datapointId:['Required']}`.
- **Bulk-cap contract test extended (W19-N8)**: `bulk-cap-contract.test.ts`
  now covers the `bulkMeasurementImportSchema` 500-item cap (intentional
  ESG ingestion-tier exception) plus an absence-anchor test that
  documents that risks/controls/findings/treatments still have no
  bulk endpoints — if a future `/risks/bulk` is added it MUST follow
  the Critical Rule #11 default of `.max(100)`.
- **BIA gate blocker route guards (W19-W6)**: New
  `apps/web/src/__tests__/api/bcms-bia-gates.test.ts` locks the
  Gate-B1 (Setup) + Gate-B2 (Coverage) blocker contract at the route
  layer:
  - `/start` returns 422 + `missing_lead_assessor` when the snapshot
    is incomplete and never proceeds to the audit-wrapped status update.
  - `/finalize` returns 422 + `no_process_impacts` when zero impacts
    are attached, and `score_coverage_below_threshold` at < 80%
    scored MTPD/RTO/RPO.
  - Wrong-status invocations (`/finalize` from `draft`) and missing
    BIA (404) are explicitly pinned.
- **HinSchG isolation — admin removed from case-content endpoints
  (W19-W7)**: All six `/whistleblowing/cases/**` routes (`cases` GET,
  `cases/[id]` GET, `assign`, `acknowledge`, `message`, `resolve`)
  now reject `admin` per HinSchG §10/§11 + GDPR Art. 9(2)(b). Sole
  access: `whistleblowing_officer`, `ombudsperson`. Same applies to
  `/investigations` and `/protection`; `auditor` is retained on those
  for LoD3 oversight (assurance the channel exists + works without
  exposing case-content). `/statistics` deliberately keeps admin
  access — anonymized aggregate counts only, no case content. New
  `whistleblowing-hinschg-isolation.test.ts` (9 tests) pins the
  contract.

### Wave-19 Closure — Round 2 (Workflow + Hardening; 2026-05-15)

Closes the remaining 10 items from `claude-code-wave19-full-closure-prompt.md`.
The previous merge (#160) covered Block 1 + 2; this round closes Block 3
workflow gaps + Block 4 hardening.

- **W19-W5 — Incident NIST-7-state walk + DSGVO Art. 33 72h timer**:
  Pinned the `incidentStatusTransitions` matrix (detected →
  triaged → contained → eradicated → recovered → lessons_learned →
  closed; closed → detected re-open) and the `computeBreachDeadline`
  72h math (green/yellow/orange/red urgency boundaries) with 16
  vitests in `packages/shared/tests/incident-lifecycle-w19-w5.test.ts`.
  Catches matrix-shrink regressions and timezone bugs in the deadline
  countdown.
- **W19-W8 — RLS API-layer cross-tenant probe**: New
  `apps/web/src/__tests__/api/rls-cross-tenant-api-probe.test.ts`
  pins that `GET /risks/{id}` returns 404 (not 403, not 200, not 500)
  when the row exists in another tenant. Complements the existing
  DB-layer RLS coverage in `packages/db/tests/rls/`. Verifies the 404
  response body does not leak the tenant ID (side-channel guard).
- **W19-W9 — Notification trigger contract**: New
  `notification-trigger.test.ts` pins `POST /risks {ownerId: <other>}`
  → inserts a notification row with `channel: 'both'` (in-app + email),
  `templateKey: 'risk_owner_assigned'`, and the right templateData
  shape. Guards: self-assignment skipped, invalid-owner 422 produces
  no notification leak.
- **W19-W10 — PDF output contract** (PDF/A-2b deferred): 7 vitests
  on the current pdfkit output (magic bytes, %%EOF marker, Info
  dictionary entries, filename sanitization, null-cell + empty-section
  rendering). Full PDF/A-2b conformance documented in
  `docs/qa-reports/wave19-pdf-a-followup.md` as W20-PDF-A-01 (needs
  Ghostscript post-process or a library swap; out of scope for v0.2).
- **W19-N1 — Playwright UI form validation (proof-of-concept)**: Risk
  form 5-step spec in `tests/e2e/regression/n-01-risk-form-validation.spec.ts`
  covers required-field validation, happy-path submit, server-rejected
  enum, persistence across reload. Pattern documented inline for
  extending to the other 6 forms (Controls, Findings, DPIAs, Audits,
  Vendors, Contracts) as their selectors stabilize.
- **W19-N2 — AI Router multi-provider failover**: New
  `aiCompleteWithFailover(req, {fallbackProviders, timeoutMs, onAttempt})`
  wrapper in `packages/ai/src/router.ts`. Tries primary, falls back
  to chained providers on error or timeout, throws
  `AllProvidersFailedError` with per-attempt details when everything
  fails. Privacy override (Ollama for personal data) still wins over
  any explicit provider request. 7 vitests in
  `packages/ai/tests/router-failover.test.ts`. Existing `aiComplete`
  contract unchanged — old callers keep their behavior.
- **W19-N3 — Performance baseline harness**: 3 reproducible k6
  scripts in `scripts/perf/` (risks-list, controls-effectiveness,
  hash-chain-watch) with thresholds (P95 < 500ms / P95 < 1s /
  healthy=true) plus `docs/performance/wave19-baseline.md` with full
  methodology, run instructions, acceptance criteria, and a TODO
  results table for the first staging deployment to fill in.
- **W19-N5 — Cross-framework mapping spot-check**: New static-parse
  test in `packages/db/tests/unit/cross-framework-mapping-spot-check.test.ts`
  reads the 5 `seed_cross_framework_mappings*.sql` files, verifies
  total ≥ 900 mappings, every relationship is a known enum value,
  every confidence is 0..100, NIST-CSF ↔ ISO 27002 has ≥ 50 pairs,
  and 5 canonical pairs (e.g. `nist_csf_2:GV.PO-01 → iso27002_2022:A.5.1`)
  exist. 18 tests; runs offline (no DB needed).
- **W19-N6 — Academy enrollment flow**: 5 vitests in
  `apps/web/src/__tests__/api/academy-enrollment-flow.test.ts` cover
  POST /enrollments → PATCH /progress lifecycle. Pins the progress→
  status mapping (50 → in_progress; 100 → completed + completedAt
  timestamp), the orgId injection on insert, the 404 on
  cross-tenant access, and the Zod max(100) bound on progressPct.
- **W19-N7 — DMS multi-signer workflow**: Documented as out-of-scope
  for v0.2 in `docs/qa-reports/wave19-n7-dms-scope-decision.md`.
  Existing `/api/v1/documents/**` covers 4 of 5 spec items
  (CRUD, versions, audit-trail, entity-links, single-signer
  acknowledgment). True multi-signer + eIDAS QES is a vendor-or-build
  decision; tracked as W21-DMS-MULTISIGN-01.

### Contract-schema field-name history (W19-P3-01)

The contract input schema has renamed several fields across waves;
deployers should update API consumers accordingly. The current
canonical names are the right-hand column.

| Wave | Was         | Is               |
| ---- | ----------- | ---------------- |
| 14   | `value`     | `totalValue`     |
| 14   | `startDate` | `effectiveDate`  |
| 14   | `endDate`   | `expirationDate` |
| 16   | `name`      | `title`          |

The Wave-16 `value`/`startDate`/`endDate` aliases (preprocess) still
accept the natural REST names on input for backward-compat, but the
DB columns + GET-response keys are the canonical names. Tests in
`packages/shared/tests/tprm-schemas.test.ts` pin both directions.

### Added

- **ADR-014 Phase 3**: Schema-Stubs-Generator fuer 55 nicht-exportierte Tabellen (`scripts/generate-schema-stubs.mjs`, `packages/db/src/schema/_generated_stubs.ts`) ([`848897e`](../../commit/848897e))
- **ADR-014 Phase 4**: Performance-Audit-Tools ([`c5e7936`](../../commit/c5e7936))
  - `scripts/audit-n-plus-one.mjs` -- N+1-Query-Detektor (137 Kandidaten)
  - `scripts/audit-missing-indexes.mjs` -- Fehlende Indexe (1738 Vorschlaege, davon 53 RLS-High)
- TypeScript-Error-Audit (`scripts/audit-ts-errors.mjs`) + Quick-Wins: 120 -> 99 Fehler ([`bd5cc92`](../../commit/bd5cc92), [`9af795b`](../../commit/9af795b))
- i18n-Coverage-Audit (`scripts/audit-i18n-coverage.mjs`) + CI-Workflow `.github/workflows/i18n-coverage.yml` ([`baea99f`](../../commit/baea99f), [`fa0c7f4`](../../commit/fa0c7f4))
- Dead-Exports-Audit-Script (`scripts/audit-dead-exports.mjs`) ([`c0a0010`](../../commit/c0a0010))
- Compliance-Readiness-Checklisten ([`7329b76`](../../commit/7329b76))
  - `docs/compliance/iso-27001-readiness-checklist.md`
  - `docs/compliance/nis2-readiness-checklist.md`
  - `docs/compliance/gdpr-readiness-checklist.md`
- Contribution-Framework ([`1ed0a99`](../../commit/1ed0a99))
  - `CONTRIBUTING.md`, `CODEOWNERS`
  - `.github/pull_request_template.md`
  - `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`
- `docs/dr-playbook.md` -- 5 Disaster-Recovery-Szenarien mit RPO/RTO ([`2567ee5`](../../commit/2567ee5))
- `docs/env-vars-reference.md` -- 32 ARCTOS-Env-Vars dokumentiert ([`2567ee5`](../../commit/2567ee5))
- ADR-019: Rate-Limiting-Strategy (Proposed) ([`809931d`](../../commit/809931d))
- ADR-020: API-Versioning-Strategy (Proposed) ([`809931d`](../../commit/809931d))
- ADR-021: Error-Handling-Contract RFC 7807 (Proposed) ([`809931d`](../../commit/809931d))
- ADR-022: i18n-Namespace-Organisation (Accepted, post-hoc) ([`fa0c7f4`](../../commit/fa0c7f4))
- ADR-023: Migration-Rollback-Strategy (Proposed) ([`66d4eb4`](../../commit/66d4eb4))
- ADR-024: Search-Architecture (Postgres-FTS + pgvector) (Proposed) ([`9eb8f43`](../../commit/9eb8f43))
- Helper-Lib `apps/web/src/lib/api-errors.ts` -- RFC-7807-konforme Error-Responses (opt-in, ADR-021 Phase 1) ([`5552168`](../../commit/5552168))
- Helper-Lib `apps/web/src/lib/rate-limit.ts` -- Token-Bucket-Implementation (opt-in, ADR-019 Phase 1) ([`8dae463`](../../commit/8dae463))
- 15 Default Compliance-Calendar-Templates (0104) ([`bc42e12`](../../commit/bc42e12))
  - Management-Review Q1/Q3, Audit-Plan, DPIA-Review, Pentest, BIA, BCP-Exercise, Vendor-Review, SoA, Risk-Appetite, NIS2-Quarterly, GDPR-Breach-Register, CSRD-Datenerhebung, Security-Awareness-Training, Vuln-Scan-Monthly

### Fixed

- **F-08** Katalog-Duplikate entfernen + UNIQUE-Constraint (0102) ([`fce1ded`](../../commit/fce1ded))
- **F-13** Framework-Import-Dropdown dynamisch aus aktiven Katalogen ([`3fce806`](../../commit/3fce806))
- **F-14** Standalone Finding-Add-Button + auditId/riskId-Filter ([`5fc457e`](../../commit/5fc457e))
- **R-01** `/audit/findings` Route als Redirect ([`97aa502`](../../commit/97aa502))
- Risk-Link im Audit-Report: `/risks/{id}` (war: /erm/risks/{id}, 404) ([`a29af51`](../../commit/a29af51))
- i18n: `nav.tabs.ismsRisks` und `nav.tabs.cap` in EN ergaenzt ([`baea99f`](../../commit/baea99f))
- TS-Errors isoliert (120 -> 99): Skeleton-Import, Null-Guards in Predictive-Radar, ProtectionLevel-Casts in ISMS-Assets, CrisisScenario-Casts, Form-State-Access in AI-Act-Prohibited, t/rt-Signature in Dashboard ([`bd5cc92`](../../commit/bd5cc92), [`9af795b`](../../commit/9af795b))

### Security

- Secret-Scanning-Workflow `.github/workflows/secret-scanning.yml` + `scripts/audit-secrets.mjs` (ADR-018 Phase 0) ([`1a0913f`](../../commit/1a0913f))
- RLS-Coverage-Audit `scripts/audit-rls-coverage.mjs` (132 Tabellen ohne RLS, 52 ohne audit_trigger) ([`c1c7c60`](../../commit/c1c7c60))
- LoD-Coverage-Audit `scripts/audit-lod-coverage.mjs` (1606 Endpoints analysiert, 17 anonymous mutating -- alle legitim) ([`6a63133`](../../commit/6a63133))
- `GET /api/v1/audit-log/integrity` -- SHA-256 Hash-Chain-Verifikation (ADR-011) ([`d82eb4f`](../../commit/d82eb4f))
- `SECURITY.md` + Public Security-Policy ([`9ac971e`](../../commit/9ac971e))

### Changed

- **F-17** Migrationen aus `src/migrations/` auch ausfuehren + Dockerfile-COPY ([`f764147`](../../commit/f764147), [`47cfc47`](../../commit/47cfc47))
- **F-18** `/api/v1/health/schema-drift`-Endpoint fuer Drift-Detection ([`f764147`](../../commit/f764147))
- `/api/v1/health` -- public Liveness/Readiness-Probe ([`30cea4e`](../../commit/30cea4e))
- X-Request-ID-Header auf allen Responses ([`25bc6ca`](../../commit/25bc6ca))
- Structured JSON-Logger fuer Server-Code (`apps/web/src/lib/logger.ts`) ([`38d4943`](../../commit/38d4943))

### Removed

- Toter Clerk-Stub `packages/auth/src/middleware.ts` (nichts importierte ihn) ([`1ed24b7`](../../commit/1ed24b7))

### Infrastructure / Ops

- Off-Site-Backup via B2 ADR-015 + `deploy/offsite-sync.sh`/`-setup.sh` ([`9be914d`](../../commit/9be914d))
- `docs/runbook.md` + `docs/adr-index.md` ([`ea715b8`](../../commit/ea715b8))
- `docs/onboarding.md` (ADR-016 Companion) ([`fece0fb`](../../commit/fece0fb))
- `docs/architecture.md` mit 6 Mermaid-Diagrammen ([`228764c`](../../commit/228764c))
- `docs/feature-catalog.md` (Module + Framework-Coverage-Matrix) ([`1086b47`](../../commit/1086b47))
- `docs/openapi.yaml` (1034 Paths, 1606 Methoden) + Generator ([`66779db`](../../commit/66779db))
- CI-Workflows `migration-policy.yml` + `schema-drift.yml` ([`58dc04e`](../../commit/58dc04e))
- E2E-Tests: `tests/e2e/` Playwright-Suite mit 5 Specs ([`9b6718c`](../../commit/9b6718c))

---

## Format-Legende

- **Added** — neue Features
- **Changed** — Aenderungen an bestehenden Features
- **Deprecated** — bald entfernt
- **Removed** — jetzt entfernt
- **Fixed** — Bug-Fixes
- **Security** — sicherheitsrelevante Aenderungen
