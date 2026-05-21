# Error Handling + Observability Audit (post-Wave-25)

> Scope: `apps/web/src/app/api/v1/**/route.ts` + `apps/worker/src/crons/*.ts`.
> Method: glob + grep (read-only). Routes/crons known to have been added/
> normalised in Waves 23–25 are excluded from the "fix me" lists where
> obvious from context.
> Sources of truth: `apps/web/src/lib/api-wrapper.ts` (RFC-7807 wrapper),
> `apps/web/src/lib/api-errors.ts` (`problem.*`, `getRequestId()`).

## TL;DR

- Route files exporting an HTTP-verb handler: **1,183**
- Files that import / use `withErrorHandler`: **125** (~10.6%)
- Files that explicitly call `getRequestId(...)` outside the wrapper: **16** (~1.3%)
- Routes that surface `err.message` / `err.stack` in the response body
  (CodeQL `js/stack-trace-exposure` risk class): **at least 17 confirmed
  hot spots** (see below)
- Empty / no-op `catch { ... }` blocks under `apps/web/src/app/api`:
  **0** (clean — every `catch` does something)
- Crons with no `console.*` or `log.*` calls at all (no observability): **6**
- Crons using `console.log` instead of structured `log.info`: **all 115
  that log anything** — the worker has no structured logger imported in
  any cron file.
- Crons that record start/end duration (`Date.now()` deltas, `durationMs`):
  **3 of 121** (`simulation-runner.ts`, `evidence-review-processor.ts`,
  `connector-schedule-runner.ts`)
- 400 vs 422 split on Zod validation failure: **roughly 50/50** — every
  module mints its own convention. Confirmed: 30+ files return 400 for
  `parsed.error.flatten()`, 30+ files return 422 for the same shape.

## Errors

### Bypassing `withErrorHandler` (highest-risk endpoints first)

The wrapper is optional, so this isn't a build-breaking finding — but
routes that are likely to throw Postgres errors (high-write, FK-heavy,
or wrapping AI / external calls) should be migrated, because today they
have ad-hoc 500-handling that leaks error details. The list below is
not exhaustive (1,058 unwrapped route files); these are the ones the
grep also flagged as leaking `err.message`:

- `apps/web/src/app/api/v1/programmes/journeys/[id]/predictive/route.ts:32-43` — also returns `err.stack` in non-prod (see below).
- `apps/web/src/app/api/v1/programmes/journeys/[id]/next-actions/route.ts:124-131`
- `apps/web/src/app/api/v1/programmes/journeys/route.ts:111-119`
- `apps/web/src/app/api/v1/bi-reports/queries/execute/route.ts:80-91`
- `apps/web/src/app/api/v1/eam/ai/config/validate/route.ts:64-77`
- `apps/web/src/app/api/v1/automation/rules/[id]/test/route.ts:72-81`
- `apps/web/src/app/api/v1/webhooks/[id]/test/route.ts:109-118`
- `apps/web/src/app/api/v1/dashboards/[id]/data/route.ts:101-107`
- `apps/web/src/app/api/v1/translations/import/route.ts:185-189, 220-223, 339-341`
- `apps/web/src/app/api/v1/import/upload/route.ts:116-128`
- `apps/web/src/app/api/v1/import/[jobId]/validate/route.ts:105-117`
- `apps/web/src/app/api/v1/export/bulk/route.ts:65-73`
- `apps/web/src/app/api/v1/processes/bulk-approve/route.ts:225-231`
- `apps/web/src/app/api/v1/processes/bulk/route.ts:141-146`
- `apps/web/src/app/api/v1/dmn/[id]/batch-test/route.ts:49-55`

### Leaking error details into the response body

These return the raw exception message (and in one case the stack) to
the HTTP client. CodeQL `js/stack-trace-exposure` flagged this exact
pattern in Wave 11 — the wrapper logs `err.message + stack` server-side
with `requestId` and the client gets only the requestId. The routes
below should adopt `withErrorHandler` or, at minimum, drop the message
from the response.

