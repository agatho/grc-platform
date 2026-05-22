# Implementation Gap Audit (post-Wave-26) — 2026-05-23

Author: claude opus 4.7 (audit pass, ~45 min, read-only)
Scope: `apps/web/src/app/api/v1/**`, `apps/web/src/app/(dashboard)/**`, `apps/worker/src/crons/**`,
`packages/db/src/schema/**`, `packages/db/sql/seed_*.sql`, `messages/{de,en}/*.json`.
Audits already covered (skipped here): perf indexes, RBAC, error leaks, observability,
critical-path tests (see `docs/audits/*-2026-05-22.md`).

## TL;DR

- Files audited: ~1,750 API route.ts + 470 pages + 121 cron handlers + 108 schema files
  - 144 i18n namespace files spot-checked.
- HIGH gaps: **3** (alpha-user-visible broken behaviour)
- MEDIUM: **2** (operator- or dev-visible only)
- LOW: **4** (cosmetic / future cleanup, mostly Phase-3-stub schemas documented in ADR-014)

## Top 5 fixes by priority

1. **HIGH — `community` / `marketplace` / `portals` / `simulations` module_definition seeds missing.**
   11 dashboard pages (`apps/web/src/app/(dashboard)/{community,marketplace,portals,simulations}/**/page.tsx`)
   wrap themselves in `<ModuleGate moduleKey="...">`, but none of those four `module_key`s appear
   in `packages/db/sql/seed_platform_baseline.sql`, `seed_module_definitions_sprint4_9.sql`,
   `packages/db/src/seed.ts`, nor in any migration that touches `module_definition`. Result: a
   freshly-seeded org sees the `ModuleTeaser` ("module disabled") on every one of those 11 pages
   even though the underlying API routes (`/api/v1/community/...`, `/api/v1/marketplace/...`,
   `/api/v1/portals/...`, `/api/v1/simulations/...`) are fully implemented.
   _Fix sketch:_ add the four rows to `seed_platform_baseline.sql` AND add a migration that
   inserts them with `ON CONFLICT (module_key) DO NOTHING`.

2. **HIGH — Report scheduler never emails recipients despite UI promise.**
   `apps/worker/src/crons/report-scheduler.ts:120` says
   `// TODO: integrate with sendEmail service` — the cron only logs `"would email N recipients"`.
   Meanwhile the UI at `apps/web/src/app/(dashboard)/reports/schedules/page.tsx:96,214,351-360`
   collects an explicit `recipientEmails[]` list with placeholder + help text. Alpha users will
   create scheduled reports expecting an email and never get one (no error surfaced).
   _Fix sketch:_ import `sendEmail` from `@grc/email` and wire it after `reportGenerator.generate`
   completes (also wire failure path to error notification).

3. **HIGH — `<ModuleGate>` `loading` UX is silent for unknown keys.**
   `apps/web/src/components/module/module-gate.tsx` + `hooks/use-module-config.tsx:116` defaults
   missing module definitions to `status: "disabled"` — there is no console warning, no admin
   surfacing. Combined with gap #1, four modules silently disappear from prod. Independent of #1,
   recommend logging `console.warn` once per unknown moduleKey in `use-module-config.tsx`.
   _Fix sketch:_ in `useModuleConfig`, if `configs.length > 0 && !config && !loading` then
   `console.warn` and capture via Sentry; alternatively render an explicit "module not provisioned"
   teaser distinct from "module disabled".

4. **MEDIUM — Process SVG-export endpoint 501s, but the cleaner fix is to remove the route.**
   `apps/web/src/app/api/v1/processes/[id]/export/svg/route.ts` returns `501 Not Implemented`
   with a documented reason ("SVG only renders client-side"). No UI calls it (grep confirms).
   _Fix sketch:_ delete the route file; client-side `<BpmnEditor>` already exports SVG locally.
   Leaving the dead endpoint suggests a missing feature to first-time auditors.

5. **MEDIUM — Phase-3 schema stubs still ship without UI/API.**
   The following Drizzle tables are exported from `packages/db/src/index.ts` and only referenced
   by `apps/worker/tests/helpers/db-exports.ts` (no app reads/writes them):
   `approval-workflow.ts` (7 tables: approval_workflow, approval_request, approval_decision,
   review_cycle, review_decision, attestation_campaign, attestation_response),
   `audit-extras.ts` (3 tables: audit_sample, board_report, exception_report),
   `checklist.ts` (2: checklist_template, checklist_instance),
   `content-narrative.ts` (4: content_placeholder, content_request, narrative_template,
   narrative_instance),
   `control-monitoring.ts` (2), `data-governance.ts` (5),
   `esef-xbrl.ts` (7), `phase3-extras.ts` (most), `erm-advanced.ts::bowtieTemplate`.
   Documented in `docs/adr-014-phase3-stubs.md` as known unfinished, **but** they pollute the
   migration set, audit trail, and RLS coverage report.
   _Fix sketch:_ either follow up with implementing Sprints, OR mark each table with
   `-- Phase-3 placeholder (not yet exposed via API; see ADR-014)` in its migration and exclude
   them from the RLS-coverage-report total to keep the security baseline honest.

## By category

### Dead API links from UI

