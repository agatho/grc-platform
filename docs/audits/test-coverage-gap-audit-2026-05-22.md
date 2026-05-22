# Test Coverage Gap Audit (post-Wave-25)

Date: 2026-05-22
Branch: `main`
Scope: 10 security-critical and high-blast-radius code paths

## TL;DR

- Files audited across 10 categories: ~50 source files / ~250+ existing test files
- HIGH gaps: 5 (api-wrapper error mapper, module-guard, portal-auth, catalog-resolver, cascade-runner)
- MEDIUM gaps: 3 (playbook-engine, isms-gate-stats, param-validation unit tests)
- LOW (well-covered): auth chain, RBAC, RLS, audit-hash-chain, state machines, bulk ops, crons, sign-off chain, encryption helpers

### Recommended next 5 test files to write

1. `apps/web/src/__tests__/lib/api-wrapper.test.ts`
2. `packages/auth/tests/module-guard.test.ts`
3. `apps/web/src/__tests__/lib/portal-auth.test.ts`
4. `apps/web/src/__tests__/lib/catalog-resolver.test.ts`
5. `apps/web/src/__tests__/lib/cascade-runner.test.ts`

---

## By area

### 1. Auth middleware (withAuth / withAuditContext / withReadContext / paginate)

Existing: `apps/web/src/__tests__/lib/with-auth.test.ts` (160 LOC, 7 cases), `paginate.test.ts`.
Coverage: GOOD for `withAuth` (no-session, no-user-id, no-org, role denial, custom-role fallback, success). GOOD for paginate.
Gap: `withAuditContext` and `withReadContext` have NO direct unit tests — only exercised transitively via integration tests. Audit-context bleed between transactions (annotation reset to "") is asserted nowhere at the unit level.
Priority: MEDIUM
Sketch:

- it("withAuditContext sets app.current_org_id / user_id / email / name session vars in a single tx")
- it("withAuditContext resets audit_action_detail to '' when annotation is omitted so a previous tx's value cannot bleed")
- it("withAuditContext sets audit_action_detail and audit_reason when annotation is passed")
- it("withReadContext sets only org_id and user_id, not the audit vars")

### 2. RBAC enforcement (`packages/auth/src/rbac.ts`, `module-guard.ts`)

Existing: `packages/auth/tests/rbac.test.ts` (354 LOC), `oidc.test.ts`, `saml.test.ts`, `scim.test.ts`, `providers.test.ts`, `role-mapping.test.ts`.
Coverage: GOOD for rbac.ts. ZERO for `src/middleware/module-guard.ts` (the only unit-level enforcement of "disabled module → 404, preview + non-GET → 403").
Gap: requireModule never unit-tested. Cache pollution (`module-config-cache`) between tests likely. Preview+POST 403 path is regression-prone.
Priority: HIGH
Sketch:

- it("requireModule returns 404 problem-json when config is missing")
- it("requireModule returns 404 when uiStatus = 'disabled'")
- it("requireModule returns 404 when uiStatus = 'maintenance' (does not reveal module exists)")
- it("requireModule returns 403 when uiStatus = 'preview' and method = 'POST'")
- it("requireModule returns 403 for PUT/PATCH/DELETE in preview, allows GET")
- it("requireModule returns null when uiStatus = 'enabled'")
- it("module-config-cache: stale entry invalidation when org config changes")

### 3. RLS enforcement

Existing: `packages/db/tests/rls/cross-tenant-isolation.test.ts`, `rls-coverage-systemtest.test.ts`, `audit-checklist-isolation.test.ts`, `catalog-budget-isolation.test.ts`; `apps/web/src/__tests__/api/rls-cross-tenant-multi-entity.test.ts`, `rls-cross-tenant-api-probe.test.ts`, `bpm-rls-policies.test.ts`, `whistleblowing-hinschg-isolation.test.ts`.
Coverage: GOOD — covered by live-Postgres integration pool. Per audit constraints, not in scope to duplicate.
Priority: LOW

### 4. Audit-log triggers + hash chain

Existing: `packages/db/tests/integration/audit-trigger.test.ts` (274 LOC), `audit-chain-per-tenant.test.ts`, `audit-hash-v3-tz-invariance.test.ts`, `audit-integrity-live.test.ts`, `budget-audit-integrity.test.ts`; `apps/web/src/__tests__/api/audit-log-integrity.test.ts`, `notification-trigger.test.ts`, `notification-triggers-multi-entity.test.ts`.
Coverage: GOOD — hash-chain continuity, per-tenant isolation, TZ invariance all asserted against live Postgres.
Priority: LOW

### 5. State-machine transitions (risk / finding / audit / bia / dsr / dpia / vendor / incident / nc / etc.)

