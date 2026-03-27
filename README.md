# ARCTOS — Audit, Risk, Compliance & Trust Operating System

Self-hosted GRC & BPM SaaS platform for multi-entity corporations. Integrates risk management, compliance, audit, data privacy, BPM, and internal controls into a single platform.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (if not running)
docker compose up -d

# 3. Run database migrations
cd packages/db && DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/grc_platform npx drizzle-kit migrate

# 4. Seed demo data
DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/grc_platform npx tsx src/seed.ts
DATABASE_URL=postgresql://grc:grc_dev_password@localhost:5432/grc_platform npx tsx src/seed-risk.ts

# 5. Symlink .env for Next.js (apps/web reads from its own directory)
cd ../../apps/web && ln -sf ../../.env .env

# 6. Start development
cd ../.. && npm run dev
# Web: http://localhost:3000 | Worker: http://localhost:3001
```

**Login:** `admin@arctos.dev` / `admin123`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15.5, React 19.2, Tailwind CSS 4.2, shadcn/ui, Recharts 2.15, bpmn-js 18, Lucide 1.7 |
| Backend | Node.js 22, TypeScript 6, Hono.js 4.12 (Worker) |
| Database | PostgreSQL 16, Drizzle ORM 0.45, RLS, pgcrypto |
| Auth | Auth.js v5 (self-hosted) + Custom RBAC + Three Lines of Defense |
| Email | Resend 6.9 SDK + React Email templates (27 templates, DE/EN) |
| AI | Claude CLI (subscription) + Claude API + OpenAI + Gemini + Ollama |
| Testing | Vitest 4.1, 302 unit tests + 16 integration tests |
| Monorepo | Turborepo 2.8 + npm workspaces |
| CI/CD | GitHub Actions (ESLint, TypeScript, tests, CodeQL v4, Dependabot) |

## Project Structure

```
arctos/
├── apps/
│   ├── web/            Next.js 15 (Frontend + 121 API routes)
│   └── worker/         Hono.js (Cron jobs, background processing)
├── packages/
│   ├── db/             Drizzle schema (39 tables), migrations, seeds
│   ├── ui/             shadcn/ui components (16+), BPMN editor
│   ├── shared/         Zod schemas, TypeScript types, BPMN parser
│   ├── auth/           Auth.js adapter, RBAC middleware, module guard
│   ├── email/          Resend service, 5 email templates (DE/EN)
│   └── ai/             Claude API integration
├── docs/               ADRs, PRDs, Sprint specs
└── .github/            CI/CD workflows, Dependabot, CodeQL
```

## Architecture

| ADR | Decision |
|-----|----------|
| 001 | Multi-entity isolation via PostgreSQL RLS (org_id per row) |
| 002 | Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui |
| 006 | Drizzle ORM (type-safe, SQL-close) |
| 007 | Auth.js (self-hosted) + Custom RBAC with Three Lines of Defense |
| 011 | Append-only audit trail with SHA-256 hash chain |
| 013 | Catalog & Framework Layer (risk catalog hook) |

## Module System

ARCTOS uses a feature-gate architecture. Each module can be independently enabled/disabled per organization via `/admin/modules`.

| Module | Key | Status | Sprint |
|--------|-----|--------|--------|
| Risk Management | `erm` | Implemented | Sprint 2 |
| Process Management | `bpm` | Implemented | Sprint 3 |
| Internal Controls | `ics` | Registered | Sprint 4 |
| Document Management | `dms` | Registered | Sprint 4 |
| Information Security | `isms` | Registered | Sprint 5 |
| Business Continuity | `bcms` | Registered | Sprint 6 |
| Data Protection | `dpms` | Registered | Sprint 7 |
| Audit Management | `audit` | Registered | Sprint 8 |
| Third-Party Risk | `tprm` | Registered | Future |
| Contract Management | `contract` | Registered | Future |
| ESG / Sustainability | `esg` | Registered | Future |
| Whistleblowing | `whistleblowing` | Registered | Future |

## Sprint Roadmap

### Sprint 1 — Foundation Layer
- Multi-entity organizations with corporate hierarchy
- Auth.js with credentials + Azure AD SSO (JIT provisioning)
- RBAC: 7 roles, Three Lines of Defense, per-org assignment
- Audit trail: SHA-256 hash chain, append-only, tamper detection
- UI Shell: responsive sidebar, org switcher, notifications, i18n (DE/EN)
- 16 API endpoints, 10 database tables

### Sprint 1.2 — Foundation Extension
- Task/workflow engine with status lifecycle and overdue detection
- Email notification system (Resend SDK, 5 templates, retry logic)
- Organization GDPR extension (DPO assignment, data controller, supervisory authority)
- Worker cron jobs (overdue tasks, scheduled notifications, digest)

### Sprint 1.3 — Module System
- `module_definition` (12 modules) + `module_config` (per-org)
- `requireModule()` middleware (404 for disabled, 403 for preview writes)
- Dynamic sidebar from database (no hardcoded module nav)
- Admin module management page with dependency validation
- `ModuleGate` component + `useModuleConfig` hook
- In-memory cache with 5-minute TTL

### Sprint 1.4 — Assets & Work Items
- 3-tier asset model (Business Structure / Primary / Supporting)
- CIA default values (1-4 scale) with parent inheritance
- Work item type system (18 types, RSK/INC/FIN element IDs)
- Cross-entity linking (caused_by, mitigated_by, evidence_for)
- Work Items hub page with full-text search
- Persistent tab navigation (max 8, sessionStorage)

### Sprint 2 — Enterprise Risk Management
- Risk register with 5x5 heat map (interactive, color-coded)
- Risk lifecycle: identified, assessed, treated, accepted, closed
- Risk appetite threshold with automatic escalation
- Treatment action plans with responsible, due date, cost
- KRI dashboard with sparklines and threshold alerts
- Group risk aggregation across all organizations
- Risk ↔ process, asset, framework, control linkages
- CSV/JSON export with data_export_log tracking
- Dashboard widgets (heat map, donut chart, top risks, KRI status)

### Sprint 3 — BPMN Process Modeling
- BPMN 2.0 editor (bpmn-js) with risk overlay badges
- Process landscape with hierarchical tree view
- Approval workflow: draft → in_review → approved → published
- Version management with restore capability
- ProcessStep auto-sync from BPMN XML
- AI process generation (Claude API, rate limited)
- Process ↔ risk, asset, control, document linkages
- Automated process review cycle reminders

### Sprint 4 — Internal Controls + Document Management
- Control register with COSO assertions, ToD/ToE testing, test campaigns
- Finding management (5-level BIC severity taxonomy)
- Risk-Control Matrix (RCM) with effectiveness ratings
- Document repository with versioning, acknowledgments, full-text search

### Sprint 4b — Catalog & Framework Layer
- Risk catalogs (Cambridge v2, NIST CSF 2, BSI, WEF) + control catalogs (ISO 27002, CIS v8)
- 487 catalog entries + 88 cross-framework mappings
- FAIR Monte Carlo risk simulation
- Methodology selector (ISO 31000, COSO, FAIR, Hybrid)

### Sprint 5a/5b — ISMS (Information Security)
- Asset protection requirements (CIA classification)
- Threats, vulnerabilities, risk scenarios
- Security incidents with 72h GDPR breach countdown
- ISMS assessment wizard (controls + risk evaluation)
- Control maturity (1-5 CMMI scale) + Statement of Applicability
- Management review (ISO 27001 clause 9.3)

### Sprint 6 — Business Continuity (BCMS)
- Business Impact Analysis with financial tiers + qualitative dimensions
- BCP with procedures, resources, approval workflow
- Crisis management with immutable log + team composition
- Recovery strategies (6 types) + BC exercises

### Sprint 7 — Data Protection (DPMS)
- RoPA register (GDPR Art. 30) with annual review
- DPIA wizard (5-step, Art. 35 trigger assessment)
- DSR tracking (30-day SLA with daily monitor)
- Data breach management (72h countdown, hourly monitor)
- Transfer Impact Assessment (Schrems II)

### Sprint 8 — Audit Management
- Audit universe with risk-based priority planning
- Checklist auto-generation from controls in scope
- 7-step audit workflow with finding creation
- Findings use shared entity (source='audit')

### Sprint 9/9b — TPRM + Contracts + Supplier Portal
- Vendor management with tier classification + due diligence
- Contract lifecycle (8 states) with SLA monitoring
- LkSG supply chain compliance
- External supplier portal with token-based questionnaires

### Sprint 10 — ESG/CSRD (Sustainability)
- Double materiality assessment with stakeholder voting
- ESRS datapoint registry + metrics + measurements
- Scope 1/2/3 emission tracking + target progress
- ESRS annual report with completeness check

### Sprint 11 — CCM + AI Intelligence
- Control Effectiveness Score (CES) engine
- Residual risk auto-computation from CES
- Finding analytics (TTR, SLA, aging)
- AI-powered control suggestions, RCM gap analysis, root cause patterns
- Regulatory intelligence feed (BSI, EUR-Lex, BaFin)
- Executive dashboard with 12-month trends

### Sprint 12 — Whistleblowing (HinSchG)
- Anonymous reporting with AES-256-GCM encryption
- Token-based mailbox (6-month validity)
- 7-day acknowledge + 3-month response deadlines
- Ombudsperson-only case access (admin sees statistics only)

## Database

- **~142 tables** across 23 Drizzle migrations
- **RLS** on all business tables (org_id isolation)
- **Audit triggers** with SHA-256 hash chain on all entity tables
- **Append-only rules** on log tables (audit_log, access_log, data_export_log, crisis_log)
- **487 catalog entries** + 88 cross-framework mappings + 20 ESRS datapoints

## Testing

```bash
# Unit tests (302 total)
npx turbo test

