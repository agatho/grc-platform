# ARCTOS — Audit, Risk, Compliance & Trust Operating System

## What is ARCTOS?

A self-hosted GRC & BPM SaaS platform for multi-entity corporations. Integrates risk management, compliance, audit, data privacy, BPM, and internal controls into a single platform. 74 entities, 31 catalog frameworks (~2,100 entries), 15 modules, 88 migrations completed.

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
- **BPMN:** bpmn-js (Camunda open source) + bpmn-js-bpmnlint
- **Charts:** recharts
- **Email:** Resend SDK + @react-email/components

## Project Structure

```
arctos/
├── apps/
│   ├── web/          → Next.js 15 App Router (Frontend + API Routes)
│   └── worker/       → Hono.js (Background Jobs, Cron)
├── packages/
│   ├── db/           → Drizzle Schema, Migrations, Seed
│   │   ├── src/schema/  → platform.ts, risk.ts, process.ts, task.ts, asset.ts, control.ts, work-item.ts, budget.ts, catalog.ts, ...
│   │   ├── drizzle/     → SQL migrations (0001–0068)
│   │   └── sql/         → Seed data (catalogs, reference data, cross-framework mappings)
│   ├── ui/           → shadcn/ui Components
│   ├── shared/       → Zod Schemas, Types, Constants
│   ├── auth/         → Auth.js Provider Adapter + RBAC Middleware
│   ├── email/        → Resend SDK + React Email Templates
│   ├── ai/           → Claude API + Ollama Router
│   ├── automation/   → Rule engine, entity field registry
│   ├── graph/        → Knowledge graph, dependency analysis
│   ├── reporting/    → PDF/Excel/CSV report generation
│   └── events/       → Event bus, webhook dispatch
├── docs/             → ADRs, PRD, Data Model, Gap Analysis
├── CLAUDE.md         → This file
└── .env              → Local environment variables
```

## Sprint Status & Module Map

### Core Modules (Sprints 1–9)

| Sprint | Module | Status | Key Tables |
|--------|--------|--------|------------|
| 1 | Foundation (Auth, RBAC, Audit, UI Shell) | ✅ Done | organization, user, user_org_role, audit_log, notification |
| 1.2 | Task/Workflow + Email + Org GDPR | ✅ Done | task, task_comment, org ALTER |
| 1.3 | Module System | ✅ Done | module_definition, module_config |
| 1.4 | Assets + Work Items | ✅ Done | asset, work_item, work_item_type, work_item_link |
| 2 | ERM (Risk Register + KRI) | ✅ Done | risk, risk_assessment, risk_treatment, kri, risk_asset |
| 3 | BPMN Process Modeling | ✅ Done | process, process_version, process_step, process_control |
| 4 | ICS + DMS | ✅ Done | control, control_test, finding, evidence, document |
| 4b | Catalog & Framework | ✅ Done | catalog, catalog_entry, org_active_catalog, org_risk_methodology |
| 5a | ISMS: Assets + Incidents | ✅ Done | protection_requirement, threat, vulnerability, incident |
| 5b | ISMS: Assessment + Maturity | ✅ Done | assessment_run, control_maturity, soa_entry, management_review |
| 6 | BCMS | ✅ Done | bia_assessment, bcp, crisis_scenario, bc_exercise, continuity_strategy |
| 7 | DPMS (Data Protection) | ✅ Done | ropa_entry, dpia, dpia_risk, dpia_measure, dsr, data_breach, tia + consent, retention, processor_agreement |
| 8 | Audit Management | ✅ Done | audit_universe_entry, audit_plan, audit, audit_checklist, audit_evidence + analytics, QA review |
| 9 | TPRM + Contracts | ✅ Done | vendor, contract, contract_sla, vendor_due_diligence, lksg_assessment + scorecards, exit plans, sub-processors |

### Extended Platform (Sprints 10–86)

