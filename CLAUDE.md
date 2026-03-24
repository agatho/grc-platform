# ARCTOS — Audit, Risk, Compliance & Trust Operating System

## What is ARCTOS?

A self-hosted GRC & BPM SaaS platform for multi-entity corporations. Integrates risk management, compliance, audit, data privacy, BPM, and internal controls into a single platform. 47 entities, 88 requirements from gap analysis, 130+ compliance frameworks.

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui
- **Backend:** Node.js 22 + TypeScript 5 + Hono.js (Worker)
- **ORM:** Drizzle ORM (type-safe, SQL-close)
- **Database:** PostgreSQL 16 + TimescaleDB + pgvector + RLS
- **Auth:** Auth.js (self-hosted) + Custom RBAC with Three Lines of Defense Model (ADR-007 rev.1)
- **AI:** Claude API (Sonnet/Opus) + Ollama (local models) + MCP
- **API:** REST + OpenAPI 3.1 + Webhooks + HMAC signatures
- **Audit:** 3 append-only log tables + SHA-256 hash chain + DB triggers
- **Monorepo:** Turborepo + npm workspaces
- **Deployment:** Docker (release/Hetzner only), dev environment runs natively in LXC

## Project Structure

```
arctos/
├── apps/
│   ├── web/          → Next.js 15 (Frontend + API Routes)
│   └── worker/       → Hono.js (Background Jobs, Cron)
├── packages/
│   ├── db/           → Drizzle Schema, Migrations, Seed
│   ├── ui/           → shadcn/ui Components
│   ├── shared/       → Zod Schemas, Types, Constants
│   ├── auth/         → Auth.js Provider Adapter + RBAC Middleware
│   └── ai/           → Claude API + Ollama Router
├── docs/             → ADRs, PRD, Data Model, Gap Analysis
├── CLAUDE.md         → This file
└── .env              → Local environment variables
```

## Architecture Decision Records (ADRs)

See `docs/` for details. Key decisions:

| ADR | Decision |
|-----|----------|
| 001 | Multi-entity isolation via PostgreSQL RLS (org_id per row) |
| 002 | Next.js 15 + React 19 + Tailwind + shadcn/ui |
| 006 | Drizzle ORM (type-safe, SQL-close) |
| 007 | **Auth.js (self-hosted) + Custom RBAC** (changed from Clerk, rev.1) |
| 011 | Append-only audit trail with SHA-256 hash chain |

## Sprint 1: Foundation Layer (63 SP, 23 User Stories)

See `docs/PRD_Sprint1.md` for full specification.

### Epics
1. **Multi-Entity Organization** (13 SP) — CRUD, RLS, corporate hierarchy
2. **Authentication** (10 SP) — Auth.js, user sync, SSO, MFA
3. **RBAC + Three Lines of Defense** (16 SP) — 7 roles, middleware, LoD filter
4. **Audit Trail** (11 SP) — DB triggers, hash chain, access log
5. **UI Shell** (13 SP) — Layout, nav, org switcher, i18n (DE/EN), dashboard

### Database Tables Sprint 1
organization → user → user_organization_role → audit_log → access_log → data_export_log → notification

### Role Matrix
admin | risk_manager | control_owner | auditor | dpo | process_owner | viewer

Roles are assigned per organization. Three Lines of Defense Model:
- 1st Line: process_owner, control_owner (operational management)
- 2nd Line: risk_manager, dpo (oversight functions)
- 3rd Line: auditor (independent assurance)

## Conventions

### Code Style
- TypeScript strict mode, no `any` types except in type guards
- Zod for all validation (API input + DB output)
- Drizzle schemas in `packages/db/src/schema/` — one file per domain
- API routes in `apps/web/src/app/api/v1/`
- Server Components by default, Client Components only when needed (`"use client"`)

### Naming Conventions
- Files: kebab-case (`user-organization-role.ts`)
- Types/Interfaces: PascalCase (`UserOrganizationRole`)
- Variables/Functions: camelCase (`getUserById`)
- DB tables/columns: snake_case (`user_organization_role`)
- API endpoints: kebab-case plural (`/api/v1/organizations`)
- Enums in DB: snake_case (`risk_manager`, `control_owner`)

### i18n
- next-intl with namespace files: `messages/de/common.json`, `messages/en/common.json`
- Date formats: DE = `dd.MM.yyyy`, EN = `MM/dd/yyyy`
- Number formats: DE = `1.234,56`, EN = `1,234.56`
- Fallback: German if translation is missing

### Testing
- Backend: Vitest, code coverage > 80%
- Frontend: Vitest + Testing Library, coverage > 60%
- RLS integration tests: verify user A cannot see org B's data
- Audit trail tests: verify hash chain integrity after CRUD operations

### Git
- Branch: `feature/S1-XX-short-description` (e.g. `feature/S1-03-rls-policies`)
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`)
- Default branch: `main`
- Rebase on pull

## Database Access

```
Host:     localhost
Port:     5432
User:     grc
Password: grc_dev_password
Database: grc_platform
URL:      postgresql://grc:grc_dev_password@localhost:5432/grc_platform
```

Extensions: pgcrypto, uuid-ossp, vector, timescaledb

## Core Design Principles

1. **Data Sovereignty:** Everything self-hosted. No Clerk, no Auth0, no US cloud dependency for auth.
2. **Multi-Entity by Default:** Every table has `org_id`, every query is filtered by RLS.
3. **Audit Everything:** Every data change is automatically logged via DB triggers.
4. **Provider Abstraction:** Auth is encapsulated behind an interface (`packages/auth`). Auth.js today, Keycloak tomorrow — 3-day migration.
5. **Compliance First:** ISO 27001, NIS2, GDPR, BSI Grundschutz are core features, not afterthoughts.
