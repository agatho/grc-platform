# Alpha-Blockers — Status 2026-05-21

Re-triage of the 8 alpha-blockers from `docs/audits-overnight-2026-05-18/00-triage-summary.md` after Waves 23 and 24. Every status claim is backed by a file/line citation; no vibes.

## TL;DR

- **Done: 7**
- **Partial: 1**
- **Open: 0** (live data-exposure path)

Wave 24 closed the entire 🚨 cluster. The single remaining item (#1, OAuth refresh-token) is a **dormant schema artifact** — the column exists but no code path writes to it, so the alpha invite is not gated on it. It is recommended as a small cleanup PR before any production OAuth-connector ships.

## By item

### 1. OAuth refresh-tokens plaintext in `evidence_connector.refresh_token`

**Status: PARTIAL (dormant — no live exposure)**

Evidence:

- Schema defines the column as plain `text` with a misleading comment: `packages/db/src/schema/evidence-connector.ts:80` — `refreshToken: text("refresh_token"), // encrypted OAuth2 refresh token`
- Migration: `packages/db/drizzle/0157_create_connector_credential.sql:14` — `refresh_token TEXT,` (also plaintext)
- The only producer route (`apps/web/src/app/api/v1/connectors/[id]/credentials/route.ts`) writes `encryptedPayload`, `iv`, `authTag`, `scopes` — but **never touches `refresh_token`** (verified via `Grep refreshToken|refresh_token` across `apps/` returning no matches).
- No worker job populates this column either (`Grep` for `connectorCredential` returns only the route file, the schema, and a test helper).

Verdict: The column is a vestigial schema field. There is no live data-exposure path because no application code currently writes to it. The comment "encrypted OAuth2 refresh token" is documentation drift — the column is plain text and would silently store plaintext the moment a future OAuth-refresh flow is wired up.

Recommended fix path (small, defensive, before any OAuth refresh flow ships):

- Files: `apps/web/src/app/api/v1/connectors/[id]/credentials/route.ts` (optionally; only if a refresh-flow PR lands), `packages/db/src/schema/evidence-connector.ts` (drop misleading comment OR add an `ALTER TABLE ... RENAME COLUMN refresh_token TO refresh_token_encrypted` + companion `refresh_token_iv`, `refresh_token_auth_tag` columns to mirror `encryptedPayload`).
- LOC: ~20 (schema + one helper that runs `aesGcmEncrypt` on the refresh token using the same `CONNECTOR_ENCRYPTION_KEY`).
- Effort: 30–90 min if we also add the new columns + migration; <30 min if we just drop the misleading comment and put a TODO sentinel.
- Standalone PR: Yes. Does **not** block alpha invite — column is dormant. Bundle with the next connector PR rather than spawning a new migration on top of 0346 unless OAuth refresh is actually being implemented.

### 2. Risk Acceptance module — no API routes

**Status: DONE**

Evidence:

- `apps/web/src/app/api/v1/risks/[id]/acceptance/route.ts` — POST + GET, full authority-matrix enforcement at lines 131–170 (queries `riskAcceptanceAuthority`, picks lowest covering band, checks user role).
- `apps/web/src/app/api/v1/risks/[id]/acceptance/[acceptanceId]/revoke/route.ts` — revoke flow.
- `apps/web/src/app/api/v1/risk-acceptance/authority/route.ts` — authority matrix CRUD.
- Module guard at line 62 (`requireModule("erm", ...)`), audit via `withAuditContext` at line 172.

The route header (lines 1–19) explicitly references the F#3 finding and closes it.

### 3. Copilot privilege escalation on `/copilot/conversations/[id]/actions`

**Status: DONE**

Evidence:

- `apps/web/src/app/api/v1/copilot/conversations/[id]/actions/route.ts:68–89`. Marking `status === "executed"` now requires the user to hold one of `admin | risk_manager | control_owner | process_owner | dpo` in the org; `auditor` and `viewer` get 403.
- The comment block at lines 37–43 explicitly tags this as the alpha-readiness fix for the F#4 finding.

### 4. Webhook URL validation missing (SSRF) in `triggerWebhook`

**Status: DONE**

Evidence:

- Registration-time Zod refine: `packages/shared/src/schemas/event-bus.ts:105` uses `safeWebhookUrl`, which calls `checkWebhookUrl` (`packages/shared/src/url-safety.ts:114`).
- Delivery-time literal-host check: `apps/worker/src/crons/automation-engine-init.ts:174–191` (`checkWebhookUrl(webhook.url)` before fetch).
- DNS-rebinding defence: `apps/worker/src/crons/automation-engine-init.ts:197–214` (`checkResolvedHostIsPublic`, attributed to PR #215).
- Comment at line 173: "Registration-time validation already ran (PR #200), but rows that predate it could still be delivered."

Defence-in-depth at both registration and delivery; rejects localhost, private IPs, 169.254.169.254.

### 5. Webhook dispatcher stubbed

**Status: DONE**

Evidence:

- `apps/worker/src/crons/automation-engine-init.ts:147–282` — full HTTP delivery: HMAC-signs via `signPayload`, formats per template type via `formatWebhookPayload`, `fetch` with 10s `AbortController` timeout, persists every attempt into `webhook_delivery_log` with `responseStatus`, `responseBody`, `deliveredAt`, `errorMessage`.
- Comment at lines 148–153 explicitly closes F#6.

The `console.log` stub is gone.

### 6. Usage-event endpoint missing idempotency-key

**Status: DONE**

Evidence:

- Migration `packages/db/drizzle/0344_usage_record_idempotency.sql` — adds `idempotency_key varchar(128)` + partial unique index `usage_record_idem_uq` on `(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.
- Route `apps/web/src/app/api/v1/usage/route.ts:24–66` — reads `Idempotency-Key` header (or body field), pre-check SELECT, returns prior row with `{ idempotent: true }` on match.
- Race-safety handled at lines 87–107 — catches `usage_record_idem_uq` unique-violation from concurrent retries and returns the winning row.

RFC 9457bis-style implementation, both layers (pre-check + DB constraint).

### 7. Copilot rate-limit defined but never invoked

**Status: DONE**

Evidence:

- `apps/web/src/app/api/v1/copilot/conversations/[id]/messages/route.ts:5,23–44` — imports `rateLimit, LIMITS` and applies `LIMITS.COPILOT` keyed by `copilot:${ctx.userId}`. Returns 429 with `Retry-After` and RFC 9457 problem+json.
- The other copilot routes (`rag`, `templates`, `usage`, `actions`, conversation CRUD) do not incur AI cost — they update DB state only. Rate-limiting the message endpoint (the only AI-cost path) is the correct scope per ADR-019.

### 8. Plugin code execution without sandbox

**Status: DONE**

Evidence:

- `apps/web/src/app/api/v1/plugins/installations/route.ts:24–46` — install-time gate: looks up `plugin.executionMode`, returns 422 if `=== "native"`, with detail message "ARCTOS does not currently ship a sandboxed runtime for native plugins. Only wasm or isolated plugins may be installed."
- Defence-in-depth at registration (`createPluginSchema` rejects `native`, per the comment at lines 19–23) plus this run-time defence for legacy rows.
- Test coverage: `packages/shared/tests/plugin-execution-mode.test.ts`.

`executionMode` is now enforced, not just declared.

## Top 3 OPEN items, ranked

There are **no OPEN security blockers** for the alpha invite. All seven 🚨 items from the 2026-05-18 triage are verifiably closed. The single PARTIAL item (#1, refresh-token column) is dormant — no code writes to it, so no production data sits in cleartext. It can be tidied in a non-urgent follow-up PR when (and only when) someone wires an OAuth refresh flow.

Recommendation: **Proceed with colleague invites**. Track item #1 as a hygiene task on the next connector sprint; the only thing it needs today is a comment-drift fix to stop the schema lying about encryption.
