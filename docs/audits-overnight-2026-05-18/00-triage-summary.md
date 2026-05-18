# Overnight Audit Session — Triage Summary

**Stand:** 2026-05-18 evening, autonomous session per user request "tackle all" then "use agents where helpful and supportive".

Six Explore agents ran in parallel across remaining feature areas. Each produced a long findings doc in this directory. The agents are thorough but mechanical — they don't always know which historical migrations already addressed something. This doc is my own re-triage based on direct verification.

## Severity legend

- 🔥 **Critical, ship-blocker, fixed tonight** — verified vulnerability, PR open.
- 🚨 **Real and ship-blocker, NOT yet fixed** — needs an actual PR before pilot.
- ⚠️ **Real but lower-severity** — defensive hardening or hygiene; do before pilot if time.
- 🟢 **Defensible** — agent flagged but acceptable for alpha (placeholder feature, intentional design, false positive).

## Findings, ranked by my own triage

### 🔥 Critical — PR open tonight

| #   | Finding                                                                                                                                       | Source               | PR            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| 1   | `CONNECTOR_ENCRYPTION_KEY ?? "0".repeat(64)` — all-zero AES key if env var missing. Anyone with DB read can decrypt every stored OAuth token. | Connectors agent F#1 | **#196 open** |

### 🚨 Real and NOT yet fixed (alpha-blocker)

| #   | Finding                                                                                                                                                                                                                                                                                      | Source                         | Severity rationale                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| 2   | **OAuth refresh tokens stored plaintext** in `evidence_connector.refresh_token`. Refresh tokens grant indefinite API access.                                                                                                                                                                 | Connectors agent F#2           | Same blast radius as #1 once #1 is fixed         |
| 3   | **Risk Acceptance module has no API routes.** Schema + authority-matrix tables exist (`risk_acceptance`, `risk_acceptance_authority`), demo seed exists, UI claims feature ✅ Done in CLAUDE.md — but no `/api/v1/erm/.../acceptance` route. Authority matrix is never enforced server-side. | ISMS agent F#2                 | Either docs are wrong or feature was never wired |
| 4   | **Copilot privilege escalation** — `PATCH /api/v1/copilot/conversations/[id]/actions` allows `auditor` etc. to mark an action `executed`. No RBAC check on the actual action's effect.                                                                                                       | Graph/Copilot agent F#4        | Easy to exploit, real consequences               |
| 5   | **Webhook URL validation missing (SSRF)** — `triggerWebhook` automation action accepts arbitrary URL. Only `.url()` Zod check. Internal IPs, cloud metadata endpoints (169.254.169.254), localhost all reachable.                                                                            | Mining/Automation agent F#3    | Classic SSRF                                     |
| 6   | **Webhook dispatcher stubbed** — HMAC signing functions exist but actual dispatch is `console.log` per `automation-engine-init.ts:133-137`. Rules that "send webhook" silently no-op.                                                                                                        | Mining/Automation agent F#5    | Feature appears to work but doesn't              |
| 7   | **Usage event idempotency missing** → double-billing if a request retries. No idempotency-key column on `usage_event`.                                                                                                                                                                       | Marketplace/Metering agent F#3 | Direct financial impact                          |
| 8   | **Copilot rate limit defined but unused** — `LIMITS.COPILOT` exists in `lib/rate-limit.ts` but the route never calls `rateLimit()`. Unbounded AI cost per user.                                                                                                                              | Graph/Copilot agent F#3        | Easy fix, real cost-risk                         |
| 9   | **Plugin code execution not sandboxed** — `executionMode` field declared but no engine validates/enforces it. Plugins can declare `native` and ship arbitrary code.                                                                                                                          | Marketplace/Metering agent F#1 | Genuine RCE vector if pilots install plugins     |

### ⚠️ Real but lower-severity (do before broader release, not blocker)