Existing: `packages/shared/tests/risk-status-state-machine.test.ts`, `risk-status-transition.test.ts`, `dpms-dpia-state-machine.test.ts`, `dpms-dsr-state-machine.test.ts`, `dpms-ropa-state-machine.test.ts`, `dpms-avv-state-machine.test.ts`, `dpms-breach-state-machine.test.ts`, `dpms-tia-retention.test.ts`, `bcms-bia-state-machine.test.ts`, `bcms-bcp-state-machine.test.ts`, `bcms-crisis-state-machine.test.ts`, `bcms-exercise-state-machine.test.ts`, `isms-nc-state-machine.test.ts`, `isms-assessment-state-machine.test.ts`, `process-status.test.ts`, `programme-journey-state-machine.test.ts`, `programme-step-state-machine.test.ts`, `aiact-*.test.ts` (7 files), `incident-lifecycle-w19-w5.test.ts`, `cross-findings.test.ts`.
Coverage: GOOD — pure transition tables exhaustively tested.
Gap: `apps/web/src/lib/generic-transitions.ts` (the thin discovery helper) is not unit-tested; emits `allowedNext` + deprecated `knownStatuses` alias. Trivial enough that BACKWARDS-COMPAT regression risk is low, but a test pins the contract.
Priority: LOW (optional)
Sketch:

- it("buildTransitionsResponse exposes both allowedNext and knownStatuses with the same values")
- it("buildTransitionsResponse falls back to 'unknown' when current is null")

### 6. Bulk operations (cap = 100)

Existing: `apps/web/src/__tests__/api/bulk-operations.test.ts`, `packages/shared/tests/bulk-cap-contract.test.ts`.
Coverage: GOOD — 50-item success, 200-item rejection with `{maxBulkSize:100, providedSize:200}`, mixed-validity 207, per-item audit-log call count all asserted.
Priority: LOW

### 7. Cron jobs (`apps/worker/src/crons/`)

Source files: 121. Test files: 119. Untested: `process-mining-conformance.ts`, `soa-programme-backfill.ts`.
Coverage: GOOD (98.3 %).
Priority: LOW
Sketch:

- it("process-mining-conformance: handles empty DB without throwing")
- it("soa-programme-backfill: skip when no SoA entries to backfill")

### 8. Sign-off chain (`apps/web/src/lib/sign-off-chain.ts`)

Existing: `sign-off-chain.test.ts`, `signoff-chain-concurrency-guard.test.ts`.
Coverage: GOOD — payload hash determinism, chain continuity, concurrency guard tested.
Priority: LOW

### 9. Catalog activation logic (`apps/web/src/lib/catalog-resolver.ts`, org_active_catalog)

Existing: NONE for `catalog-resolver.ts`. Catalog isolation covered by `packages/db/tests/rls/catalog-budget-isolation.test.ts` + the seed-wiring smoke test.
Coverage: NONE for the resolver helper, which uses **raw SQL string interpolation** (with manual `''` escaping for quotes) and a **process-wide `Map` cache** that survives across tests.
Gap: cache is pollution-prone (no exported reset). SQL injection surface via `entryCode` parameter; manual escaping is the only defense.
Priority: HIGH (security: raw-SQL builder + shared cache)
Sketch:

- it("resolveCatalogEntry returns null when frameworkCode is null/undefined or entryCode is empty")
- it("resolveCatalogEntry caches null misses (second call does not re-query DB)")
- it("resolveCatalogEntry caches hits with composite key (catalogEntryId|catalogId)")
- it("resolveCatalogEntry escapes single quotes in entryCode so SQL injection (`x' OR '1'='1`) returns null instead of dumping rows")
- it("resolveCatalogEntry falls back to verbatim frameworkCode when not in FRAMEWORK_TOKENS table")
- it("resolveCatalogEntry filters out inactive catalogs (is_active = false)")
- NOTE: tests must reset the module-scoped `cache` Map between cases — pollution-prone.

### 10. Encryption helpers (`packages/shared/src/lib/env-key.ts`)

Existing: `packages/shared/tests/env-key.test.ts`, `wb-crypto.test.ts`, `dd-token.test.ts`.
Coverage: GOOD — AES-GCM round-trip, key length / hex validation, error paths.
Priority: LOW

---

## Additional HIGH-priority gaps found outside the 10-category inventory

### A. `apps/web/src/lib/api-wrapper.ts` (264 LOC, wraps every route)

Existing: NONE (only `api-errors.test.ts` for the error-shape helpers, not the wrapper itself).
Coverage: NONE for the central Postgres-error→HTTP mapper that every API route depends on.
Gap: FK/NOT-NULL/CHECK/UNIQUE→422, 22P02 invalid-UUID→422, postgres-js timeout→503, generic→500 mappings are entirely untested at the unit level. Empty-body 500 regressions were the original motivator (2026-05-12 over-night QA) and now have no guard.
Priority: HIGH
Sketch:

