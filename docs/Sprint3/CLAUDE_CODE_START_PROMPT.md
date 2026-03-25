# ARCTOS Sprint 3 — Claude Code Implementation Prompt

## Context

You are implementing Sprint 3 (BPMN Process Modeling) of the ARCTOS GRC SaaS platform. This is a Next.js 15 / React 19 / TypeScript 5 monorepo with PostgreSQL 16, Drizzle ORM, Clerk Auth, and Tailwind CSS / shadcn/ui.

All planning documents are in the `Sprint3/` folder:
- `PRD_Sprint3_BPMN_Process_Modeling.md` — PRD with epics, user stories, SQL migrations, API endpoints
- `Tech_Spec_BPMN_Module.md` — Drizzle schemas, Zod schemas, BPMN parser, React components, API implementations
- `UIUX_Spec_BPMN_Module.md` — Page layouts, component specs, colors
- `Sprint3_Test_Plan.md` — Unit tests, integration tests, E2E tests

Read ALL four documents completely before writing any code.

## Monorepo Structure

```
apps/web/          — Next.js 15 App Router (frontend + API routes)
apps/worker/       — Hono.js background jobs
packages/db/       — Drizzle ORM schema + migrations
packages/shared/   — Zod schemas + TypeScript types + utilities
packages/ui/       — Shared React components (shadcn/ui based)
packages/ai/       — Claude API integration
```

## Implementation Order — Follow This Exactly

### Phase 1: Database (do first, verify before continuing)

1. Create migrations `packages/db/src/migrations/048_create_process.sql` through `055_seed_demo_processes.sql` — copy the complete SQL from PRD Section 2
2. Create Drizzle schema `packages/db/src/schema/process.ts` — copy from Tech Spec Section 1
3. Export from `packages/db/src/schema/index.ts`
4. Run migrations and verify all tables exist with correct constraints

### Phase 2: Shared Types & Utilities

5. Create `packages/shared/src/schemas/process.ts` — Zod schemas from Tech Spec Section 2
6. Create `packages/shared/src/utils/bpmn-parser.ts` — BPMN XML parser from Tech Spec Section 3
7. Install `fast-xml-parser` in packages/shared
8. Run the BPMN parser unit tests to verify

### Phase 3: API Routes

9. Create all API routes under `apps/web/src/app/api/v1/processes/` — follow the route structure from PRD Section 10 (File Directory)
10. The three most critical routes with complete implementations are in Tech Spec Section 6:
    - POST /api/v1/processes (create process + initial version)
    - POST /api/v1/processes/[id]/versions (save BPMN + ProcessStep sync)
    - PUT /api/v1/processes/[id]/status (status transition + email notifications)
11. All other routes follow the same pattern: requireAuth → requireModule('bpm') → requireRole → validate → handler
12. Create AI generation route from Tech Spec Section 7

### Phase 4: Frontend Components

13. Install `bpmn-js` in packages/ui: `npm install bpmn-js --workspace=packages/ui`
14. Create `packages/ui/src/components/bpmn/BpmnEditor.tsx` — from Tech Spec Section 4 (CRITICAL: follow the React lifecycle pattern exactly)
15. Create `packages/ui/src/components/bpmn/BpmnViewer.tsx` — from Tech Spec Section 5
16. Create `packages/ui/src/components/bpmn/bpmn-editor.css` — CSS imports from Tech Spec Section 9
17. Create all process UI components from UIUX Spec: ProcessTree, ProcessForm, ProcessStatusBadge, ProcessApprovalButtons, VersionTimeline, ShapeSidePanel, RiskLinkSearch, AIGenerateModal
18. Create page components: `/processes/page.tsx`, `/processes/[id]/page.tsx`, `/processes/new/page.tsx`
19. Create React Query hooks: `useProcesses.ts`, `useBpmnEditor.ts`

### Phase 5: i18n

20. Create `apps/web/src/messages/de/process.json` and `apps/web/src/messages/en/process.json` — from Tech Spec Section 8

### Phase 6: Tests

21. Create unit tests from Sprint3_Test_Plan.md Section 1
22. Create integration tests from Sprint3_Test_Plan.md Section 2
23. Create E2E tests from Sprint3_Test_Plan.md Section 3

## Critical Implementation Rules

1. **ALL Sprint 3 API routes MUST use `requireModule('bpm')` middleware** — this returns 404 (not 403) when the BPM module is disabled for the org
2. **ALL Sprint 3 page components MUST be wrapped in `<ModuleGate moduleKey="bpm">`**
3. **No hardcoded sidebar entries** — the BPM nav items come from the module_definition seed (Sprint 1.3)
4. **bpmn.js lifecycle is critical** — follow the useEffect/useRef pattern in Tech Spec Section 4 exactly. Call `modeler.destroy()` in cleanup. Rebuild overlays after every `importXML()`.
5. **ProcessStep auto-sync** — on every BPMN save, parse XML server-side, upsert process_step records, soft-delete removed steps
6. **RLS on all tables** — every table has `org_id` + RLS policy. Migration 053 enables RLS.
7. **Audit triggers on all tables** — Migration 054 registers audit_trigger().
8. **TypeScript strict mode** — zero `any` types except documented type guards
9. **All UI text through i18n** — use `useTranslations('process')` from next-intl, never hardcode strings

## Existing Infrastructure You Can Use

- `requireAuth()` — Sprint 1 auth middleware
- `requireModule(key)` — Sprint 1.3 module guard middleware  
- `requireRole(roles[])` — Sprint 1 RBAC middleware
- `orgContextMiddleware` / `getOrgId(req)` — Sprint 1 org context
- `audit_trigger()` — Sprint 1 PostgreSQL function (just register on new tables)
- `sendEmail({ templateKey, to, data })` — Sprint 1.2 email service
- `<ModuleGate moduleKey="...">` — Sprint 1.3 React component
- `process_risk` + `process_step_risk` tables — Sprint 2 (already exist, Sprint 3 adds FK constraints)
- `GET /api/v1/risks` — Sprint 2 risk list API (used for risk search in side panel)

## Start Now

Begin with Phase 1 (Database). After each phase, verify it works before moving to the next. When you encounter ambiguity, the PRD and Tech Spec are authoritative — follow them exactly.
