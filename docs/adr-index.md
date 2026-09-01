# ADR Index

All architecture decisions in chronological order. Each ADR links to full context + decision.

> **[ARCTOS-FULL-2026-08-31 / WP12 · S14-23/E1, E2, E3] Korrekturlauf 2026-09-01.**
> Der Index wich in beide Richtungen vom Bestand ab: er listete 001–024, aber im
> `docs/`-Verzeichnis liegen nur 15 ADR-Dateien (001–013 haben keine), er kannte
> die existierende **ADR-026 zur Hash-Chain-v3-Migration nicht** und vergab ihre
> Nummer unten ein zweites Mal an eine ungeschriebene ADR, und drei ADRs standen
> auf "Proposed", während ihre Entscheidung produktiv umgesetzt war. Die Spalte
> **Datei** unterscheidet jetzt zwischen "als Dokument vorhanden" und "nur als
> Zeile in diesem Index".

| #   | Title                                                                             | Status   | Date       | Datei |
| --- | --------------------------------------------------------------------------------- | -------- | ---------- | ----- |
| 001 | Multi-entity isolation via PostgreSQL RLS                                         | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 002 | Next.js 15 + React 19 + Tailwind + shadcn/ui — **im Einsatz ist Next.js 16.2.11** (S14-23/C13; ein rev.-Eintrag fehlt) | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 003 | Turborepo + npm workspaces monorepo                                               | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 004 | Claude API + Ollama for AI features                                               | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 005 | REST + OpenAPI 3.1 (API style)                                                    | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 006 | Drizzle ORM (type-safe, SQL-close)                                                | Accepted | 2026-03-22 | — (nur Index-Eintrag) |
| 007 | [Auth.js + Custom RBAC + Three Lines of Defense](./ADR-007-rev1.md) (rev. 1 replaces Clerk) | Accepted | 2026-03-23 | vorhanden (`ADR-007-rev1.md`) |
| 008 | Resend SDK + React Email Templates                                                | Accepted | 2026-03-24 | — (nur Index-Eintrag) |
| 009 | Hono.js for Worker (background jobs)                                              | Accepted | 2026-03-24 | — (nur Index-Eintrag) |
| 010 | Docker-only deployment (Hetzner)                                                  | Accepted | 2026-03-25 | — (nur Index-Eintrag) |
| 011 | [Append-only audit trail with SHA-256 hash chain](./ADR-011-rev3.md)              | Accepted | 2026-03-25, rev.3 | vorhanden (`ADR-011-rev2.md`, `ADR-011-rev3.md`) |
| 012 | Feature-flags via module_config (per-org)                                         | Accepted | 2026-03-27 | — (nur Index-Eintrag) |
| 013 | Generic catalog + catalog_entry (replaces typed risk/control catalogs)            | Accepted | 2026-04-01 | — (nur Index-Eintrag) |
| 014 | [DB Migration Policy: Drizzle-only](./ADR-014-migration-policy.md)                | Accepted | 2026-04-17 | vorhanden |
| 015 | [Off-Site Backup via Backblaze B2](./ADR-015-offsite-backup.md)                   | Accepted | 2026-04-18, rev. 2026-09-01 | vorhanden |
| 016 | [CI/CD Pipeline Architecture](./ADR-016-cicd-pipeline.md)                         | Accepted | 2026-04-18 | vorhanden |
| 017 | [Monitoring & Alerting Strategy](./ADR-017-monitoring.md)                         | Accepted | 2026-04-18 | vorhanden |
| 018 | [Secret Management](./ADR-018-secret-management.md)                               | Accepted | 2026-04-18 | vorhanden |
| 019 | [Rate-Limiting Strategy](./ADR-019-rate-limiting.md)                              | Accepted | 2026-04-18 (rev. WP9) | vorhanden |
| 020 | [API Versioning Strategy](./ADR-020-api-versioning.md)                            | Accepted | 2026-04-18, rev.2 2026-09-01 | vorhanden |
| 021 | [Error-Handling-Contract (RFC 7807)](./ADR-021-error-handling.md)                 | Accepted | 2026-04-18, rev.2 2026-09-01 | vorhanden |
| 022 | [i18n-Namespace-Organisation](./ADR-022-i18n-namespace-organization.md)           | Accepted | 2026-04-18 | vorhanden |
| 023 | [Migration-Rollback-Strategy](./ADR-023-migration-rollback.md)                    | Accepted | 2026-04-18, rev. 2026-09-01 | vorhanden |
| 024 | [Search Architecture (Postgres-FTS + pgvector)](./ADR-024-search-architecture.md) | Proposed | 2026-04-18 | vorhanden |
| 026 | [Hash-Chain v3 Migration](./ADR-026-hash-chain-v3-migration.md)                   | Accepted | 2026-05 | vorhanden |

## Companion Documents

- [architecture.md](./architecture.md) -- 6 Mermaid-Diagramme
- [feature-catalog.md](./feature-catalog.md) -- Module + Framework-Coverage-Matrix
- [runbook.md](./runbook.md) -- Normale Ops-Prozeduren
- [dr-playbook.md](./dr-playbook.md) -- 5 DR-Szenarien + Uebungs-Kalender
- [env-vars-reference.md](./env-vars-reference.md) -- 32 ARCTOS-Env-Vars
- [onboarding.md](./onboarding.md) -- Developer-Onboarding
- [openapi.yaml](./openapi.yaml) -- generiert aus dem Routenbaum; die
  aktuelle Pfad- und Operationszahl steht im Kopf von
  [API_REFERENCE.md](./API_REFERENCE.md) und wird bei jedem PR neu erzeugt.
  (Die frühere Angabe "1034 Paths, 1606 Methoden" war um 273 bzw. 338 zu
  niedrig und stand an vier Stellen im Repository — S14-23/A16.)