No outright dead links found during spot check of the 200 fetch sites scanned (paths under
`/api/v1/agents`, `/api/v1/audit-mgmt`, `/api/v1/bcms`, `/api/v1/dpms`, `/api/v1/isms`,
`/api/v1/portals`, `/api/v1/simulations`, `/api/v1/marketplace`, `/api/v1/community`, etc.).
All directory roots referenced from `(dashboard)` pages exist under `apps/web/src/app/api/v1/`.

The closest thing to a dead link is the **module gate orphans** (top-1 above) — UI is fully
wired front-to-back, only the seed row is missing, so the gate hides the page.

### Cron stubs

- `apps/worker/src/crons/report-scheduler.ts:120` — `// TODO: integrate with sendEmail service`
  (logs only; UI promises email delivery). See HIGH #2.
- All other crons with `processed: 0` in their return are legitimate empty-input early-exits
  (verified `playbook-suggestion.ts`, `portal-session-expiry.ts`, `breach-72h-monitor.ts`,
  `policy-overdue-escalation.ts` — each has real work after the early-return).

### Module-gate orphans

| Page (count)                                                                                              | `moduleKey`   | Seed row exists? | API exists?                  |
| --------------------------------------------------------------------------------------------------------- | ------------- | ---------------- | ---------------------------- |
| `community/page.tsx`, `community/contributions/page.tsx`                                                  | `community`   | NO               | YES (`/api/v1/community/`)   |
| `marketplace/page.tsx`, `marketplace/publishers/`, `marketplace/listings/[id]/`, `marketplace/installed/` | `marketplace` | NO               | YES (`/api/v1/marketplace/`) |
| `simulations/page.tsx`, `simulations/scenarios/[id]/`, `simulations/comparisons/`                         | `simulations` | NO               | YES (`/api/v1/simulations/`) |
| `portals/page.tsx`, `portals/sessions/`, `portals/configs/[id]/`                                          | `portals`     | NO               | YES (`/api/v1/portals/`)     |

Seed sources checked: `packages/db/sql/seed_platform_baseline.sql` (15 keys),
`packages/db/sql/seed_module_definitions_sprint4_9.sql` (sprint-4–9 keys),
`packages/db/src/seed.ts` (erm/bpm/esg/whistleblowing), `0042_sprint30_report_engine_threat_landscape.sql`
(reporting), `0297_programme_cockpit.sql` (programme).

### i18n drift

- `messages/de/common.json` has 4547 keys vs `messages/en/common.json` 4546 — **1 key drift**.
  All 71 other namespace files match exactly. Not blocking, but worth a one-off `diff` pass.
- Namespace file presence matches 72/72 between DE and EN.

### Stub / 501 endpoints

- `apps/web/src/app/api/v1/isms/soa/diff/route.ts:38` — returns 501 only when `?fromRunId=` or
  `?toRunId=` is passed (run-based diff); time-based mode (`?since=`) is fully implemented and
  documented as the supported path. **Not a gap** — intentional and signposted in comments.
- `apps/web/src/app/api/v1/processes/[id]/export/svg/route.ts:24` — returns 501 unconditionally
  with a documented hint. **Not called from any UI**. See MEDIUM #4 — recommend removal.

Other `Response.json({ data: [] })` matches (compliance/cci/departments, isms/assets/.../recommended-risks,
erm/fair/compare, risks/group-summary) all sit on legitimate early-return-when-empty paths
with real DB queries below.

### Unused schemas (LOW — already known via ADR-014)

| Schema file                       | Tables | Used by app?              |
| --------------------------------- | ------ | ------------------------- |
| `approval-workflow.ts`            | 7      | No (only `db-exports.ts`) |
| `audit-extras.ts`                 | 3      | No                        |
| `checklist.ts`                    | 2      | No                        |
| `content-narrative.ts`            | 4      | No                        |
| `control-monitoring.ts`           | 2      | No                        |
| `data-governance.ts`              | 5      | No                        |
| `esef-xbrl.ts`                    | 7      | No                        |
| `erm-advanced.ts::bowtieTemplate` | 1      | No                        |
| `phase3-extras.ts` (most)         | ~7     | No                        |

These are formally listed in `docs/adr-014-phase3-stubs.md` and form ~37 tables. They are not
strictly "implementation gaps" in the alpha-user sense (no UI promises them) but they do inflate
the schema/RLS surface area and should be either implemented or excluded from baseline reports.

## Method recap

1. Globbed all `apps/web/src/app/(dashboard)/**/page.tsx` (`fetch(/api/v1/...)`) calls,
   cross-checked against `apps/web/src/app/api/v1/**/route.ts` directory existence. No dead
   roots found.
2. Grepped `apps/worker/src/crons/*.ts` for `// TODO`, `// placeholder`, `processed: 0` returns.
   Only one TODO (`report-scheduler.ts:120`); other `processed: 0` returns are legitimate.
3. Extracted all `<ModuleGate moduleKey="...">` invocations, deduplicated → 20 unique keys.
   Cross-referenced against every `INSERT INTO module_definition` in
   `packages/db/{sql,drizzle,src}/`. Identified 4 missing keys.
4. Spot-checked i18n by counting keys per namespace file (DE vs EN). Single-key drift in
   `common.json`.
5. Grepped every `pgTable("...")` declaration, checked if the camelCase export is referenced
   under `apps/web/src/` or `apps/worker/src/`. Identified ~37 tables only referenced from
   the test helper (i.e. unused at runtime).
6. Grepped for `status: 501` / `NotImplemented` — 2 hits, both documented and (for SVG) unwired.