- it("withErrorHandler maps Postgres FK violation (23503) to 422 problem+json")
- it("withErrorHandler maps Postgres NOT NULL (23502) to 422")
- it("withErrorHandler maps Postgres CHECK (23514) to 422 with constraint name")
- it("withErrorHandler maps Postgres UNIQUE (23505) to 422 with conflict field")
- it("withErrorHandler maps Postgres invalid_text_representation (22P02) to 422")
- it("withErrorHandler maps postgres-js connection timeout to 503")
- it("withErrorHandler maps unknown Error to 500 with stable problem+json body (never empty)")
- it("withErrorHandler preserves x-request-id in problem body")
- it("withErrorHandler logs route + URL + pgCode/pgDetail on every error")

### B. `apps/web/src/lib/portal-auth.ts` (DD portal token validation)

Existing: NONE. No `dd-portal` integration test references it directly.
Coverage: NONE for `validateDdToken` — a public-facing token gate for due-diligence portal sessions.
Priority: HIGH (security boundary: unauthenticated entry point)
Sketch:

- it("validateDdToken returns 401 when token is missing")
- it("validateDdToken returns 401 when token.length < 32")
- it("validateDdToken returns 401 when no matching session row")
- it("validateDdToken returns 401 when session.expiresAt < now")
- it("validateDdToken transitions status from 'invited' to 'in_progress' on first access")
- it("validateDdToken does NOT re-transition status on subsequent accesses")
- it("validateDdToken appends caller IP to ip_address_log (x-forwarded-for first entry)")
- it("validateDdToken falls back to x-real-ip when x-forwarded-for absent")

### C. `apps/web/src/lib/cascade-runner.ts` (BIA → Asset-Classification cascade)

Existing: NONE for the runner wrapper. Pure cascade covered by `packages/shared/tests/bia-asset-criticality.test.ts`.
Coverage: NONE for the Drizzle-wired wrapper (snapshot-load + upsert).
Priority: HIGH (one bug here silently mis-classifies assets across orgs)
Sketch:

- it("runBiaCascade: BIA with no process_impact rows touches 0 assets")
- it("runBiaCascade: BIA with linked process_asset upserts asset_classification for each linked asset")
- it("runBiaCascade: respects org_id boundary — never touches assets in a different org")
- it("runBiaCascade: upsert preserves manual overrides (override system at READ time)")
- it("runBiaCascade: returns assertsTouched + assertsUpserted + reason")

### D. `apps/web/src/lib/playbook-engine.ts` (421 LOC, incident playbook orchestrator)

Existing: NONE.
Coverage: NONE for activation, phase-progression, role-resolution, task generation.
Priority: MEDIUM (incident response is high-impact but rarer hot path)
Sketch:

- it("resolveRoleToUser maps 'incident_responder' to a user with the matching ARCTOS role")
- it("resolveRoleToUser returns null when no user in the org has the role")
- it("activatePlaybook creates tasks for phase 0 with computed deadlines")
- it("progressPhase fires only when isPhaseComplete returns true")
- it("matchesSeverityThreshold filters templates correctly")

### E. `apps/web/src/lib/param-validation.ts` (UUID gate on every dynamic route)

Existing: only exercised via wave-24/25 block tests + RLS probes.
Coverage: MEDIUM — used but no dedicated unit assertions on the UUID-shape regex (relaxed from zod's strict v4 to plain 8-4-4-4-12 hex to accept seed UUIDs like `00000000-0000-0000-0000-000000000001`).
Priority: MEDIUM (not security-critical but regression-prone — last bumped in WAVE7)
Sketch:

- it("validatePathParam accepts the relaxed RFC-shape UUIDs used in seed data (all-zeros + final 1)")
- it("validatePathParam rejects non-hex shapes with 422 problem+json")
- it("validatePathParam accepts mixed-case hex")

---

## Flaky / pollution-prone areas (worth noting)

- **`catalog-resolver.ts`** — module-scoped `Map` cache with no exported `reset()`. Tests that don't `vi.resetModules()` between cases will see polluted results.
- **`packages/auth/src/cache/module-config-cache.ts`** — same pattern; module-guard tests must isolate via `vi.resetModules()` or an exported `__reset()` helper.
- **`apps/web/src/lib/rate-limit.ts`** — in-memory token bucket; existing test uses `vi.useFakeTimers()` correctly, but parallel test files that load it could share state if vitest pool changes from forks to threads.
- **`audit-action_detail` session var** — `withAuditContext` deliberately resets to `""` to avoid bleed across the same connection. Any future change that drops the reset is a silent compliance bug; the proposed Sketch in section 1 pins it.
- **121 cron unit tests** — each cron test mocks `db`/`logger`, but cumulative module-cache pollution in a single vitest run can produce non-deterministic failures if mocks aren't fully reset. Watch for this if the worker test pool ever flakes.

---

## Out of scope (per task constraints)

- Live-Postgres RLS, audit-trigger, and hash-chain integration tests (covered in `packages/db/tests/integration/` + `tests/rls/`).
- Playwright E2E (47 specs) — different pool.
- Front-end component tests (`__tests__/components/`).