# Integration tests (RLS + audit triggers)
cd packages/db
npx vitest run --config vitest.integration.config.ts
npx vitest run --config vitest.rls.config.ts
```

| Package | Tests | Coverage |
|---------|-------|----------|
| @grc/shared | 179 | Zod schemas, BPMN parser, status transitions, CES |
| @grc/auth | 57 | RBAC middleware, provider helpers, Azure AD |
| @grc/web | 40 | Date/number format utilities |
| @grc/email | 26 | EmailService, retry logic, 27 templates |
| @grc/db (integration) | 16 | RLS isolation, audit triggers, hash chain |

## Security

- Cookie-based org ID validated against JWT role assignments
- RLS at database level (defense-in-depth)
- Append-only audit log with SHA-256 hash chain
- Secret scanning + push protection enabled
- CodeQL security analysis on every push
- Dependabot for dependency updates
- OWASP-aware input validation (Zod on all endpoints)

## Environment Variables

See `.env.example` for all required variables:
- `DATABASE_URL` — PostgreSQL connection
- `AUTH_SECRET` — Auth.js session encryption
- `RESEND_API_KEY` — Email delivery (optional)
- `ANTHROPIC_API_KEY` — AI features (optional)
- `AZURE_AD_*` — SSO (optional)

## License

Proprietary. All rights reserved.