| #   | Finding                                                                                                                                                                                                                         | Source                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 10  | Mining event-log POST cap is 5000 events vs project rule "bulk ≤ 100".                                                                                                                                                          | Mining agent F#1         |
| 11  | Mining queries lack date-range/pagination — unbounded scan possible.                                                                                                                                                            | Mining agent F#2         |
| 12  | Trigger-loop recursion guard is in-memory only — worker restart clears it.                                                                                                                                                      | Mining agent F#4         |
| 13  | Action execution sequential, partial-failure exposure.                                                                                                                                                                          | Mining agent F#6         |
| 14  | Cloud-connectors dashboard N+1 (3 sequential per-provider queries).                                                                                                                                                             | Connectors agent F#6     |
| 15  | Connector health-check stubbed; always reports healthy.                                                                                                                                                                         | Connectors agent F#7     |
| 16  | IV/authTag returned in connector-credential POST response (info leak).                                                                                                                                                          | Connectors agent F#8     |
| 17  | Connector `keyVersion` field stored but unused — no key-rotation path.                                                                                                                                                          | Connectors agent F#9     |
| 18  | `admin/connectors` discovery route has no auth (already a 308-style discovery payload, low risk but inconsistent).                                                                                                              | Connectors agent F#10    |
| 19  | DevOps/Identity connector configs lack DELETE handler.                                                                                                                                                                          | Connectors agent F#17–18 |
| 20  | Where-used catalog endpoint missing LIMIT (could return 100k+ rows).                                                                                                                                                            | Graph/Copilot agent F#7  |
| 21  | Graph `enrichment.ts:119,134` uses `sql.raw()` with string-concat for an IN-clause. **Currently non-exploitable** (`ids` come from prior DB reads, UUID-typed) but bad defensive style — future calls might pass untrusted IDs. | Graph/Copilot agent F#2  |
| 22  | Copilot doesn't set `containsPersonalData: true` when calling AI router — PII may flow to non-EU providers.                                                                                                                     | Graph/Copilot agent F#9  |
| 23  | EU AI Act incident-classification route lacks role allow-list — any authenticated user can mark an incident "serious" → Art. 73 2-day deadline.                                                                                 | EU AI Act agent F#4      |
| 24  | EU AI Act corrective-action concurrency hotspot — status transition outside transaction.                                                                                                                                        | EU AI Act agent F#6      |
| 25  | EU AI Act `determineFriaRequirement()` validator defined but never wired.                                                                                                                                                       | EU AI Act agent F#3      |
| 26  | Risk Scenario status changes have no state-machine validation.                                                                                                                                                                  | ISMS agent F#1           |
| 27  | RLS policies on risk-acceptance tables don't declare FORCE; FOR-clauses missing. **PARTIAL false positive** — migration 0336 dynamic sweep added all 4 policies; FORCE may still need verification per table.                   | ISMS agent F#3,4         |

### 🟢 Defensible / lower priority / false positive

| #   | Finding                                                                       | Source                   | Why I'm not acting                                                                                                                                               |
| --- | ----------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | EU AI Act tables "missing audit triggers on all 13 tables"                    | EU AI Act agent F#2      | **False positive.** Migration 0337 dynamically registered `audit_trigger` on every public table with `org_id`. The AI Act tables have `org_id`. Verified.        |
| 29  | EU AI Act 7 tables "RLS only-SELECT, missing 3 policies"                      | EU AI Act agent F#1      | **Partial false positive.** Migration 0336 dynamically swept all `org_id`-bearing tables and added missing policies. Worth one verification run, but not urgent. |
| 30  | Cloud/Identity/DevOps connectors "return simulated/mock results"              | Connectors agent F#3,4,5 | Explicit "alpha-stage placeholder implementation" per CLAUDE.md sprint tracker. Real SDK integration is Sprint 67+ work, not alpha-blocker.                      |
| 31  | EU AI Act PDF "may not stream"                                                | EU AI Act agent F#5      | Speculative — agent didn't verify actual buffer behavior. Defer until actual perf test (k6 smoke) flags it.                                                      |
| 32  | Marketplace "no Stripe webhook signature verification"                        | Marketplace agent F#4    | Stripe webhook endpoint doesn't exist yet. Will be required when billing actually integrates. Not alpha-blocker.                                                 |
| 33  | MCP "no auth bootstrap" — high if exposed externally                          | Graph/Copilot agent F#8  | MCP integration is internal-only today per architecture. Becomes a blocker only when MCP is exposed publicly.                                                    |
| 34  | Connector plaintext refresh-token finding overlaps with #2 — already counted. | Connectors F#2           | (dup)                                                                                                                                                            |

## Recommended PR sequence for tomorrow

1. **Merge #196** (encryption key fail-hard) — verify `CONNECTOR_ENCRYPTION_KEY` is set on prod first.
2. **One PR per row in 🚨 (#2–#9)** — six small PRs, each independently mergeable.
3. **Optional batched PR** for several ⚠ items grouped by file (e.g. all Connectors hardening together).

Estimated effort for the 🚨 cluster: about 6 hours.

## What this session also produced

- 5 already-merged PRs (#188–#195) — the original alpha-readiness scope.
- 4 Phase-1 audit reports (schema-drift, dead-routes, prompt-injection, as-any inventory) in this directory.
- 6 module-level audit reports in this directory.
- This triage doc.

## Cross-cutting takeaways

- The `withAuth() + requireModule(key)` pattern works, but routes still miss `requireModule` in non-trivial numbers across older modules. **Worth a one-time CI lint** that fails any new `route.ts` lacking both guards. (Inventory file: `docs/audits-overnight-2026-05-18/02-dead-routes.md` plus the per-module reports — total of ~120 routes patched in PRs #192–#194.)
- Several "feature ✅ Done" claims in CLAUDE.md don't match implementation reality (Risk Acceptance has schema but no API; webhook dispatcher is stubbed; many connector "execute" routes return mocks). Worth a CLAUDE.md / STATUS.md reconciliation pass.
- Encryption-key handling needs a standard helper. We have one good pattern (`packages/shared/src/wb-crypto.ts`) and one bad pattern (the fixed connector route). A `packages/shared/src/env-key.ts` that exports `getRequiredHexKey(envVar, 32)` would prevent the next instance.