| Sprint Range | Features | Status |
|-------------|----------|--------|
| 10–15 | Module System, Assets, Work Items | ✅ Done |
| 16–19 | Incident Playbooks, Compliance Calendar, Custom Dashboards, Bulk Import/Export | ✅ Done |
| 20–23 | SSO/SCIM, Multi-Language CMS, Where-Used Tracking, Risk Appetite Framework | ✅ Done |
| 24–27 | NIS2 Tracker, FAIR Quantification, ISMS Intelligence, Compliance Culture | ✅ Done |
| 28–30 | Workflow Automation, Knowledge Graph, Report Engine | ✅ Done |
| 31–33 | Regulatory Simulator, Risk Propagation, Audit Analytics | ✅ Done |
| 34–37 | ABAC, GRC Agents (MCP), EAM Foundation + Advanced | ✅ Done |
| 38–42 | Platform/ERM/ICS/BCMS/DPMS Advanced modules | ✅ Done |
| 43–47 | Audit/TPRM/ESG/Whistleblowing/BPM Advanced | ✅ Done |
| 48–53 | EAM Dashboards, Visualizations, Data Architecture, AI, Catalog, Governance | ✅ Done |
| 54–56 | ERM Evaluation UX, GRC UX Enhancements, BPM Derived Views | ✅ Done |
| 57–61 | API Platform, Plugin Architecture, Onboarding, Mobile, SaaS Metering | ✅ Done |
| 62–66 | Evidence Connectors, Cloud/Identity/DevOps Connectors, Cross-Framework Mapping | ✅ Done |
| 67–71 | GRC Copilot, AI Evidence Review, Regulatory Change, Control Testing, Predictive Risk | ✅ Done |
| 72–76 | DORA, EU AI Act, Tax CMS, Horizon Scanner, Cert Wizard | ✅ Done |
| 77–81 | BI Report Builder, Benchmarking, Risk Quantification, Data Sovereignty, Role Dashboards | ✅ Done |
| 82–86 | Marketplace, Stakeholder Portals, GRC Academy, Simulation Engine, Community Edition | ✅ Done |

### Cross-Cutting Features (post-Sprint 86)

| Feature | Status |
|---------|--------|
| **Accordion-Sidebar + Horizontal Tab-Navigation** (118→35 items, 27 tab groups) | ✅ Done |
| **EU AI Act Full Compliance** (13 DB tables, 14 pages, GPAI/Incidents/Prohibited/QMS/Corrective/Authority/Penalties) | ✅ Done |
| **ISMS IS-Risikoszenarien** (ISO 27005: Threat×Vuln×Asset → Bewertung → ERM-Sync) | ✅ Done |
| **ISMS CAP-Modul** (ISO 27001 Kap. 10: Nichtkonformitäten + Korrekturmaßnahmen) | ✅ Done |
| **Risk Acceptance** (ISO 27005 Kap. 10: Formale Akzeptanz + Authority Matrix) | ✅ Done |
| **ISO 27005 Kataloge** (31 Bedrohungen + 23 Schwachstellen) | ✅ Done |
| **SoA mit 93 Annex A Kontrollen** (control_catalog_entry verknüpft) | ✅ Done |
| Management-system sidebar navigation (10 groups) | ✅ Done |
| Hierarchical budget model + cost fields on entities | ✅ Done |
| 31 catalog frameworks (~2,100 entries) + target_modules | ✅ Done |
| 401 cross-framework mappings + Framework Coverage UI | ✅ Done |
| ISMS Protection Needs (Schutzbedarf from BIA) | ✅ Done |
| Unified catalog API (generic catalog table) | ✅ Done |
| Catalog activation UI with module filtering | ✅ Done |
| **Normenbasierte Testpläne** (ISO 27001, ISO 31000, COSO/IIA, ISO 22301, DSGVO, ISO 27036, CSRD) | ✅ Done |

## Sidebar Navigation (Management-System Grouping)

The sidebar is organized into 10 management-system groups (not abstract categories):

| # | Group Key | Label | Contents |
|---|-----------|-------|----------|
| 1 | `erm` | Enterprise Risk Management | Risks, KRIs, Risk Groups, Appetite, FAIR, RCSA, Predictive, Heatmap, Budget/ROI/RONI, Catalogs |
| 2 | `isms` | Information Security | ISMS Overview, **IS-Risiken**, Assets, Protection Needs, Threats, Vulns, Incidents, Assessments, Maturity, SoA, **CAP**, Reviews, Posture, Certifications, CVE, Playbooks, NIS2, DORA, **AI Act (14 Seiten)**, Catalogs |
| 3 | `icsAudit` | Controls & Audit | Controls, Test Campaigns, Control Findings, RCM, Evidence, Audit, Universe, Plans, Executions, Audit Findings, Catalogs |
| 4 | `bcms` | Business Continuity | BCMS Overview, BIA, Plans, Crisis, Strategies, Exercises, Resilience, Catalogs |
| 5 | `dpms` | Data Protection | Privacy Overview, RoPA, DPIA, DSR, Breaches, TIA, Consent, Retention, Catalogs |
| 6 | `tprmContracts` | Third Parties & Contracts | TPRM, Vendors, LkSG, Scorecards, Concentration, Contracts, Obligations, SLA, Catalogs |
| 7 | `bpmArchitecture` | Processes & Architecture | Processes, Governance, Mining, KPIs, Maturity, EAM, Diagrams, Capabilities, Apps, Tech Radar, Data Flows, EA Governance, Documents |
| 8 | `esg` | ESG & Sustainability | ESG Overview, Materiality, Datapoints, Metrics, Emissions, Targets, Report, Tax CMS |
| 9 | `whistleblowing` | Whistleblowing | Cases, Statistics — **isolated, role-locked to `whistleblowing_officer` only** |
| 10 | `platform` | Platform | Dashboard, Calendar, Reports, Copilot, Marketplace, Extensions, Academy, Import, Executive, Graph, Search, Regulatory, Compliance Culture, Assurance, Settings, Orgs, Users, Modules, Audit Log, Access Log |