| File:Line | Risk | Notes |
| --- | --- | --- |
| `apps/web/src/app/api/v1/programmes/journeys/[id]/predictive/route.ts:30-43` | **High** | Returns `err.message` **and** `err.stack` (gated only on `NODE_ENV !== "production"` — leaks in staging / preview). |
| `apps/web/src/app/api/v1/programmes/journeys/[id]/next-actions/route.ts:127-130` | Medium | Returns `reason: message` in body. |
| `apps/web/src/app/api/v1/programmes/journeys/route.ts:111-119` | Medium | Unique-violation string-match on `err.message` — fragile + leaky. |
| `apps/web/src/app/api/v1/bi-reports/queries/execute/route.ts:88-90` | Medium | Returns `details: message` from arbitrary SQL execution — most likely to leak schema/table names. |
| `apps/web/src/app/api/v1/eam/ai/config/validate/route.ts:71-76` | Medium | AI provider error surfaced raw. |
| `apps/web/src/app/api/v1/automation/rules/[id]/test/route.ts:73-79` | Medium | Dry-run path returns user-rule eval errors verbatim. |
| `apps/web/src/app/api/v1/import/upload/route.ts:121-127` | Medium | Returns `details: err.message` from FS / parse errors. |
| `apps/web/src/app/api/v1/import/[jobId]/validate/route.ts:110-116` | Medium | Same shape as above. |
| `apps/web/src/app/api/v1/import/[jobId]/execute/route.ts:101, 112` | Medium | Per-row + outer 500 both leak. |
| `apps/web/src/app/api/v1/import/templates/[entityType]/route.ts:36-40` | Low | Leaks parser detail. |
| `apps/web/src/app/api/v1/export/bulk/route.ts:65-73` | Medium | Drizzle / CSV streaming errors → raw `err.message`. |
| `apps/web/src/app/api/v1/dashboards/[id]/data/route.ts:101-107` | Medium | Per-widget fetch errors echoed back. |
| `apps/web/src/app/api/v1/dmn/[id]/batch-test/route.ts:49-55` | Low | Eval-engine errors per test case. |
| `apps/web/src/app/api/v1/webhooks/[id]/test/route.ts:109-118` | Low | Test-button only, but returns DNS / TLS error strings raw. |
| `apps/web/src/app/api/v1/processes/bulk-approve/route.ts:225-231` | Low | Per-row error array contains raw `(err as Error).message`. |
| `apps/web/src/app/api/v1/processes/bulk/route.ts:141-146` | Low | Same. |
| `apps/web/src/app/api/v1/translations/import/route.ts:185-191, 220-223, 339-341` | Low | XLIFF / CSV parser errors echoed verbatim. |

Out-of-scope but worth a follow-up: every SSO / SCIM route
(`auth/sso/saml/callback`, `auth/sso/oidc/{login,callback}`,
`scim/v2/{Users,Groups}`) wraps `err.message` with a fallback like
`"SAML authentication failed"`. The fallback is used when `err`
is not an `Error`; otherwise the actual message goes out. These are
unauthenticated endpoints — fixing them is more sensitive than the
internal routes above.

### Silent swallows

- **None found in `apps/web/src/app/api`.** Grep for `catch (_?[a-z]+) {}`,
  `catch {}`, `.catch(() => null|undefined|{})` in the API tree returns
  zero hits. Every catch block either logs, updates DB state, or
  returns a Response. This is healthy — the Wave-18 / Wave-22 sweeps
  appear to have closed the silent-swallow gap.

The single `.catch(() => null)` survivor lives at
`apps/web/src/app/api/v1/dpms/audit-log-tombstone/route.ts:46` and is
intentional: `await req.json().catch(() => null)` for body parsing,
followed by an explicit "no body" branch.

### Inconsistent 4xx vs 5xx for the same error class

Validation (Zod `safeParse` + `parsed.error.flatten()`) is split between
modules. Examples:

- **Returns 400** (`Invalid parameters` or `Validation failed` w/ status
  400):
  - `apps/web/src/app/api/v1/graph/impact/route.ts:21-25`
  - `apps/web/src/app/api/v1/isms/maturity/roadmap/route.ts`
  - 30+ other files, mostly older (Sprint <50) modules.
- **Returns 422** (matches `problem.validation` from `api-errors.ts`):
  - `apps/web/src/app/api/v1/programmes/journeys/route.ts`
  - `apps/web/src/app/api/v1/vendors/[id]/route.ts`
  - `apps/web/src/app/api/v1/tprm/vendors/[id]/sign-off/route.ts`
  - All of `apps/web/src/app/api/v1/programmes/**`
  - 30+ other newer (post-Wave-15) modules.

Recommendation: pick 422 (RFC 7807 + matches `problem.validation()`),
codemod the 400 → 422 migration once.

### Routes missing `requireModule(...)`

Out-of-scope for this audit per the brief (Waves 18-22 patched these,
post-Wave-22 additions are assumed correct). Spot-check of 5 randomly-
sampled post-Wave-22 routes shows `requireModule` present in all 5.

## Observability

### Crons without structured logging (no `log.*`)

**Every single cron** under `apps/worker/src/crons/` uses `console.log`
/ `console.error` rather than a structured logger. The worker has no
`logger.ts` / `log.ts` module (Glob `apps/worker/src/**/logger.ts`
returns zero hits). Until that exists, the recommendation is to add
one (mirroring `apps/web/src/lib/logger.ts`) and codemod the crons.

Crons with **no** logging at all (no `console.*` and no `log.*`):

- `apps/worker/src/crons/cloud-compliance-snapshot.ts` — 121-line job
  that touches every active cloud connector per org; silent on success
  and on failure.
- `apps/worker/src/crons/connector-health-monitor.ts` — has a swallow
  on line 46 (`} catch {`) that writes "Health check failed" to the DB
  but never logs the real exception.
