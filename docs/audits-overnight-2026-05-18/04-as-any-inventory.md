# `as any` Cast Inventory

Stand: 2026-05-18 overnight session.

- Total occurrences: **206**
- Files affected: **86**

## Category breakdown (heuristic)

| Category | Count | Likely cause |
|---|---|---|
| `other` | 145 | Misc — needs case-by-case review |
| `array-row` | 55 | `as any[]` after `tx.execute(sql\`...\`)` — raw SQL doesn't carry typed rows |
| `err-cast` | 1 | `(err as any).code` — Postgres error code probing, hard to type cleanly without postgres.js types |
| `symbol-probe` | 1 | Drizzle internal Symbol() probe (FK introspection in tests) — necessary |

## Top 30 files

| Count | File |
|---|---|
| 10 | `apps/worker/src/crons/wb-deadline-monitor.ts` |
| 8 | `apps/web/src/__tests__/api/process-cascade-delete.test.ts` |
| 8 | `apps/web/src/app/(dashboard)/catalogs/risks/page.tsx` |
| 7 | `apps/web/src/auth.ts` |
| 7 | `apps/web/src/app/api/v1/whistleblowing/statistics/route.ts` |
| 7 | `apps/web/src/lib/isms-gate-stats.ts` |
| 7 | `packages/auth/src/config.ts` |
| 6 | `apps/web/src/app/api/v1/audit-mgmt/audits/[id]/audit-pack/route.ts` |
| 6 | `apps/web/src/app/api/v1/processes/audit-pack/route.ts` |
| 6 | `apps/web/src/app/api/v1/tprm/vendors/[id]/onboarding-pack/route.ts` |
| 6 | `apps/web/src/__tests__/lib/vendor-gates.test.ts` |
| 5 | `apps/web/src/app/api/v1/dashboard/bpm-kpis/route.ts` |
| 5 | `apps/web/src/app/api/v1/processes/[id]/health-score/route.ts` |
| 5 | `apps/web/src/__tests__/lib/audit-gates.test.ts` |
| 5 | `apps/web/src/__tests__/lib/dpia-gates.test.ts` |
| 4 | `apps/web/src/app/api/v1/admin/scim/stats/route.ts` |
| 4 | `apps/web/src/app/api/v1/scim/v2/Groups/[id]/route.ts` |
| 4 | `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` |
| 4 | `apps/web/src/__tests__/lib/process-gates.test.ts` |
| 4 | `apps/web/src/app/(dashboard)/documents/[id]/page.tsx` |
| 3 | `apps/web/src/app/api/v1/audit-mgmt/audits/[id]/scope-aggregation/route.ts` |
| 3 | `apps/web/src/app/api/v1/dashboard/audit-kpis/route.ts` |
| 3 | `apps/web/src/app/api/v1/dpms/dsr/sla-status/route.ts` |
| 3 | `apps/web/src/__tests__/lib/bpmn-arctos-rehydrate.test.ts` |
| 3 | `apps/worker/src/crons/sub-processor-review-deadline.ts` |
| 2 | `apps/web/src/app/api/v1/ai-act/corrective-actions/route.ts` |
| 2 | `apps/web/src/app/api/v1/audit-mgmt/audits/[id]/ai/suggest-findings/route.ts` |
| 2 | `apps/web/src/app/api/v1/audit-mgmt/audits/[id]/racm/route.ts` |
| 2 | `apps/web/src/app/api/v1/catalogs/mappings/route.ts` |
| 2 | `apps/web/src/app/api/v1/processes/[id]/ai/suggest-controls/route.ts` |

## Recommendation

- `symbol-probe`, `sql-execute`, `array-row`: keep — necessary for raw-SQL and Drizzle internals.
- `drizzle-tx`: investigate. Drizzle's `tx` type can usually be inferred via `db.transaction()` callback's parameter type. Eliminating these would tighten 50+ casts.
- `err-cast`: fixable with a small type-guard helper `isPgError(e): e is { code: string }`.
- `other`: walk through top-20 files and triage.
