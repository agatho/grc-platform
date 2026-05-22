# Dependency + Config Hygiene Audit (post-Wave-26)

**Date:** 2026-05-23
**Scope:** `grc-platform/` (post-Wave-26, `main`)
**Method:** `npm audit --omit=dev --audit-level=moderate --json`, `npm outdated`, `npm ls`, grep/Read on source. No `--fix` run.

---

## TL;DR

- **npm audit (prod):** 0 critical / 0 high / **4 moderate** / 0 low. All four chained from one root: `exceljs → archiver → uuid <11.1.1` (GHSA-w5hq-g745-h8pq) and `next → postcss <8.5.10` (GHSA-qx2v-qp2m-jg93). Both fix paths are SemVer-major and not justified yet.
- **Hardcoded secret fallbacks:** none for sensitive secrets. `WB_ENCRYPTION_KEY` and `CONNECTOR_ENCRYPTION_KEY` correctly throw when unset. `AUTH_SECRET` has no fallback (good). The only hardcoded-default secret risk is `.env` (dev): `AUTH_SECRET=arctos-dev-secret-key-change-in-production-2026` and `CRON_SECRET=arctos-cron-secret-change-in-production` — still operator-rotation reminders (see memory: default-admin-password). Production compose uses `${CRON_SECRET:-change-me}` which is a weak fallback that should fail-fast.
- **Missing .env.example keys (operator-facing only):** `REDIS_URL`, `NEXTAUTH_URL` (legacy, used in 8 routes), `PORTAL_BASE_URL`, `UPLOAD_DIR`, `REPORT_OUTPUT_DIR`, `ARCTOS_LOG_LEVEL`, `ARCTOS_SERVICE`, `NVD_API_KEY`, `BAFIN_FEED_URL`, `BSI_FEED_URL`, `EURLEX_FEED_URL`, `SVIX_TOKEN`, `SVIX_SERVER_URL`, `WEBHOOK_ALLOW_HTTP`, `WEBHOOK_ALLOW_PRIVATE_HOSTS`, `LMSTUDIO_API_KEY`. 16 operator-facing env vars never appear in `.env.example`.
- **console.log in API/lib:** 0 raw `console.log` calls in `apps/web/src/app/api/` or `apps/web/src/lib/` (one in `lib/logger.ts` is a documentation comment). Worst offender: none. `console.warn`/`console.error` are present in auth.ts/oidc/etc. but are intentional error-path diagnostics. Pleasingly clean.

---

## Top 5 immediate fixes

1. **Strip `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` from `apps/web/next.config.ts`** — these silently let TypeScript and ESLint errors ship to prod. CLAUDE.md says checks "run separately in CI", but combined with the `continue-on-error: true` on the coverage job (`.github/workflows/coverage.yml:51`), there is a real failure-blind window. Either tighten CI (gate on type-check + lint as required checks) or drop the build-time bypass.
2. **Add operator-facing env vars to `.env.example`.** `REDIS_URL` is referenced in rate-limit + 2 admin cache routes; `NEXTAUTH_URL` is read by 8 SSO/SCIM/portal routes with a `?? "https://localhost:3000"` fallback that will silently misroute callbacks on misconfigured prod nodes. `WEBHOOK_ALLOW_HTTP`/`WEBHOOK_ALLOW_PRIVATE_HOSTS` are SSRF-guards; their absence from `.env.example` makes audit unhappy.
3. **Pin Docker base images by digest, not tag.** `Dockerfile` and `Dockerfile.worker` use `node:22-alpine` (floating). `docker-compose.production.yml` pins `timescale/timescaledb:latest-pg16` (floating "latest") and `redis:7-alpine` (floating minor). At minimum bump TimescaleDB to a specific tag; ideally digest-pin all three.
4. **Tighten production compose secret defaults to fail-fast.** `docker-compose.production.yml` currently does `${DB_PASSWORD:-grc_prod_password}` and `${CRON_SECRET:-change-me}`. `AUTH_SECRET` and `WB_ENCRYPTION_KEY` already use `${...:?...}` (correct). Apply the `:?` pattern to `DB_PASSWORD` and `CRON_SECRET` so deploys without the var refuse to start rather than booting with the published default.
5. **`apps/worker/tsconfig.json` drift.** Worker tsconfig does not extend `tsconfig.base.json` — it redefines compiler options and silently omits `noUnusedLocals` and `noUncheckedIndexedAccess`. Extend the base or restore those flags; same issue in `apps/web/tsconfig.json` (no `noUnusedLocals`, no `noUncheckedIndexedAccess`).