Config: `apps/web/src/components/layout/nav-config.ts`

## Catalog & Framework System

### Architecture
- **Generic catalog table** (`catalog` + `catalog_entry`) — used by all seed data, hierarchical (parent_entry_id)
- **Typed tables** (`risk_catalog` / `control_catalog` + entries) — Drizzle ORM typed tables
- **Per-org activation** (`org_active_catalog`) — enforcement levels: optional / recommended / mandatory
- **Per-org exclusion** (`org_catalog_exclusion`) — exclude individual entries from active catalogs
- **Cross-framework mappings** (`catalog_entry_mapping`) — links equivalent controls across frameworks
- **Target modules** (`catalog.target_modules text[]`) — which management systems a catalog applies to

### Seeded Catalogs (29 total, ~2,020 entries)

| # | Catalog | Type | Entries | Target Modules |
|---|---------|------|---------|----------------|
| 1 | Cambridge Taxonomy v2.0 | Risk | ~175 | erm, isms, bcms |
| 2 | WEF Global Risks 2025 | Risk | 29 | erm |
| 3 | BSI Elementargefährdungen | Risk | 47 | isms |
| 4 | ISO 27002:2022 | Control | 97 | isms, ics |
| 5 | NIST CSF 2.0 | Control | 131 | isms, ics, erm |
| 6 | CIS Controls v8 | Control | 35 | isms, ics |
| 7 | Incident Categories | Reference | 16 | isms |
| 8 | Crisis Scenario Templates | Reference | 7 | bcms |
| 9 | LkSG Risk Categories | Reference | 18 | tprm |
| 10 | DPIA Criteria | Reference | 9 | dpms |
| 11 | EU GDPR (2016/679) | Control | 106 | dpms, isms |
| 12 | EU NIS2 (2022/2555) | Control | 50 | isms, bcms, erm |
| 13 | EU AI Act (2024/1689) | Control | 63 | isms |
| 14 | EU DORA (2022/2554) | Control | 53 | isms, bcms, tprm |
| 15 | BSI IT-Grundschutz Bausteine | Control | 160 | isms, ics |
| 16 | ISO 27001:2022 Annex A | Control | 97 | isms |
| 17 | MITRE ATT&CK Enterprise v15.1 | Risk | 266 | isms |
| 18 | TISAX (VDA ISA 6.0) | Control | 110 | isms, tprm |
| 19 | COSO ERM 2017 | Control | 25 | erm, ics |
| 20 | COBIT 2019 | Control | 45 | ics, audit |
| 21 | IDW PS 980/981/982/986 | Control | 30 | ics, audit |
| 22 | IIA Standards 2024 | Reference | 34 | audit |
| 23 | ISAE 3402 / SOC 2 | Control | 51 | audit, tprm |
| 24 | TOMs (Art. 32 GDPR) | Control | 56 | dpms, isms |
| 25 | GDPR Data Categories | Reference | 49 | dpms |
| 26 | GDPR Legal Bases | Reference | 26 | dpms |
| 27 | ISO 22301:2019 | Control | 32 | bcms |
| 28 | ESRS / CSRD | Control | 96 | esg |
| 29 | OWASP ASVS v4.0.3 | Control | 106 | isms |
| 30 | ISO 27005:2022 Bedrohungen | Risk | 31 | isms, erm |
| 31 | ISO 27005:2022 Schwachstellen | Risk | 23 | isms, erm |

