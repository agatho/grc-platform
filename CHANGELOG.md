# Changelog

Nach Keep-a-Changelog (<https://keepachangelog.com/de/1.1.0/>).
Versionen folgen Calendar-Versioning (`YYYY.MM.DD` oder `YYYY.Q`) bis
ARCTOS 1.0 released wird; dann SemVer.

Unveroeffentlichte Aenderungen stehen unter `[Unreleased]`. Wenn ein
Deploy erfolgt, wird dieser Abschnitt umbenannt mit Datum und ein
neuer `[Unreleased]` eroeffnet.

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