---

## By category

### npm audit (prod)

```
4 moderate, 0 high, 0 critical (1266 total deps, 552 prod)
```

| Advisory            | Pkg     | Range   | Root                       | Notes                                                                                                                                                                                      |
| ------------------- | ------- | ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GHSA-w5hq-g745-h8pq | uuid    | <11.1.1 | exceljs (4.4.0) → archiver | OOB write in v3/v5/v6 buffer mode. ARCTOS uses `exceljs.Workbook().xlsx.write*` only; v4-random path is not hit. Risk: low. Fix requires major upgrade of exceljs (SemVer-major reported). |
| GHSA-qx2v-qp2m-jg93 | postcss | <8.5.10 | next 15.5.18               | XSS via unescaped `</style>` in stringify. CSS pipeline at build only — no runtime CSS-injection from user input. Fix is `next@16` (major, not yet vetted). Risk: low.                     |

Both moderates are noisy but not exploitable in the current code paths. **No action required this sprint** beyond an SCA suppression note.

### Outdated critical-path deps (>6 months behind)

| Package             | Current       | Latest                             | Verdict                                                         |
| ------------------- | ------------- | ---------------------------------- | --------------------------------------------------------------- |
| `next`              | 15.5.18       | 16.2.6                             | Skip until alpha exit. Next 16 has app-router breaking changes. |
| `@types/node`       | 22.19.19      | 25.9.1                             | Acceptable; pinned to Node 22 LTS.                              |
| `next-auth`         | 5.0.0-beta.31 | beta.31 (latest stable is 4.24.14) | On beta intentionally per ADR-007 rev.1.                        |
| `drizzle-orm`       | 0.45.2        | (no newer in registry view)        | OK.                                                             |
| `react-grid-layout` | 1.5.3         | 2.2.3                              | Behind; review when alpha closes.                               |
| `puppeteer`         | 24.43.1       | 25.0.4                             | Behind one major. Chromium-binding break risk. Skip.            |
| `hono`              | 4.12.21       | 4.12.22                            | Patch-level only. Trivial bump for worker.                      |
| `@hono/node-server` | 1.19.14       | 2.0.3                              | Major; skip.                                                    |
| `zod`               | 3.25.76       | 4.4.3                              | Major; entire codebase uses v3 imports. Skip.                   |
| `motion`            | 12.39.0       | 12.40.0                            | Patch; bump on next minor sweep.                                |

Lockfile is **in sync** with package.json (`npm install --dry-run` = "up to date"). Engine pin: `node >=22`, `npm@11.12.0`.

### Deprecated transitive deps (prod)

| Package                                                              | Path                                                        | Severity                                                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `glob@7.2.3`                                                         | exceljs → archiver/archiver-utils + unzipper/fstream/rimraf | Low — load-time only                                                                                                     |
| `inflight@1.0.6`                                                     | glob@7 transitive                                           | Memory-leak risk; only hit during archive ops                                                                            |
| `rimraf@2.7.1`                                                       | unzipper → fstream                                          | unzipper itself is also archived upstream                                                                                |
| `fstream@1.0.12`                                                     | unzipper                                                    | unmaintained                                                                                                             |
| `lodash.isequal@4.5.0`                                               | recharts ancestor                                           | deprecated, replaced upstream; recharts 3.x will drop.                                                                   |
| `@react-email/*` (body/button/code-block/heading/img/link/text/etc.) | @react-email/components                                     | Marked deprecated because consolidated into `@react-email/components`. Functional, but a future SCA scan will flag them. |
| `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`                 | merged into tsx                                             | Dev only via drizzle-kit.                                                                                                |
| `@types/react-grid-layout`                                           | shipped with `react-grid-layout` upstream now               | Dev only.                                                                                                                |