### Cross-Framework Mappings (401 total)
- ISO 27001 Annex A ↔ ISO 27002:2022 (93 — 1:1 equivalence)
- BSI Grundschutz ↔ ISO 27001 (64 — Kreuzreferenztabelle)
- TISAX ↔ ISO 27001 (44 — VDA ISA based on ISO)
- NIS2 ↔ ISO 27001 (33 — regulatory → control)
- DORA ↔ ISO 27001 (25 — financial sector overlay)
- COSO ↔ COBIT (24 — governance alignment)
- GDPR Art. 32 ↔ TOMs (23 — requirements → measures)
- NIST CSF ↔ ISO 27002 (89 — existing v1)
- ISO 22301 ↔ ISO 27001 (6 — BC ↔ IS)

Seed files: `packages/db/sql/seed_catalog_*.sql`, `seed_cross_framework_mappings*.sql`

## Budget & Cost Model

### Hierarchical Budgets
- `grc_budget` supports named budgets with `parent_budget_id` for hierarchy
- Types: `management_system`, `department`, `project`, `custom`
- Each budget has `grc_area` (erm/isms/ics/dpms/audit/tprm/bcms/esg/general)
- Owner, period, approval workflow

### Cost Tracking on Entities
Every actionable entity carries:
- `cost_onetime` — one-time implementation cost
- `cost_annual` — recurring annual cost
- `effort_hours` — work hours estimate
- `cost_currency` — EUR, USD, etc.
- `budget_id` → FK to grc_budget
- `cost_note` — justification

Tables with cost fields: `control`, `risk_treatment`, `dpia_measure`, `continuity_strategy`

### Aggregation
- `v_budget_usage` view — per-budget rollup of all linked entity costs
- `grc_cost_entry` — polymorphic detailed cost entries (entityType/entityId)
- `grc_roi_calculation` — cached ROI/RONI per entity (FAIR ALE method)
- Budget hierarchy aggregates upward via `parent_budget_id`

## Available Infrastructure (use in every Sprint)

### Middleware Chain (every API route)
```typescript
requireAuth() → requireModule('module_key') → orgContextMiddleware → requireRole([...]) → handler
```

### Available Middleware
- `requireAuth()` — verifies JWT, returns 401 if invalid
- `requireModule(key)` — checks module_config for org, returns 404 if disabled (NOT 403)
- `orgContextMiddleware` / `getOrgId(req)` — sets `app.current_org_id` for RLS
- `requireRole(roles[])` — checks user_organization_role, returns 403
- `requireLineOfDefense(lines[])` — filters by LoD (1st/2nd/3rd)
- **API 401 handling** — middleware returns JSON `{ error: "Unauthorized" }` for `/api/*` routes instead of redirecting to login

### Module Keys
`erm`, `bpm`, `ics`, `dms`, `isms`, `bcms`, `dpms`, `audit`, `tprm`, `contract`, `esg`, `whistleblowing`, `reporting`, `eam`, `academy`

### Shared Services
- `sendEmail({ templateKey, to, data })` — Resend SDK (packages/email)
- `createNotification({ userId, orgId, type, title, message, channel, link })` — in-app + email
- `createTask({ orgId, title, assigneeId, dueDate, sourceEntityType, sourceEntityId })` — task entity
- `logAuditEvent({ orgId, userId, entityType, action, metadata })` — audit trail
- `audit_trigger()` — PostgreSQL function (register on new tables via migration)

### React Components (available)
- `<ModuleGate moduleKey="...">` — wraps page, shows 404 if module disabled (path: `@/components/module/module-gate`)
- `<DataTable>` — shadcn/ui table with sorting, filtering, pagination
- `<Badge>`, `<Card>`, `<Dialog>`, `<Sheet>`, `<AlertDialog>`, `<Slider>` — shadcn/ui primitives
- `useTranslations('namespace')` — next-intl hook for i18n

### i18n System
- 71 namespace files per locale in `messages/{de,en}/`
- All namespaces loaded in `src/i18n/request.ts` and merged at request time
- Root-level keys from `common.json` accessible without namespace prefix
- Other namespaces accessed via `useTranslations('identity')`, `useTranslations('fair')`, etc.
- **No dotted keys** — use nested objects instead (next-intl interprets dots as nesting)

### Work Item System (Sprint 1.4)
Every domain entity can be wrapped in a `work_item` for cross-module linking:
```typescript
work_item → { typeKey: 'single_risk' | 'incident' | 'finding' | ... }
work_item_link → { sourceId, targetId, linkType: 'caused_by' | 'mitigates' | 'blocks' }
```
Element IDs auto-generated: RSK00000001, INC00000001, FND00000001, CTL00000001