## Compliance-Readiness-Checklisten

- [compliance/iso-27001-readiness-checklist.md](./compliance/iso-27001-readiness-checklist.md)
- [compliance/nis2-readiness-checklist.md](./compliance/nis2-readiness-checklist.md)
- [compliance/gdpr-readiness-checklist.md](./compliance/gdpr-readiness-checklist.md)
- [compliance/dora-readiness-checklist.md](./compliance/dora-readiness-checklist.md)

## Security + Audit Reports (Continuous-Auditing-Suite)

Scripts unter `scripts/audit-*.mjs`, Outputs unter `docs/security/` + `docs/perf/`.

| Script                      | Output                                       | Zweck                                            |
| --------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `audit-rls-coverage.mjs`    | `docs/security/rls-coverage-report.md`       | Tabellen ohne RLS + audit_trigger                |
| `audit-lod-coverage.mjs`    | `docs/security/lod-coverage.md`              | API-Routen ohne withAuth + Role-Matrix           |
| `audit-secrets.mjs`         | `docs/security/secret-scan-report.md`        | Hardcoded Keys, Env-Leaks                        |
| `audit-missing-indexes.mjs` | `docs/perf/missing-indexes-report.md`        | FK- / RLS-Index-Kandidaten                       |
| `audit-n-plus-one.mjs`      | `docs/perf/n-plus-one-report.md`             | Loops mit Per-Iteration-DB-Call                  |
| `audit-ts-errors.mjs`       | `docs/perf/ts-errors-report.md`              | TypeScript-Error-Kategorisierung                 |
| `audit-i18n-coverage.mjs`   | `docs/i18n-coverage-report.md`               | DE/EN-Namespace-Parity                           |
| `audit-dead-exports.mjs`    | `docs/perf/dead-exports-report.md`           | Tote Exports (heuristisch)                       |
| `generate-schema-stubs.mjs` | `packages/db/src/schema/_generated_stubs.ts` | Drizzle-TS-Stubs fuer nicht-exportierte Tabellen |
| `generate-openapi.mjs`      | `docs/openapi.yaml`                          | OpenAPI 3.1 Spec aus Route-Scanner               |

## Cross-cutting notes

### Related Findings (from audit-test-2026-04-17)

| Finding                                    | Status                       | Fixed by                   |
| ------------------------------------------ | ---------------------------- | -------------------------- |
| F-04 useSession refresh                    | ✅ Fixed                     | `a9f4a2d`                  |
| F-05 Layout cookie-based orgId             | ✅ Fixed                     | `a9f4a2d`                  |
| F-06 Module auto-activate                  | ✅ Fixed                     | `a9f4a2d`                  |
| F-08 Catalog duplicates                    | ✅ Fixed                     | `fce1ded` (0102 migration) |
| F-09 7 pages using roles[0]                | ✅ Fixed                     | `8772099`                  |
| F-10 Copilot 500                           | ✅ Fixed indirectly via F-17 | `f764147`                  |
| F-11 Audit create enum violation           | ✅ Fixed                     | `dcbda3a`                  |
| F-13 Framework-Dropdown dynamic            | ✅ Fixed                     | `3fce806`                  |
| F-14 Standalone Finding-Add-Button         | ✅ Fixed                     | `5fc457e`                  |
| F-15 Checklist-generate from catalog_entry | ✅ Fixed                     | `eec3de7`                  |
| F-17 Migrations-Split                      | ✅ Fixed                     | `f764147` + `47cfc47`      |
| F-18 Schema-Drift-Endpoint                 | ✅ Fixed                     | `f764147`                  |
| F-20 Enhanced Audit Report                 | ✅ Fixed                     | `8439418`                  |
| F-21 Treatment-Plan Editor                 | ✅ Fixed                     | `8439418`                  |
| F-22 remediationPlan in findings GET       | ✅ Fixed                     | `71c2d0a`                  |
| R-01 /audit/findings 404                   | ✅ Fixed                     | `97aa502`                  |

### Pending ADRs (not yet written)

- ADR-025: File-Upload-Storage (Filesystem vs. S3-kompatibel vs. B2)
- ADR-027a: Performance-Testing-Strategy (k6 vs Artillery, target-RPS)
  <!-- [WP12 · S14-23/E1] Diese Zeile stand als "ADR-026" hier, während docs/ADR-026-hash-chain-v3-migration.md existiert, den Status Accepted trägt und in docs/STATUS.md als geltende Entscheidung zitiert wird. Die Nummer war also doppelt vergeben — an ein existierendes Dokument und an einen Wunsch. Umnummeriert, damit die nächste geschriebene ADR nicht dieselbe Kollision erzeugt. -->
- ADR-027: Webhooks + Events-Delivery-Guarantees

Contributions welcome -- each ADR should follow the established 7-section template (ID, Title, Status, Date, Context, Decision, Rationale, Consequences).