**No deprecated prod dep is currently exploitable.** Action: track for the next major-bump sprint.

### env-var drift

#### Hardcoded `??` / `||` fallbacks (sensitive ones)

| File                                                                | Var                                           | Fallback                                    | Verdict                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/api/v1/auth/sso/oidc/login/route.ts`              | `NEXTAUTH_URL`                                | `https://localhost:3000`                    | **Bad** in prod — OIDC `redirect_uri` will literally point at localhost. 8 SSO/SCIM routes share this pattern. Make it required, not defaulted.                                            |
| `apps/web/src/app/api/v1/scim/v2/Users/*`                           | `NEXTAUTH_URL`                                | `https://localhost:3000`                    | Same.                                                                                                                                                                                      |
| `apps/web/src/app/api/v1/calendar/ical/generate-token/route.ts`     | `NEXT_PUBLIC_APP_URL`                         | `https://arctos.local`                      | Tokens get baked with arctos.local URL; harmless but operator-confusing.                                                                                                                   |
| `apps/web/src/app/api/v1/vendors/[id]/dd/invite/route.ts`           | `PORTAL_BASE_URL → NEXTAUTH_URL → (nothing?)` | chained                                     | OK as graceful fallback.                                                                                                                                                                   |
| `apps/web/src/app/api/v1/documents/[id]/{download,upload}/route.ts` | `UPLOAD_DIR`                                  | `process.cwd() + "../../uploads/documents"` | Filesystem traversal-style relative path. In standalone Docker the cwd is `/app`, so this resolves to `/uploads/documents` which doesn't exist. Make required or anchor to a known prefix. |
| `packages/reporting/src/generator.ts`                               | `REPORT_OUTPUT_DIR`                           | `/tmp/arctos-reports`                       | OK on Linux; ephemeral tmpfs in compose means reports are lost on container restart.                                                                                                       |
| `packages/email/src/EmailService.ts`                                | `RESEND_FROM_NAME/RESEND_FROM_EMAIL`          | `noreply@arctos.cws.de`                     | Hardcoded vendor name in fallback — stale brand.                                                                                                                                           |
| `packages/ai/src/providers/lmstudio.ts`                             | `LMSTUDIO_API_KEY`                            | `lm-studio`                                 | Local-only; harmless.                                                                                                                                                                      |
| `packages/shared/src/wb-crypto.ts`                                  | `WB_ENCRYPTION_KEY`                           | **throws**                                  | Correct.                                                                                                                                                                                   |
| `apps/web/src/app/api/v1/connectors/[id]/credentials/route.ts`      | `CONNECTOR_ENCRYPTION_KEY`                    | (via `packages/shared/src/env-key.ts`)      | Throws if unset. Correct.                                                                                                                                                                  |

`AUTH_SECRET` is never defaulted in source — only at build time the Dockerfile uses a placeholder ARG, then the runtime image strips it. Confirmed clean.

#### Missing from `.env.example`

Operator-facing (used by source, not documented):
`REDIS_URL`, `NEXTAUTH_URL`, `PORTAL_BASE_URL`, `UPLOAD_DIR`, `REPORT_OUTPUT_DIR`, `ARCTOS_LOG_LEVEL`, `ARCTOS_SERVICE`, `NVD_API_KEY`, `BAFIN_FEED_URL`, `BSI_FEED_URL`, `EURLEX_FEED_URL`, `SVIX_TOKEN`, `SVIX_SERVER_URL`, `WEBHOOK_ALLOW_HTTP`, `WEBHOOK_ALLOW_PRIVATE_HOSTS`, `LMSTUDIO_API_KEY`.