### Role Matrix
| Role | LoD | Permissions |
|------|-----|-------------|
| admin | — | Full access, org management, settings |
| risk_manager | 2nd | Risks, KRIs, assessments, treatments |
| control_owner | 1st | Own controls, test results, evidence |
| process_owner | 1st | Own processes, BPMN editor, approvals |
| auditor | 3rd | Audits, findings, read-only cross-module |
| dpo | 2nd | DPMS full access, DSR, breach management |
| viewer | — | Read-only on permitted modules |
| whistleblowing_officer | — | Whistleblowing cases and statistics only (legally isolated) |
| ombudsperson | — | External ombudsperson for whistleblowing |
| esg_manager | 2nd | ESG module full access |
| esg_contributor | 1st | ESG data entry |

## Conventions

### Code Style
- TypeScript strict mode, no `any` types except in type guards
- Zod for all validation (API input + DB output)
- Drizzle schemas in `packages/db/src/schema/` — one file per domain
- API routes in `apps/web/src/app/api/v1/`
- Server Components by default, Client Components only when needed (`"use client"`)
- UI component imports: `@/components/ui/xxx` (not `@grc/ui/xxx`)
- ModuleGate import: `@/components/module/module-gate` (not `@/components/module-gate`)

### Naming Conventions
- Files: kebab-case (`user-organization-role.ts`)
- Types/Interfaces: PascalCase (`UserOrganizationRole`)
- Variables/Functions: camelCase (`getUserById`)
- DB tables/columns: snake_case (`user_organization_role`)
- API endpoints: kebab-case plural (`/api/v1/organizations`)
- Enums in DB: snake_case (`risk_manager`, `control_owner`)

### i18n
- next-intl with 71 namespace files: `messages/{de,en}/*.json`
- Date formats: DE = `dd.MM.yyyy`, EN = `MM/dd/yyyy`
- Number formats: DE = `1.234,56`, EN = `1,234.56`
- Fallback: German if translation is missing
- **Never use dotted keys** in translation files — use nested objects

### Testing
- Backend: Vitest, code coverage > 80%
- Frontend: Vitest + Testing Library, coverage > 60%
- E2E: Playwright
- RLS integration tests: verify user A cannot see org B's data
- Audit trail tests: verify hash chain integrity after CRUD operations

### Git
- Branch: `feature/S4b-XX-short-description`
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`)
- Default branch: `main`, Rebase on pull

### Build
- Production build: `cd apps/web && npm run build` (requires ~2.5GB RAM)
- ESLint and TypeScript checks skipped during build (run separately in CI)
- All pages render dynamically (`force-dynamic`) — no static generation
- Worker uses `tsx` for both dev and start (no compiled output)

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

1. **Data Sovereignty:** Everything self-hosted. No US cloud dependency for auth.
2. **Multi-Entity by Default:** Every table has `org_id`, every query filtered by RLS.
3. **Audit Everything:** Every data change automatically logged via DB triggers.
4. **Provider Abstraction:** Auth encapsulated behind interface. Auth.js today, Keycloak tomorrow.
5. **Compliance First:** ISO 27001, NIS2, GDPR, BSI Grundschutz, DORA, AI Act are core features.
6. **Cost Transparency:** Every measure, control, and treatment carries cost fields aggregatable to budgets.
7. **Framework Deduplication:** Cross-framework mappings eliminate redundant compliance work.

## Critical Implementation Rules

1. **ALL API routes MUST use `requireModule(key)` middleware** — returns 404 (not 403) when module disabled
2. **ALL page components MUST be wrapped in `<ModuleGate moduleKey="...">`**
3. **No hardcoded sidebar entries** — nav groups defined in `nav-config.ts`, management-system based
4. **RLS on all tables** — every table has `org_id` + RLS policy + dedicated migration
5. **Audit triggers on all tables** — register `audit_trigger()` via migration
6. **TypeScript strict mode** — zero `any` types except documented type guards
7. **All UI text through i18n** — use `useTranslations('namespace')`, never hardcode strings
8. **Zod validation on all inputs** — API body, query params, path params
9. **Status transitions enforced server-side** — check valid transitions before updating
10. **Finding entity is shared** — Sprint 4 finding used by ICS, Audit, BCMS exercises
11. **Bulk operations capped at 100** — Zod schema validates max array length
12. **Worker jobs for scheduled tasks** — `apps/worker/src/jobs/` with cron registration
13. **API routes return JSON 401** — never redirect API calls to login page
14. **Catalog seed data uses generic `catalog` + `catalog_entry` tables** — not the typed risk_catalog/control_catalog
15. **Cost fields on actionable entities** — control, risk_treatment, dpia_measure, continuity_strategy all carry cost_onetime, cost_annual, effort_hours, budget_id
