# Security Policy

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Report privately via:

- E-Mail: agatho@charliehund.de (PGP-Key on request)
- GitHub Security Advisory: [Create draft advisory](https://github.com/agatho/grc-platform/security/advisories/new)

We aim to:

- Acknowledge receipt within 48h
- Provide a triage decision within 5 business days
- Coordinate a fix + disclosure timeline with the reporter

## Supported Versions

Only the `main` branch is supported. There is no LTS release channel yet — every deployed Hetzner host should track `main` within 30 days.

## Scope

### In scope

- API endpoints under `apps/web/src/app/api/v1/**`
- Authentication / authorization flows (Auth.js + RBAC)
- RLS policies and audit-trigger integrity (ADR-011)
- Build-time supply-chain (package.json, CI)
- Database migrations that touch production data

### Out of scope (known-as-designed)

- Demo-user `admin@arctos.dev / admin123` — only seeded into demo tenants (ADR-014)
- Dependency advisories covered by Dependabot alerts in the repo (we track them)
- Public pages like `/login` with no data exposure

## Disclosure Preferences

Coordinated disclosure. We prefer to patch + deploy the fix before public writeup. If you intend to publish research or a CVE, please give us a 30-day head start unless the vulnerability is actively being exploited.

## Recognition

We'll credit reporters in the release notes of the fix (opt-out available).

## Known-Risk Baselines

See:

- [`docs/security/rls-coverage-report.md`](./docs/security/rls-coverage-report.md) — tables without RLS (currently 132, shrinking)
- [`docs/security/lod-coverage.md`](./docs/security/lod-coverage.md) — API routes without withAuth
- [`docs/ADR-018-secret-management.md`](./docs/ADR-018-secret-management.md) — secret-handling model
- [`docs/ADR-011-audit-trail.md`](./docs/) _(TBD — hash chain specification)_

## CI Security Gates

- CodeQL scan (`.github/workflows/codeql.yml`)
- Dependency review (`.github/workflows/dependency-review.yml`)
- Migration policy gate (`.github/workflows/migration-policy.yml`)
- Schema-drift + RLS regression gate (`.github/workflows/schema-drift.yml`)

## Security Principles (non-negotiable)

1. **Data sovereignty** (ADR-007 rev.1) — no US-cloud-based runtime dependencies for auth, DB, or secrets.
2. **Multi-tenant isolation by default** (ADR-001) — every tenant-data table has `org_id` + RLS policy.
3. **Append-only audit trail** (ADR-011) — SHA-256 hash chain, verifiable via `/api/v1/audit-log/integrity`.
4. **Least privilege** — RBAC roles per-org (ADR-007), LoD-based module access.
5. **Defence in depth** — app-level role check + RLS + audit trigger + off-site backup (ADR-015).