CI/Next.js intrinsics (justified omission): `CI`, `GITHUB_*`, `PORT`, `NODE_ENV`, `BUILD_TIME`, `GIT_SHA`, `GIT_BRANCH`, `NEXT_PUBLIC_GIT_*`, `NEXT_PUBLIC_BUILD_TIME`, `APP_VERSION`, `E2E_BASE_URL`, `INTEGRATION_DATABASE_URL`.

### Auth / session config

`packages/auth/src/config.ts` + `apps/web/src/auth.ts`:

- Strategy: JWT, `maxAge: 8h` — sensible.
- Cookie name: `arctos-org-id` (org-context), httpOnly/sameSite/secure defaults from next-auth — not explicitly overridden. **Confirm in next-auth source that `secure: true` is set when `NODE_ENV=production`** (next-auth defaults are correct but it's worth pinning explicitly).
- Pages: `signIn: "/login"`.
- Providers: credentials + Azure AD (conditional on env vars). Build is gated correctly via `buildAzureAdProvider()`.
- `signIn` callback handles JIT-provisioning for Azure AD; failures return `false` (deny) — good. The catch logs via `console.error` (one of two reasonable raw-console calls).
- `session` callback re-reads roles from DB on every session resolution. **Verify performance impact** in hot paths (1.7k routes × per-request) — at scale this is a DB roundtrip per request. Memory: nothing flagged this so far, but at >100 RPS it will show up. Consider 30s in-process cache.

No fishy callbacks. No `redirect` callback override (next-auth defaults are safe; verify against current SSO URL fallback).

### Next.js config

`apps/web/next.config.ts`:

- `output: "standalone"` — set.
- `serverExternalPackages: ["javascript-opentimestamps", "pdfkit"]` — correctly externalized.
- `images.domains` — not configured (no remote images allowed). Good.
- `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` — **risk**. See Fix #1.
- `outputFileTracingIncludes` for pdfkit assets — solid.
- `poweredByHeader: false` — good (no `X-Powered-By: Next.js` leak).
- No CSP header configured at the Next layer — assuming this is handled in `apps/web/src/middleware.ts` or behind nginx. Worth double-checking against ADR / Wave-19 hardening.

### tsconfig strictness

| File                                | strict      | noUnusedLocals          | noUncheckedIndexedAccess | extends base? |
| ----------------------------------- | ----------- | ----------------------- | ------------------------ | ------------- |
| `tsconfig.base.json`                | ✅          | ✅                      | ✅                       | —             |
| `apps/web/tsconfig.json`            | ✅          | ❌ missing              | ❌ missing               | ❌ no         |
| `apps/worker/tsconfig.json`         | ✅          | ❌ missing              | ❌ missing               | ❌ no         |
| `packages/automation/tsconfig.json` | (from base) | **explicitly disabled** | **explicitly disabled**  | ✅            |
| `packages/events/tsconfig.json`     | (from base) | ✅                      | ✅                       | ✅            |
| `packages/graph/tsconfig.json`      | (from base) | **explicitly disabled** | **explicitly disabled**  | ✅            |
| `packages/reporting/tsconfig.json`  | (from base) | ✅                      | ✅                       | ✅            |

Weakest: `apps/web` and `apps/worker` — neither extends the base. Both `packages/automation` and `packages/graph` explicitly opt out of `noUnusedLocals` and `noUncheckedIndexedAccess`. Documented exception or technical debt — pick one.

### Build / CI hygiene

- `.github/workflows/coverage.yml:51` — `continue-on-error: true` on the test-coverage run. Memory notes "no continue-on-error bypass" — this is the one survivor. Justified ("individual failures should not block aggregation") but the comment is misleading: the workflow is **green even when tests fail**. Either (a) move the aggregation step to a separate job that depends on test success, or (b) at least mark the workflow as informational so it's not used as a quality gate.
- All other workflows (`ci.yml`, `codeql.yml`, `dependency-review.yml`, `migration-policy.yml`, `schema-drift.yml`, `scorecard.yml`, `secret-scanning.yml`, `i18n-coverage.yml`) — clean.
- Action SHAs pinned per WAVE11-SCORECARD. Good.

### Dockerfile / compose

- `Dockerfile` (web): node:22-alpine multi-stage, non-root user, standalone output, build args for SHA/branch/time. Solid. **Floating tag** (`node:22-alpine`) — pin to digest for supply-chain trust.
- `Dockerfile.worker`: same base; `npm ci --ignore-scripts` is good. Same floating-tag note.
- `docker-compose.production.yml`: `read_only: true`, `tmpfs: /tmp`, `no-new-privileges`, ports bound to `127.0.0.1` only — well-hardened. Issues:
  - `${DB_PASSWORD:-grc_prod_password}` — should be `:?` required.
  - `${CRON_SECRET:-change-me}` — should be `:?` required.
  - `timescale/timescaledb:latest-pg16` and `redis:7-alpine` — pin minor or digest.

### .gitignore / .dockerignore

`.gitignore`: ignores `*.env`, `*.env.local`, `node_modules`, `.next`, coverage, playwright artefacts, `.claude/`, `CLAUDE.md`. Comprehensive.

`.dockerignore`: ignores `node_modules`, `.git`, `.github`, `docs`, `*.env`, `*.env.local`, `*.env.production`, `*.log`. Solid.

### TODO / FIXME triage

Real TODOs in source (non-vendored): **2**

| File                                                           | Comment                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/organizations/[id]/page.tsx:190` | `TODO(alpha-followup):` camelCase normalization — stale, alpha closing                                              |
| `apps/web/src/lib/rate-limit.ts:94`                            | `TODO: Phase 2 — echte Redis-Implementation hinter REDIS_URL` — still relevant; rate-limit currently in-memory only |

The rate-limit TODO is the one worth tracking — `REDIS_URL` is set in compose, and rate-limit not hitting Redis means per-pod limits in any multi-pod future. Add a Wave-25/26 backlog item.

### Console.log in production paths

`apps/web/src/app/api/` and `apps/web/src/lib/`: **0 hits** for `console.log`. One commented mention in `lib/logger.ts` explaining browser-side usage. No worst-offender to list — `log.*` is consistently used.

`console.warn` / `console.error` calls exist in `apps/web/src/auth.ts` (`[SSO] JIT provisioning failed`, `[auth] fresh role fetch failed`) — these are error paths that pre-date the structured logger and should be migrated to `log.error` for consistency. Low priority.

### Unused production deps (spot check)

Sampled high-value packages — all confirmed referenced:

- `jszip` → 5 routes
- `papaparse` → import-export parser
- `pdfkit` → `apps/web/src/lib/pdf.ts`
- `puppeteer` → reporting package + web (PDF export)
- `motion`, `recharts`, `sonner`, `react-grid-layout` → UI
- `bpmn-js`, `bpmn-js-properties-panel` → BPM
- `next-themes` — confirmed via `(auth)/login/page.tsx` imports

No obvious unused prod deps. (`@react-email/components` + `resend` at root `package.json` are slightly odd at workspace root but are workspace-shared deps for the email package — harmless.)

---

## Out of scope / deferred

- No CSP/SecurityHeader audit (was: error-obs-audit-2026-05-22).
- No CodeQL / Scorecard run-history review.
- No image-vulnerability scan (Trivy) — only npm-tree.
- `next-auth@5.0.0-beta.31` major bump not evaluated; alpha-window decision.
