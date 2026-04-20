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

- Alle 6 CI-Jobs blockierend: Lint & Type Check, DB Migration & Integrity,
  Unit Tests, Integration Tests, Security Audit, Build.
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