- `apps/worker/src/crons/connector-schedule-runner.ts`
- `apps/worker/src/crons/framework-coverage-snapshot.ts` — weekly job
  over `frameworkGapAnalysis`; total silence.
- `apps/worker/src/crons/var-calculation-runner.ts`
- `apps/worker/src/crons/webhook-retry.ts` — thin wrapper around
  `processWebhookRetries`, but the delegate's logging story is
  unaudited.

### Crons without duration tracking

118 of 121 cron handlers do not record start/end timestamps. The three
that do (`simulation-runner.ts`, `evidence-review-processor.ts`,
`connector-schedule-runner.ts`) are the only files that can be paged
on "this cron took too long". Recommendation: a shared
`runWithMetrics(name, fn)` helper in `apps/worker/src/lib/` that wraps
every cron entry with start/end + `log.info("cron complete", {name,
durationMs, ...stats})`.

### Missing requestId in critical paths

Only 16 of 1,183 route files invoke `getRequestId()` directly. The
other 1,167 rely on:
- **The wrapper** (125 files) — gets requestId for free.
- **Nothing** (~1,042 files) — error responses carry no correlation ID,
  so operators cannot grep the logs from a customer ticket.

This is the single biggest observability gap in the audit. The cheapest
fix: wrap the remaining 1,000+ routes with `withErrorHandler` — even
when the handler already has its own try/catch, the wrapper's outer
try/catch is harmless (the inner catch wins, per the wrapper's own
comment lines 31-33).

Critical paths confirmed to be missing requestId despite custom error
handling:
- All of `apps/web/src/app/api/v1/import/**` — high-failure surface.
- All of `apps/web/src/app/api/v1/export/**`.
- `apps/web/src/app/api/v1/bi-reports/queries/execute/route.ts` — runs
  user SQL, fails often, but the 500 body has no requestId.
- `apps/web/src/app/api/v1/graph/impact/route.ts` and most of
  `graph/**` — `console.error` only, no requestId in response.
- `apps/web/src/app/api/v1/dashboards/[id]/data/route.ts` — widget
  fetcher, partial failures land in user-visible errors with no
  correlation ID.

### `console.error` in API routes (29 occurrences across 29 files)

These should move to `log.error(...)` via `apps/web/src/lib/logger.ts`.
Sampled hot spots:

- `apps/web/src/app/api/v1/risks/export/route.ts:154`
- `apps/web/src/app/api/v1/import/upload/route.ts:117`
- `apps/web/src/app/api/v1/programmes/journeys/[id]/next-actions/route.ts:126`
- `apps/web/src/app/api/v1/programmes/journeys/[id]/predictive/route.ts:31`
- `apps/web/src/app/api/v1/processes/bulk/route.ts` (multiple)
- `apps/web/src/app/api/v1/processes/[id]/status/route.ts`
- `apps/web/src/app/api/v1/processes/[id]/versions/route.ts`
- `apps/web/src/app/api/v1/processes/import-bpmn-xml/route.ts`
- All of `apps/web/src/app/api/v1/graph/**/route.ts` (10 files)
- All of `apps/web/src/app/api/v1/isms/soa/**/route.ts` (5 files)
- All of `apps/web/src/app/api/v1/programmes/journeys/**`
- `apps/web/src/app/api/v1/findings/export/route.ts`
- `apps/web/src/app/api/v1/reports/generate/route.ts`
- `apps/web/src/app/api/v1/bcms/bia/export/route.ts`
- `apps/web/src/app/api/v1/dpms/ropa/export/route.ts`

## Recommended Top-5 Fixes (ready to implement)

1. **Codemod: drop `err.message` from response bodies on the 17 routes
   listed above** (and either keep the existing try/catch with a
   generic message + requestId, or wrap with `withErrorHandler`).
   Highest-priority single file:
   `apps/web/src/app/api/v1/programmes/journeys/[id]/predictive/route.ts`
   (returns stack in non-prod).
2. **Add `apps/worker/src/lib/logger.ts` + `runWithMetrics(name, fn)`
   helper, codemod every cron to use it.** Resolves both "no structured
   logging" and "no duration tracking" in one PR. Aim for
   `log.info("cron.complete", {name, durationMs, ...stats})`.
3. **Adopt 422 as the canonical Zod-failure status.** Codemod the ~30
   files that currently return 400 with `parsed.error.flatten()` to
   use `problem.validation({...})` (the helper exists and is unused
   in 90% of routes).
4. **Wrap the import/export/graph/dashboard/bi-reports routes with
   `withErrorHandler`** (highest-failure surfaces with the most leaky
   custom catch blocks). One PR, ~30 files, mechanical change — gets
   them requestId + RFC-7807 + structured logging for free.
5. **Backfill logging on the 6 zero-log crons** (`cloud-compliance-snapshot`,
   `connector-health-monitor`, `connector-schedule-runner`,
   `framework-coverage-snapshot`, `var-calculation-runner`,
   `webhook-retry`). Even one `console.log` at start + end with a stat
   line would be a 10x improvement over today's silence.
