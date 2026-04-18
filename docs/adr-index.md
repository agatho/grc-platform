# ADR Index

All architecture decisions in chronological order. Each ADR links to full context + decision.

| # | Title | Status | Date |
|---|---|---|---|
| 001 | Multi-entity isolation via PostgreSQL RLS | Accepted | 2026-03-22 |
| 002 | Next.js 15 + React 19 + Tailwind + shadcn/ui | Accepted | 2026-03-22 |
| 003 | Turborepo + npm workspaces monorepo | Accepted | 2026-03-22 |
| 004 | Claude API + Ollama for AI features | Accepted | 2026-03-22 |
| 005 | REST + OpenAPI 3.1 (API style) | Accepted | 2026-03-22 |
| 006 | Drizzle ORM (type-safe, SQL-close) | Accepted | 2026-03-22 |
| 007 | Auth.js + Custom RBAC + Three Lines of Defense (rev. 1 replaces Clerk) | Accepted | 2026-03-23 |
| 008 | Resend SDK + React Email Templates | Accepted | 2026-03-24 |
| 009 | Hono.js for Worker (background jobs) | Accepted | 2026-03-24 |
| 010 | Docker-only deployment (Hetzner) | Accepted | 2026-03-25 |
| 011 | Append-only audit trail with SHA-256 hash chain | Accepted | 2026-03-25 |
| 012 | Feature-flags via module_config (per-org) | Accepted | 2026-03-27 |
| 013 | Generic catalog + catalog_entry (replaces typed risk/control catalogs) | Accepted | 2026-04-01 |
| 014 | [DB Migration Policy: Drizzle-only](./ADR-014-migration-policy.md) | Accepted | 2026-04-17 |
| 015 | [Off-Site Backup via Backblaze B2](./ADR-015-offsite-backup.md) | Proposed | 2026-04-18 |

## Cross-cutting notes

### Related Findings (from audit-test-2026-04-17)

| Finding | Status | Fixed by |
|---|---|---|
| F-04 useSession refresh | ✅ Fixed | `a9f4a2d` |
| F-05 Layout cookie-based orgId | ✅ Fixed | `a9f4a2d` |
| F-06 Module auto-activate | ✅ Fixed | `a9f4a2d` |
| F-08 Catalog duplicates | ✅ Fixed | `fce1ded` (0102 migration) |
| F-09 7 pages using roles[0] | ✅ Fixed | `8772099` |
| F-10 Copilot 500 | ✅ Fixed indirectly via F-17 | `f764147` |
| F-11 Audit create enum violation | ✅ Fixed | `dcbda3a` |
| F-13 Framework-Dropdown dynamic | ✅ Fixed | `3fce806` |
| F-14 Standalone Finding-Add-Button | ✅ Fixed | `5fc457e` |
| F-15 Checklist-generate from catalog_entry | ✅ Fixed | `eec3de7` |
| F-17 Migrations-Split | ✅ Fixed | `f764147` + `47cfc47` |
| F-18 Schema-Drift-Endpoint | ✅ Fixed | `f764147` |
| F-20 Enhanced Audit Report | ✅ Fixed | `8439418` |
| F-21 Treatment-Plan Editor | ✅ Fixed | `8439418` |
| F-22 remediationPlan in findings GET | ✅ Fixed | `71c2d0a` |
| R-01 /audit/findings 404 | ✅ Fixed | `97aa502` |

### Pending ADRs (not yet written)

- ADR-016: CI/CD Pipeline Architecture (current: ad-hoc `arctos-update` script)
- ADR-017: Monitoring & Alerting Strategy (Prometheus vs. managed service)
- ADR-018: Secret Management (current: env files, no vault)
- ADR-019: Rate-Limiting Strategy (currently none)
- ADR-020: API-Versioning beyond v1

Contributions welcome -- each ADR should follow the established 7-section template (ID, Title, Status, Date, Context, Decision, Rationale, Consequences).
